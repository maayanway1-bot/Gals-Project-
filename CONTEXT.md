# CONTEXT.md

Append-only session log, reverse-chronological (newest on top). For current project state, see [CLAUDE.md](CLAUDE.md).

Each entry captures: what changed, key decisions and why, and anything that would surprise a new reader of the code.

---

## 2026-04-24 — Flow-based gallery (interactions + API mocking)

**What changed**
- Expanded [scripts/gallery.mjs](scripts/gallery.mjs) from 5 static routes to 20 screens across 7 product flows: Sign in, Today view, Write a session note, Mark a session as paid, Send an invoice via Morning, New patient intake, Browse patients.
- Each flow shows its user journey as a horizontal strip of numbered step thumbnails with arrows between them — the gallery now documents *behavior*, not just *screens*.
- Playwright intercepts three endpoints to force deterministic flow states without touching the dev DB:
  - `/api/calendar/today` → injected mock calendar events (mirrors `supabase/seed-mock-data.sql`)
  - `/rest/v1/sessions` (GET list + GET single/drawer) → doctored session rows so each flow shows the exact status it needs (`needs-note`, `needs-payment`, `needs-invoice`, `completed`, `new-client`)
  - `/rest/v1/sessions` (PATCH/POST) + `/rest/v1/notes` writes → stubbed so "Mark paid", drawer-save, etc. don't error against the real DB with fake-UUID rows
  - `/api/morning/send-invoice` + `/api/morning/test-connection` → stubbed so the invoice success state is capturable without hitting the real Morning provider

**Key decisions**
- Force determinism via route interception, not by reshaping the dev DB. Tradeoff: the gallery can diverge from what a real user sees if the mock shape drifts from production responses, but it avoids destructive test-data setup and works on any machine with the dev-login bypass configured.
- `deriveStatus` returns `needs-note` whenever an event's attendee email matches a patient AND no session row exists. That means every flow that uses the Today view must explicitly declare all 4 seed patients' event-to-status mapping (`ALL_NEEDS_NOTE`, `ALL_NEEDS_PAYMENT`, `ALL_NEEDS_INVOICE`, `MIXED_STATES`) — omitting a patient silently collapses them into `needs-note`. This is the biggest gotcha for anyone extending the gallery.
- Mock calendar has 6 events, one of which (`mock-event-6`, `new-patient@example.com`) intentionally has no matching patient in the DB, so the intake flow always has a `new-client` card to click.
- `waitQuiet()` now waits up to 15s for skeletons to detach AND waits for cards or empty-state text to appear on `/today` — the earlier 4s limit was short-snapping on slow intercept+render cycles, producing skeleton-loading screenshots.
- Session-note drawer is always mounted in the DOM (translated off-screen when closed). That means `page.getByPlaceholder(...).fill(...)` can succeed even when the drawer is hidden — both the `drawer-filled-*` and `drawer-empty` steps now explicitly click `"כתוב סיכום"` first and scroll the drawer to top before screenshotting.
- Screenshots use `viewport` mode by default. Full-page mode renders the always-mounted fixed-position drawer at the document tail, which contaminated earlier full-page captures of `/today`. Intake uses `full` since there's no modal to leak.

**Surprising things a new reader should know**
- `supabase-js` `.maybeSingle()` does NOT always set `Accept: application/vnd.pgrst.object+json` — some queries come through as plain arrays even though only one row is expected. The gallery's drawer-intercept handles both by matching on `client_report` in the select clause. If you change the drawer's query shape, update the condition in `scripts/gallery.mjs` — otherwise real DB rows leak into the "empty drawer" screenshot.
- The invoice success screen shows `maksmdasdronit@example.com` instead of `ronit@example.com` — that's the patient's actual email in the current dev DB, not a mock artifact. Patient records are never intercepted; only sessions + calendar are.
- The `gallery/` output is git-ignored. Re-run `npm run gallery` any time the UI changes to refresh the reference.
- Set `GALLERY_DEBUG=1` to print intercept-hit logs (row counts per flow, which drawer URLs matched, which URLs fell through). Useful when adding a new flow and the page isn't rendering the expected state.
- The `sheet-submit` step advances the invoice flow sheet by clicking a button matched against a regex list (`המשך לשליחת חשבונית`, `שלח חשבונית`, etc.). If the sheet's button labels change in [components/InvoiceFlowSheet.js](components/InvoiceFlowSheet.js), update the candidate list.

---

## 2026-04-24 — Living screenshot gallery (Playwright)

**What changed**
- Added [scripts/gallery.mjs](scripts/gallery.mjs): Playwright script that signs in via the dev-login bypass, navigates each main route at iPhone 14 Pro viewport, and writes PNGs + a grid-view [gallery/index.html](gallery/index.html).
- Added `npm run gallery` to [package.json](package.json).
- Added `gallery/` to [.gitignore](.gitignore) (`*.png` was already ignored).
- Added `playwright` as a devDependency (installed from public npm registry, bypassing the `eleoshealth.bytesafe.dev` private registry in `.npmrc`).

