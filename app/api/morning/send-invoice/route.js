import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MORNING_MOCK = process.env.MORNING_MOCK === "true";
const MORNING_BASE_URL = process.env.MORNING_SANDBOX === "true"
  ? "https://sandbox.greeninvoice.co.il/api/v1"
  : "https://api.greeninvoice.co.il/api/v1";

const MORNING_TIMEOUT = 15000;

// In-memory token cache keyed by API key ID
const tokenCache = new Map();

async function safeFetch(url, options) {
  try {
    return await fetch(url, { ...options, signal: AbortSignal.timeout(MORNING_TIMEOUT) });
  } catch (err) {
    const isTimeout = err?.name === "TimeoutError" || err?.name === "AbortError";
    throw new Error(isTimeout ? "MORNING_TIMEOUT" : "MORNING_UNREACHABLE");
  }
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function getMorningToken(credentials) {
  if (MORNING_MOCK) return "mock-token";

  const cacheKey = credentials.keyId;
  const cached = tokenCache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now() + 60000) {
    return cached.token;
  }

  const tokenRes = await safeFetch(`${MORNING_BASE_URL}/account/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: credentials.keyId, secret: credentials.secret }),
  });

  if (!tokenRes.ok) {
    // Clear stale cache on auth failure
    tokenCache.delete(cacheKey);
    throw new Error("INVALID_CREDENTIALS");
  }

  let tokenData;
  try {
    tokenData = await tokenRes.json();
  } catch {
    throw new Error("MORNING_INVALID_RESPONSE");
  }

  const token = tokenData?.token;
  if (!token || typeof token !== "string") {
    throw new Error("MORNING_INVALID_RESPONSE");
  }

  tokenCache.set(cacheKey, {
    token,
    expiresAt: Date.now() + 30 * 60 * 1000,
  });

  return token;
}

async function resolveMorningClientId(token, patient, supabase) {
  if (MORNING_MOCK) {
    const mockClientId = `mock-client-${patient.id.slice(0, 8)}`;
    await supabase
      .from("patients")
      .update({ morning_client_id: mockClientId })
      .eq("id", patient.id);
    return mockClientId;
  }

  // Always create a new client in Morning to avoid wrong-client matches.
  // Morning's /clients/search is fuzzy and can return unrelated clients,
  // which would attach an invoice to the wrong person.
  const createRes = await safeFetch(`${MORNING_BASE_URL}/clients`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      name: patient.full_name,
      emails: [patient.email],
      phone: patient.phone || undefined,
    }),
  });

  if (!createRes.ok) {
    let detail = "";
    try {
      const errBody = await createRes.json();
      detail = errBody?.errorMessage || errBody?.message || "";
    } catch { /* not JSON */ }
    throw new Error(`MORNING_CLIENT_CREATE_FAILED${detail ? `: ${detail}` : ""}`);
  }

  let newClient;
  try {
    newClient = await createRes.json();
  } catch {
    throw new Error("MORNING_INVALID_RESPONSE");
  }

  const clientId = newClient?.id;
  if (!clientId) {
    throw new Error("MORNING_INVALID_RESPONSE");
  }

  await supabase
    .from("patients")
    .update({ morning_client_id: String(clientId) })
    .eq("id", patient.id);

  return String(clientId);
}

function logInvoiceError(stage, details) {
  console.error(JSON.stringify({
    event: "invoice_error",
    stage,
    timestamp: new Date().toISOString(),
    ...details,
  }));
}

// Map internal error codes to Hebrew user-facing messages
function errorToMessage(code) {
  if (code === "INVALID_CREDENTIALS") return "פרטי ה-API שגויים. יש לבדוק את המפתחות בחשבון המורנינג.";
  if (code === "MORNING_TIMEOUT") return "מורנינג לא הגיב בזמן. יש לנסות שוב.";
  if (code === "MORNING_UNREACHABLE") return "לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב.";
  if (code === "MORNING_INVALID_RESPONSE") return "תשובה לא תקינה מצד מורנינג. יש לנסות שוב.";
  if (code?.startsWith("MORNING_CLIENT_CREATE_FAILED")) return "לא ניתן ליצור לקוח במורנינג. יש לנסות שוב.";
  return "לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב.";
}

export async function POST(request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }

    const { patientId, sessionId, price, serviceType, sessionDate: rawSessionDate } = body || {};

    // Validate sessionDate format (YYYY-MM-DD) if provided
    const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
    const sessionDate = rawSessionDate && ISO_DATE_RE.test(rawSessionDate) ? rawSessionDate : undefined;

    if (!patientId || !sessionId || !price || typeof price !== "number" || price <= 0) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Check for duplicate invoice (idempotency guard)
    const { data: existingSession } = await supabase
      .from("sessions")
      .select("invoice_sent, invoice_id")
      .eq("id", sessionId)
      .single();

    if (existingSession?.invoice_sent) {
      return NextResponse.json(
        { error: "חשבונית כבר נשלחה עבור טיפול זה.", invoiceId: existingSession.invoice_id },
        { status: 409 }
      );
    }

    // 1. Get practitioner's Morning credentials
    const { data: practitioner } = await supabase
      .from("practitioners")
      .select("morning_api_key_id, morning_api_key_secret")
      .eq("id", user.id)
      .single();

    if (!practitioner?.morning_api_key_id || !practitioner?.morning_api_key_secret) {
      return NextResponse.json(
        { error: "MISSING_CREDENTIALS" },
        { status: 400 }
      );
    }

    // 2. Get patient data
    const { data: patient } = await supabase
      .from("patients")
      .select("id, full_name, email, phone, morning_client_id")
      .eq("id", patientId)
      .single();

    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    if (!patient.email) {
      return NextResponse.json(
        { error: "לא קיים מייל עבור מטופל זה. יש להוסיף מייל בפרופיל המטופל." },
        { status: 400 }
      );
    }

    // 3. Get Morning token
    let token;
    try {
      token = await getMorningToken({
        keyId: practitioner.morning_api_key_id,
        secret: practitioner.morning_api_key_secret,
      });
    } catch (err) {
      const code = err?.message || "UNKNOWN";
      const status = code === "INVALID_CREDENTIALS" ? 401 : 502;
      logInvoiceError("get_token", { code, patientId, sessionId });
      return NextResponse.json({ error: errorToMessage(code) }, { status });
    }

    // 4. Create Morning client (always create fresh to avoid wrong-client matches)
    let morningClientId;
    try {
      morningClientId = await resolveMorningClientId(token, patient, supabase);
    } catch (err) {
      logInvoiceError("resolve_client", { code: err?.message, patientId, patientEmail: patient.email, sessionId });
      return NextResponse.json(
        { error: errorToMessage(err?.message) },
        { status: 502 }
      );
    }

    // 5. Save price to session
    const { error: priceError } = await supabase
      .from("sessions")
      .update({ price })
      .eq("id", sessionId);

    if (priceError) {
      logInvoiceError("save_price", { sessionId, price, supabaseError: priceError.message });
      return NextResponse.json(
        { error: "שגיאה בשמירת המחיר. יש לנסות שוב." },
        { status: 500 }
      );
    }

    // 6. Create invoice document
    let invoiceId;

    if (MORNING_MOCK) {
      invoiceId = `mock-inv-${Date.now()}`;
    } else {
      let docRes;
      try {
        docRes = await safeFetch(`${MORNING_BASE_URL}/documents`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            type: 320, // חשבונית מס קבלה — combined invoice + receipt, correct for עוסק מורשה who collects payment at time of service
            lang: "he",
            currency: "ILS",
            vatType: 1, // price includes VAT (כולל מע"מ)
            ...(sessionDate ? { date: sessionDate } : {}),
            client: { id: morningClientId },
            income: [
              {
                description: `טיפול ${serviceType || "דיקור"}`,
                quantity: 1,
                price,
              },
            ],
            payment: [
              {
                type: 4, // Paybox (electronic payment)
                price,
                ...(sessionDate ? { date: sessionDate } : {}),
              },
            ],
          }),
        });
      } catch (err) {
        logInvoiceError("create_document_fetch", { code: err?.message, patientId, sessionId, price, serviceType });
        return NextResponse.json(
          { error: errorToMessage(err?.message) },
          { status: 502 }
        );
      }

      if (!docRes.ok) {
        let detail = "";
        try {
          const errBody = await docRes.json();
          detail = errBody?.errorMessage || errBody?.message || "";
        } catch { /* not JSON */ }

        logInvoiceError("create_document_rejected", { httpStatus: docRes.status, detail, patientId, sessionId, price, serviceType, morningClientId });
        return NextResponse.json(
          { error: "שגיאה ביצירת חשבונית במורנינג." + (detail ? ` (${detail})` : "") + " יש לנסות שוב." },
          { status: 502 }
        );
      }

      let doc;
      try {
        doc = await docRes.json();
      } catch {
        logInvoiceError("create_document_parse", { patientId, sessionId });
        return NextResponse.json(
          { error: "תשובה לא תקינה מצד מורנינג. יש לנסות שוב." },
          { status: 502 }
        );
      }

      invoiceId = doc?.id;
      if (!invoiceId) {
        logInvoiceError("create_document_no_id", { patientId, sessionId, responseKeys: Object.keys(doc || {}) });
        return NextResponse.json(
          { error: "תשובה לא תקינה מצד מורנינג. יש לנסות שוב." },
          { status: 502 }
        );
      }
    }

    // 7. Update session with invoice info
    const { error: updateError } = await supabase
      .from("sessions")
      .update({
        invoice_sent: true,
        invoice_id: String(invoiceId),
      })
      .eq("id", sessionId);

    if (updateError) {
      logInvoiceError("update_session", { sessionId, invoiceId: String(invoiceId), supabaseError: updateError.message });
      // Invoice was created in Morning but we failed to record it locally.
      // Return success with a warning so the user knows the invoice exists,
      // but flag that the DB is out of sync.
      return NextResponse.json({
        success: true,
        invoiceId: String(invoiceId),
        warning: "החשבונית נוצרה במורנינג אך השמירה נכשלה. יש לרענן את הדף.",
      });
    }

    return NextResponse.json({ success: true, invoiceId: String(invoiceId) });
  } catch (err) {
    logInvoiceError("unhandled", { message: err?.message, stack: err?.stack });
    return NextResponse.json(
      { error: "שגיאה בלתי צפויה. יש לנסות שוב." },
      { status: 500 }
    );
  }
}
