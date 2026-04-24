#!/usr/bin/env node
// Living screenshot gallery, organized by product flow.
// Prereq: `npm run dev` in another terminal + dev-login creds in .env.local.
// Output: gallery/index.html with one row per flow.
//
// Strategy: Playwright intercepts three things per flow to get deterministic states:
//   1) /api/calendar/today       → inject mock calendar events
//   2) /rest/v1/sessions (GET)   → inject doctored session rows so cards show
//                                  the specific statuses each flow needs
//   3) /api/morning/*            → stub responses so the invoice flow is capturable
//                                  without hitting the real Morning provider

import { chromium, devices } from "playwright";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "gallery");
const BASE_URL = process.env.GALLERY_BASE_URL || "http://localhost:3000";

await loadDotEnvLocal();
const DEV_EMAIL = process.env.NEXT_PUBLIC_DEV_USER_EMAIL;
const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_USER_PASSWORD;

async function loadDotEnvLocal() {
  try {
    const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/i);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch {}
}

// ── Mock data ──────────────────────────────────────────────────────────────

function mockCalendarEvents(localDate) {
  const base = `${localDate}T`;
  return [
    { id: "mock-event-1", title: "רונית כהן",  start: `${base}09:00:00+03:00`, end: `${base}09:45:00+03:00`, duration: 45, attendees: [{ email: "ronit@example.com",  name: "רונית כהן"  }] },
    { id: "mock-event-2", title: "דני לוי",    start: `${base}10:00:00+03:00`, end: `${base}10:45:00+03:00`, duration: 45, attendees: [{ email: "dani@example.com",   name: "דני לוי"    }] },
    { id: "mock-event-3", title: "הפסקה",      start: `${base}11:00:00+03:00`, end: `${base}11:30:00+03:00`, duration: 30, attendees: [] },
    { id: "mock-event-4", title: "מיכל אברהם", start: `${base}12:00:00+03:00`, end: `${base}13:00:00+03:00`, duration: 60, attendees: [{ email: "michal@example.com", name: "מיכל אברהם" }] },
    { id: "mock-event-5", title: "יוסי חדד",   start: `${base}14:00:00+03:00`, end: `${base}14:45:00+03:00`, duration: 45, attendees: [{ email: "yossi@example.com",  name: "יוסי חדד"   }] },
    { id: "mock-event-6", title: "מטופל חדש",  start: `${base}15:00:00+03:00`, end: `${base}15:45:00+03:00`, duration: 45, attendees: [{ email: "new-patient@example.com", name: "מטופל חדש" }] },
  ];
}

// Derives the shape the Today list query expects (select includes `notes(id)`).
function buildSessionRows(sessionsByEventId) {
  return Object.entries(sessionsByEventId).map(([eventId, s], i) => ({
    id: `fake-session-${i + 1}`,
    google_event_id: eventId,
    paid: !!s.paid,
    invoice_sent: !!s.invoiceSent,
    invoice_id: s.invoiceId ?? null,
    price: s.price ?? null,
    notes: s.hasNote ? [{ id: `fake-note-${i + 1}` }] : [],
  }));
}

// ── Flow configurations ────────────────────────────────────────────────────
// Each flow that uses Today specifies which session status each event maps to.

// NB: deriveStatus returns "needs-note" for any event whose patient matches by
// email AND has no session row. So every real patient event MUST be listed
// here explicitly; otherwise they all collapse to needs-note.

const MIXED_STATES = {
  "mock-event-1": { hasNote: true,  paid: true,  invoiceSent: true,  price: 350, invoiceId: "inv-1" }, // completed (רונית)
  "mock-event-2": { hasNote: true,  paid: true,  invoiceSent: false, price: 350 },                     // needs-invoice (דני)
  "mock-event-4": { hasNote: true,  paid: false, invoiceSent: false },                                  // needs-payment (מיכל)
  "mock-event-5": { hasNote: false, paid: false, invoiceSent: false },                                  // needs-note (יוסי)
  // mock-event-6 (new-patient@example.com) has no matching patient → new-client
};