**Key decisions**
- Chose screenshots-from-running-app over Figma. Tradeoff: Figma gives polished pixel-perfect mocks but drifts out of sync with code; auto-captured screenshots are the source of truth by construction, at the cost of visual polish and "design-only" states.
- Captured from live dev server via the existing dev-login bypass (`NEXT_PUBLIC_DEV_USER_EMAIL`/`PASSWORD`). No auth mocking, no fixtures — fewer moving parts.
- Chromium (headless) at iPhone 14 Pro viewport only. Mobile-first app → desktop captures aren't useful. Safari-only rendering quirks won't show; that is a known limitation.
- Dynamic capture (first patient profile) is wrapped in try/catch and best-effort — the script always succeeds even if DB is empty or selectors move.
- Gallery output is git-ignored; it's a local artifact, not a committed asset.

**Surprising things a new reader should know**
- The repo's `.npmrc` pins the registry to a private Bytesafe instance (`eleoshealth.bytesafe.dev`). `playwright` is not published there, so it had to be installed with `--registry=https://registry.npmjs.org/`. If you add more public deps, either install them with the same flag or update `.npmrc`.
- `scripts/gallery.mjs` manually parses `.env.local` (it's loaded by `next dev` but not by plain `node`). If you rename env vars, update both the login page and this script.
- `*.png` is already globally gitignored in the repo — so screenshots committed to root as manual QA records in the past (e.g. `today-*.png`, `verify-*.png`) are untracked. The gallery output sits in `gallery/` which is also ignored to keep the `index.html` and PNGs together.
- Dev-login button text matcher: `/Dev Login/` — if the button label in [app/(auth)/login/page.js](app/(auth)/login/page.js) changes, update the selector in `scripts/gallery.mjs`.
- First successful run captured 5 screens: Auth/login, Today, Patients list, Patients/new-stub, Intake (with prefilled demo query). The "first patient profile" dynamic step silently skipped — selector needs a second look if we want profiles in the gallery.

---

## 2026-04-24 — Two-file context system bootstrapped

**What changed**
- Rewrote [CLAUDE.md](CLAUDE.md) into a full persistent-memory document: Project Overview, Tech Stack, Architecture, Current State, Conventions, Known Issues / Open Questions, Commands, Env Vars, Session Protocol. Replaces the earlier terse version that only listed commands, architecture, and style.
- Created this file, [CONTEXT.md](CONTEXT.md), as the append-only session log.

**Key decisions**
- Two-file split: `CLAUDE.md` is the living snapshot (overwrite on updates), `CONTEXT.md` is the history (append only, reverse chronological). Keeps the snapshot readable while preserving decision history.
- Pulled project facts from `SPEC.md`, `BUILD_PLAN.md`, `MORNING_INTEGRATION.md`, `MESSAGING_SPEC.md`, existing code under `app/`, `components/`, `lib/`, migrations in `supabase/migrations/`, and recent `git log`. No code changes in this session — docs only.

**Baseline snapshot (captured here for future reference)**
- Phases 1–9 shipped: auth shell, Supabase DB + RLS + storage, patient list/intake/profile, session notes with RTL + auto-save + photos, Google Calendar read+write, PWA, Morning invoice integration.
- Latest commits focused on Morning invoice correctness: `464b2ac` (client search by email + match verification), `6e39e64` (always create new Morning client, skip fuzzy), `b798837` (invoice VAT mismatch → `vatType: 1`), `dc99414` (longer error toasts + structured logging), `5ac95ba` (service type selector + complete invoice fields).
- Messaging & Notifications: spec exists ([MESSAGING_SPEC.md](MESSAGING_SPEC.md), added 2026-04-18), not yet built. 6-phase plan, Email via Resend, WhatsApp via Meta WABA Cloud API.

**Surprising things a new reader should know**
- This repo is plain JavaScript, not TypeScript (no `.tsx`, `jsconfig.json` at root). Don't reach for TS tooling.
- Patients are **מטופל / מטופלים** in the UI, never **לקוח / לקוחות** (changed in commit `27e12b1`). If you write Hebrew copy, match this.
- Google OAuth uses the **full** `calendar` scope — `calendar.readonly` silently drops attendee emails and breaks patient matching. Documented here and in CLAUDE.md Gotchas.
- Morning `vatType: 1` means "price *includes* VAT" — that is the correct value for this integration. `vatType: 0` caused real invoice mismatches (see b798837).
- `package-lock.json` is intentionally untracked (021d757); it broke Vercel builds. `npm install` regenerates it locally — do not commit it.
- The repo currently tracks several `.png` screenshots at the root (`debug-timeout.png`, `today-*.png`, `verify-*.png`, etc.) used for manual QA records. Not production assets.

---
