import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const MORNING_MOCK = process.env.MORNING_MOCK === "true";
const MORNING_BASE_URL = process.env.MORNING_SANDBOX === "true"
  ? "https://sandbox.greeninvoice.co.il/api/v1"
  : "https://api.greeninvoice.co.il/api/v1";

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

    const { keyId, secret } = body || {};

    if (!keyId || !secret) {
      return NextResponse.json(
        { error: "Missing keyId or secret" },
        { status: 400 }
      );
    }

    if (!MORNING_MOCK) {
      let tokenRes;
      try {
        tokenRes = await fetch(`${MORNING_BASE_URL}/account/token`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: keyId, secret }),
          signal: AbortSignal.timeout(15000),
        });
      } catch (err) {
        // Network error, timeout, DNS failure, etc.
        return NextResponse.json(
          { error: "לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב." },
          { status: 502 }
        );
      }

      if (!tokenRes.ok) {
        // Try to extract a meaningful error from Morning's response
        let detail = "";
        try {
          const errBody = await tokenRes.json();
          detail = errBody?.errorMessage || errBody?.message || "";
        } catch { /* response wasn't JSON */ }

        if (tokenRes.status === 401 || tokenRes.status === 403) {
          return NextResponse.json(
            { error: "פרטי ה-API שגויים. יש לבדוק את המפתחות בחשבון המורנינג." },
            { status: 401 }
          );
        }

        return NextResponse.json(
          { error: "שגיאה מצד מורנינג. יש לנסות שוב." + (detail ? ` (${detail})` : "") },
          { status: 502 }
        );
      }
    }

    // Credentials are valid (or mock mode) — save them to practitioners table
    const { error: upsertError } = await supabase
      .from("practitioners")
      .upsert({
        id: user.id,
        morning_api_key_id: keyId,
        morning_api_key_secret: secret,
      }, { onConflict: "id" });

    if (upsertError) {
      return NextResponse.json(
        { error: "Failed to save credentials: " + upsertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב." },
      { status: 500 }
    );
  }
}