const ALL_NEEDS_NOTE = {
  "mock-event-1": { hasNote: false },
  "mock-event-2": { hasNote: false },
  "mock-event-4": { hasNote: false },
  "mock-event-5": { hasNote: false },
};

const ALL_NEEDS_PAYMENT = {
  "mock-event-1": { hasNote: true, paid: false },
  "mock-event-2": { hasNote: true, paid: false },
  "mock-event-4": { hasNote: true, paid: false },
  "mock-event-5": { hasNote: true, paid: false },
};

const ALL_NEEDS_INVOICE = {
  "mock-event-1": { hasNote: true, paid: true, invoiceSent: false, price: 350 },
  "mock-event-2": { hasNote: true, paid: true, invoiceSent: false, price: 350 },
  "mock-event-4": { hasNote: true, paid: true, invoiceSent: false, price: 350 },
  "mock-event-5": { hasNote: true, paid: true, invoiceSent: false, price: 350 },
};

// ── Intercept plumbing ─────────────────────────────────────────────────────

async function setupFlow(page, { sessionsByEventId = null, stubMorning = false } = {}) {
  await page.unrouteAll({ behavior: "ignoreErrors" });

  await page.route("**/api/calendar/today*", async (route) => {
    const url = new URL(route.request().url());
    const date =
      url.searchParams.get("date") || new Date().toISOString().slice(0, 10);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: mockCalendarEvents(date) }),
    });
  });

  if (sessionsByEventId) {
    const rows = buildSessionRows(sessionsByEventId);
    await page.route("**/rest/v1/sessions*", async (route) => {
      const req = route.request();
      // Intercept writes on fake rows so "mark paid" etc. don't error out
      // against the real DB. Return no-content success.
      if (req.method() === "PATCH" || req.method() === "POST") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: "[]",
        });
      }
      if (req.method() !== "GET") return route.continue();
      const url = req.url();
      const isSingle = (req.headers()["accept"] || "").includes("pgrst.object");

      // Today list query: select includes notes(id), filter is google_event_id=not.is.null
      if (url.includes("google_event_id=not.is.null") && !isSingle) {
        if (process.env.GALLERY_DEBUG) console.log(`    [intercept] today sessions → ${rows.length} rows`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(rows),
        });
      }

      // Drawer single-load: filter is google_event_id=eq.X, select includes client_report
      const m = url.match(/google_event_id=eq\.([^&]+)/);
      if (isSingle && m && url.includes("client_report")) {
        const eventId = decodeURIComponent(m[1]);
        if (process.env.GALLERY_DEBUG) console.log(`    [intercept] drawer load ${eventId} (single)`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ id: `fake-session-${eventId}`, notes: [] }),
        });
      }
      // Same query but without .maybeSingle() would come as an array; also handle it.
      if (m && url.includes("client_report")) {
        const eventId = decodeURIComponent(m[1]);
        if (process.env.GALLERY_DEBUG) console.log(`    [intercept] drawer load ${eventId} (array)`);
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([{ id: `fake-session-${eventId}`, notes: [] }]),
        });
      }

      if (process.env.GALLERY_DEBUG) {
        console.log(`    [pass-thru sessions] ${url.slice(-160)}`);
      }
      return route.continue();
    });

    // Block writes to notes/sessions so interactions don't pollute the real DB.
    await page.route("**/rest/v1/notes*", async (route) => {
      if (route.request().method() === "GET") return route.continue();
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: "[]",
      });
    });
  }

  if (stubMorning) {
    await page.route("**/api/morning/send-invoice", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ invoiceId: "demo-invoice-0001" }),
      });
    });
    await page.route("**/api/morning/test-connection", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    });
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function waitQuiet(page, ms = 600) {
  // Wait for any skeleton pulse to go away AND for a card or empty-state to appear
  // when on the Today view. Capped generously so slow fetches don't snap on loading.
  await page
    .locator('[style*="animation: pulse"]')
    .first()
    .waitFor({ state: "detached", timeout: 15000 })
    .catch(() => {});
  if (page.url().includes("/today")) {
    await page
      .waitForFunction(
        () => {
          const cards = document.querySelectorAll(
            ".today-card, .today-card-done, .today-card-break, .today-card-block"
          );
          const texts = document.body?.textContent || "";
          const empty = texts.includes("אין תורים") || texts.includes("אין פגישות");
          return cards.length > 0 || empty;
        },
        { timeout: 10000 }
      )
      .catch(() => {});
  }
  await page.waitForTimeout(ms);
}

async function snap(page, file, mode = "viewport") {
  await page.screenshot({
    path: path.join(OUT_DIR, file),
    fullPage: mode === "full",
  });
}

async function signIn(page) {
  await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  if (DEV_EMAIL && DEV_PASSWORD) {
    const btn = page.getByRole("button", { name: /Dev Login/ });
    if (await btn.count()) {
      await btn.click();
      await page
        .waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 })
        .catch(() => {});
    }
  }
  return !page.url().includes("/login");
}

// ── Flows ──────────────────────────────────────────────────────────────────

const flows = [
  {
    id: "auth",
    title: "Sign in",
    description: "Google OAuth, with a dev-login fallback in development.",
    steps: [
      {
        name: "login",
        caption: "Login screen",
        setup: async (page) => setupFlow(page, {}),
        do: async (page) => {
          await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded" });
          await page.waitForTimeout(400);
        },
      },
    ],
  },

  {
    id: "today",
    title: "Today view",
    description:
      "5 events across morning/afternoon/evening, one break, one unmatched. Per-card CTAs reflect the four actionable statuses.",
    steps: [
      {
        name: "populated",
        caption: "Today — completed + needs-invoice + needs-payment + needs-note + new-client",
        setup: async (page) => setupFlow(page, { sessionsByEventId: MIXED_STATES }),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "filter-note",
        caption: 'Filter pill: "סיכום" (needs-note only)',
        do: async (page) => {
          const pill = page.locator(".today-pill").filter({ hasText: "סיכום" });
          if (await pill.count()) {
            await pill.first().click();
            await page.waitForTimeout(300);
          }
        },
      },
      {
        name: "calendar-modal",
        caption: "Calendar nav modal",
        do: async (page) => {
          const clear = page.getByRole("button", { name: /נקה סינון/ });
          if (await clear.count()) await clear.click();
          await page.getByRole("button", { name: "פתח לוח שנה" }).click();
          await page.waitForTimeout(400);
        },
      },
    ],
  },

  {
    id: "session-note",
    title: "Write a session note",
    description:
      'Tap "כתוב סיכום" on a needs-note card → bottom drawer with three colored sections (report / treatment / plan).',
    steps: [
      {
        name: "entry",
        caption: 'Today — 4 cards with "כתוב סיכום"',
        setup: async (page) =>
          setupFlow(page, { sessionsByEventId: ALL_NEEDS_NOTE }),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "drawer-empty",
        caption: "Drawer — empty, top of form",
        do: async (page) => {
          await page.getByRole("button", { name: "כתוב סיכום" }).first().click();
          await page.waitForTimeout(700);
          // Belt-and-suspenders: clear any fields + scroll drawer to top.
          const placeholders = [
            /מה מדווח/, /תצפיות: לשון/, /נקודות דיקור/,
            /מה יהיה בפגישה/, /המלצות תזונה/,
          ];
          for (const re of placeholders) {
            await page.getByPlaceholder(re).fill("").catch(() => {});
          }
          await page.locator(".note-drawer .scroll-content").evaluate((el) => {
            el.scrollTop = 0;
          }).catch(() => {});
          await page.waitForTimeout(200);
        },
      },
      {
        name: "drawer-filled-1",
        caption: "Drawer — section 1 filled (report + tongue/pulse)",
        do: async (page) => {
          await page
            .getByPlaceholder(/מה מדווח/)
            .fill("מדווחת על שיפור ניכר בשינה, ירידה בחרדה. אנרגיה טובה בבוקר.");
          await page
            .getByPlaceholder(/תצפיות: לשון/)
            .fill("לשון חיוורת, דופק חלש בכף יד ימין.");
          await page.locator(".note-drawer .scroll-content").evaluate((el) => {
            el.scrollTop = 0;
          }).catch(() => {});
          await page.waitForTimeout(300);
        },
      },
      {
        name: "drawer-filled-all",
        caption: "Drawer — all sections filled, ready to save",
        do: async (page) => {
          await page
            .getByPlaceholder(/נקודות דיקור/)
            .fill("GB34, BL40, DU20. מוקסה על LI4. שיאצו קצר בכתפיים.");
          await page
            .getByPlaceholder(/מה יהיה בפגישה/)
            .fill("טיפול הבא: חיזוק הטחול, עבודה על רגליים וקרקוע.");
          await page
            .getByPlaceholder(/המלצות תזונה/)
            .fill("תה ג׳ינג׳ר בבוקר, הפחתת קפה, הליכה יומית 20 דקות.");
          await page.waitForTimeout(300);
        },
      },
    ],
  },

  {
    id: "invoice-mark-paid",
    title: "Mark a session as paid",
    description:
      'Session not yet paid → tap "סמן כשולם" → status flips to needs-invoice, card turns plum.',
    steps: [
      {
        name: "entry",
        caption: 'Today — 4 cards with "סמן כשולם"',
        setup: async (page) =>
          setupFlow(page, {
            sessionsByEventId: ALL_NEEDS_PAYMENT,
            stubMorning: true,
          }),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "after-mark",
        caption: "After marking paid — invoice flow sheet opens",
        do: async (page) => {
          await page.getByRole("button", { name: "סמן כשולם" }).first().click();
          await page.waitForTimeout(1200);
        },
      },
    ],
  },

  {
    id: "invoice-send",
    title: "Send an invoice via Morning",
    description:
      'needs-invoice card → tap "שלח חשבונית" → invoice flow sheet (price → sending → success). Morning API calls are stubbed so no real invoice is issued.',
    steps: [
      {
        name: "entry",
        caption: 'Today — 4 cards with "שלח חשבונית"',
        setup: async (page) =>
          setupFlow(page, {
            sessionsByEventId: ALL_NEEDS_INVOICE,
            stubMorning: true,
          }),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "sheet-price",
        caption: "Invoice sheet — price step (service type + amount)",
        do: async (page) => {
          await page.getByRole("button", { name: "שלח חשבונית" }).first().click();
          await page.waitForTimeout(800);
        },
      },
      {
        name: "sheet-submit",
        caption: "Invoice sheet — after submit (success state)",
        do: async (page) => {
          // Advance past the price step: the button label is "המשך לשליחת חשבונית".
          const candidates = [
            /המשך לשליחת חשבונית/,
            /שלח חשבונית/,
            /^המשך$/,
            /^שלח$/,
          ];
          for (const re of candidates) {
            const b = page.locator("button").filter({ hasText: re }).last();
            if ((await b.count()) && (await b.isEnabled().catch(() => false))) {
              await b.click();
              break;
            }
          }
          // Wait for sending → success transition (stub returns immediately).
          await page.waitForTimeout(1800);
        },
      },
    ],
  },

  {
    id: "intake",
    title: "New patient intake",
    description:
      "Unmatched calendar event → intake form. Personal / contact / clinical / treatment / formulas / photos. The save step is NOT triggered — it would write a real patient row.",
    steps: [
      {
        name: "entry",
        caption: 'Today — unmatched event shows "התחל אינטייק"',
        setup: async (page) =>
          setupFlow(page, { sessionsByEventId: MIXED_STATES }),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/today`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "blank",
        caption: "Intake — blank form",
        do: async (page) => {
          const btn = page.getByRole("button", { name: "התחל אינטייק" }).first();
          if (await btn.count()) {
            await btn.click();
          } else {
            // Fallback: direct navigation
            const today = new Date().toISOString();
            await page.goto(
              `${BASE_URL}/intake?${new URLSearchParams({
                name: "מטופל חדש",
                email: "new-patient@example.com",
                eventId: "mock-event-6",
                date: today,
                time: "15:00",
              })}`,
              { waitUntil: "domcontentloaded" }
            );
          }
          await waitQuiet(page, 400);
        },
        mode: "full",
      },
      {
        name: "personal",
        caption: "Intake — personal details (gender picked)",
        do: async (page) => {
          await page.locator(".gender-option").filter({ hasText: "אישה" }).click();
          await page.waitForTimeout(200);
        },
        mode: "full",
      },
      {
        name: "all-filled",
        caption: "Intake — all required fields filled, save button active",
        do: async (page) => {
          await page.getByPlaceholder("050-000-0000").fill("050-1234567");
          await page
            .getByPlaceholder(/תאר את הסיבה/)
            .fill("כאבי גב תחתון ממושכים, מחמירים בישיבה ממושכת.");
          await page
            .getByPlaceholder(/לפי RA/)
            .fill("חסימת Qi בערוצי Gallbladder ו-Bladder.");
          await page
            .getByPlaceholder(/נקודות שנבחרו/)
            .fill("GB34, BL40, BL23, DU20. מוקסה 10 דקות.");
          await page
            .getByPlaceholder(/תדירות, מספר/)
            .fill("6 טיפולים שבועיים, הערכה מחודשת אחרי 3.");
          await page.waitForTimeout(300);
        },
        mode: "full",
      },
    ],
  },

  {
    id: "patients",
    title: "Browse patients",
    description: "Patient list → profile → full profile.",
    steps: [
      {
        name: "list",
        caption: "Patient list",
        setup: async (page) => setupFlow(page, {}),
        before: async (page) => { await signIn(page); },
        do: async (page) => {
          await page.goto(`${BASE_URL}/patients`, { waitUntil: "domcontentloaded" });
          await waitQuiet(page);
        },
      },
      {
        name: "profile",
        caption: "Patient profile",
        do: async (page) => {
          const firstLink = page
            .locator('a[href^="/patients/"]:not([href="/patients/new"])')
            .first();
          if (await firstLink.count()) {
            await firstLink.click();
            await page
              .waitForURL(/\/patients\/[0-9a-f-]+$/, { timeout: 5000 })
              .catch(() => {});
            await waitQuiet(page);
          }
        },
        mode: "full",
      },
      {
        name: "full",
        caption: "Patient full profile",
        do: async (page) => {
          const u = new URL(page.url());
          if (u.pathname.match(/\/patients\/[0-9a-f-]+$/)) {
            await page.goto(`${BASE_URL}${u.pathname}/full`, {
              waitUntil: "domcontentloaded",
            });
            await waitQuiet(page);
          }
        },
        mode: "full",
      },
    ],
  },
];

// ── Runner ─────────────────────────────────────────────────────────────────

async function main() {
  await fs.rm(OUT_DIR, { recursive: true, force: true });
  await fs.mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    ...devices["iPhone 14 Pro"],
    locale: "he-IL",
  });
  const page = await ctx.newPage();

  const captured = [];
  for (const flow of flows) {
    console.log(`\n▸ ${flow.title}`);
    for (let i = 0; i < flow.steps.length; i++) {
      const step = flow.steps[i];
      const file = `${flow.id}-${String(i + 1).padStart(2, "0")}-${step.name}.png`;
      try {
        if (step.setup) await step.setup(page);
        if (step.before) await step.before(page);
        await step.do(page);
        await snap(page, file, step.mode || "viewport");
        captured.push({
          flowId: flow.id,
          flowTitle: flow.title,
          flowDesc: flow.description,
          step: i + 1,
          name: step.name,
          caption: step.caption,
          file,
        });
        console.log(`  ✓ ${step.name}`);
      } catch (e) {
        console.warn(`  ✗ ${step.name} — ${e.message.split("\n")[0]}`);
      }
    }
  }

  await browser.close();
  await writeIndex(captured);
  console.log(
    `\n✔ Gallery: ${captured.length} screens across ${flows.length} flows → ${path.relative(
      ROOT,
      OUT_DIR
    )}/index.html`
  );
}

async function writeIndex(captured) {
  const byFlow = new Map();
  for (const c of captured) {
    if (!byFlow.has(c.flowId))
      byFlow.set(c.flowId, { title: c.flowTitle, desc: c.flowDesc, items: [] });
    byFlow.get(c.flowId).items.push(c);
  }
  const sections = [...byFlow.values()]
    .map(
      (flow) => `
<section class="flow">
  <h2>${esc(flow.title)}</h2>
  <p class="flow-desc">${esc(flow.desc)}</p>
  <div class="strip">
${flow.items
  .map(
    (i, idx) => `
    <a class="card" href="${i.file}" target="_blank">
      <div class="card-img-wrap">
        <img src="${i.file}" alt="${esc(i.caption)}" loading="lazy" />
        <span class="step-badge">${i.step}</span>
      </div>
      <div class="caption">${esc(i.caption)}</div>
    </a>${idx < flow.items.length - 1 ? '<div class="arrow">→</div>' : ""}`
  )
  .join("")}
  </div>
</section>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>Product flows — ${new Date().toISOString().slice(0, 16).replace("T", " ")}</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f172a; color: #e2e8f0; margin: 0; padding: 24px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .sub { color: #94a3b8; font-size: 12px; margin-bottom: 28px; }
  .flow { margin: 0 0 40px; padding: 20px; background: #1e293b; border-radius: 16px; border: 1px solid #334155; }
  .flow h2 { font-size: 15px; margin: 0 0 4px; color: #fbbf24; }
  .flow-desc { font-size: 13px; color: #94a3b8; margin: 0 0 16px; line-height: 1.5; }
  .strip { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 12px; align-items: flex-start; }
  .strip::-webkit-scrollbar { height: 8px; }
  .strip::-webkit-scrollbar-thumb { background: #475569; border-radius: 4px; }
  .card { flex: 0 0 200px; display: block; color: inherit; text-decoration: none; }
  .card-img-wrap { position: relative; background: #000; border-radius: 10px; overflow: hidden; border: 1px solid #334155; }
  .card-img-wrap img { width: 100%; display: block; }
  .step-badge { position: absolute; top: 6px; left: 6px; background: rgba(0,0,0,0.65); color: #fff; font-size: 10px; font-weight: 700; padding: 2px 6px; border-radius: 999px; }
  .caption { font-size: 12px; color: #cbd5e1; margin-top: 8px; padding: 0 2px; line-height: 1.4; }
  .arrow { flex: 0 0 auto; align-self: center; font-size: 24px; color: #64748b; margin-top: -20px; user-select: none; }
  a:hover .card-img-wrap { border-color: #64748b; }
</style>
</head>
<body>
<h1>Product flows</h1>
<div class="sub">Generated ${new Date().toLocaleString()} · iPhone 14 Pro · ${captured.length} screens across ${byFlow.size} flows</div>
${sections}
</body>
</html>`;
  await fs.writeFile(path.join(OUT_DIR, "index.html"), html);
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
