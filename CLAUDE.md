# CLAUDE.md

Persistent project context for Claude Code. Read this at the start of every session. Update it at the end of every session to reflect the current state.

For session-by-session history, see [CONTEXT.md](CONTEXT.md).

---

## Project Overview

A Progressive Web App (PWA) for a solo Chinese medicine & acupuncture practitioner in Israel. Runs in Safari on iOS, saved to home screen, feels native — no App Store required. Single-user app.

**Core loop:** check today's appointments → open patient → write session note → (optionally) send a legally signed invoice.

Primary language is Hebrew (RTL); mixed Hebrew/English supported in free-text notes.

---

## Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | Server components + route handlers; deploys cleanly on Vercel |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`) | Mobile-first, iOS-feel utility classes; custom theme in `app/globals.css` |
| Backend/DB | Supabase (Postgres + Auth + Storage) | Managed Postgres with RLS; free tier covers MVP |
| Auth | Google OAuth via Supabase Auth | Single allowed user enforced in middleware |
| Calendar | Google Calendar API v3 | Source of truth for scheduling — app never stores visit history independently |
| Invoicing | Morning (Green Invoice) API | Legally signed Israeli invoices, emailed to patient by Morning |
| Deployment | Vercel | Env vars + cron via Vercel dashboard |
| PWA | Manifest + iOS meta tags | Installable from Safari share sheet |

Dependencies: `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`. Dev: `@playwright/mcp`, `tailwindcss`, `@tailwindcss/postcss`.

---

## Architecture

### Route groups (`app/`)
- `(auth)/login/` — Public login page (Google OAuth via Supabase)
- `(protected)/` — Authenticated shell with top bar + bottom nav
  - `today/` — Home: today's Google Calendar events, patient matching, invoice CTA
  - `patients/` — Patient list + `[id]/` profile + session detail
  - `intake/` — New patient intake form
  - `layout.js`, `bottom-nav.js`, `sign-out-button.js`, `loading.js`
- `auth/callback/` — OAuth code exchange

### API routes (`app/api/`)
- `auth/` — Supabase auth callbacks
- `calendar/` — Google Calendar read/write + token refresh
- `morning/` — `test-connection`, `send-invoice`

### Supabase layer
- `lib/supabase/client.js` — Browser client (Client Components)
- `lib/supabase/server.js` — Server client (Server Components / Route Handlers)
- `lib/supabase/middleware.js` — Session refresh in Next.js middleware
- `middleware.js` (root) — Session refresh + `ALLOWED_EMAIL` enforcement on every request

### Supabase migrations (`supabase/migrations/`)
`001_create_tables` → `002_create_storage` → `003_google_tokens` → `004_notes_table_and_sessions_update` → `005_intake_patients_fields` → `006_intake_notes_fields` → `007_formula_presets` → `008_session_photos_bucket` → `009_session_note_fields` → `010_morning_integration` → `010b_add_paid_column`

### Key data model
- `practitioners` — 1 row per auth user; Morning credentials encrypted via Supabase Vault
- `patients` — full_name, phone, email (required for calendar matching + invoicing), date_of_birth, chief_complaint, tongue_photo_url, morning_client_id
- `sessions` — patient_id, session_number (auto-inc per patient), date, notes, tongue_photo_url, google_event_id, price, invoice_sent, invoice_id, paid
- Storage bucket `tongue-photos` (private, signed URLs): `/{user_id}/{patient_id}/intake.jpg` and `/{user_id}/{patient_id}/sessions/{session_id}.jpg`

### Auth flow
1. User clicks "Sign in with Google" → Supabase OAuth
2. Google → `/auth/callback` → exchanges code for session
3. Middleware checks `user.email === ALLOWED_EMAIL`; rejects others
4. Unauthenticated requests → `/login`

### Google Calendar as source of truth
- Full `calendar` OAuth scope required (NOT `calendar.readonly` — readonly doesn't return attendee emails)
- Today View fetches events; matches attendees to `patients.email` (case-insensitive)
- Per-event card states: known patient / unmatched email / no attendee email
- Schedule Next Appointment writes events back with patient as attendee

### Morning invoice flow
1. Lazy credentials: Morning Setup Modal opens only when "שלח חשבונית" tapped with no creds
2. Resolve Morning client: search by email → create if not found → cache `patients.morning_client_id`
3. `POST /documents` type 320 (חשבונית מס קבלה), `vatType: 1` (price includes VAT)
4. Update session: `invoice_sent: true`, `invoice_id: <doc id>`
5. Morning emails the signed invoice to the patient automatically

---

## Current State

### Shipped (Phases 1–9)
- Auth, protected shell, bottom nav (Today, Patients)
- Supabase DB + RLS + tongue-photos storage
- Patient list, search, intake form (with optional tongue photo)
- Patient profile, session history, session detail
- New session note: full-screen RTL editor, auto-save draft, session_number auto-inc
- Tongue photo upload on intake + per session
- Google Calendar integration: read (today + per-patient history) and write (schedule next)
- PWA manifest, iOS meta tags, add-to-home-screen
- Morning invoice integration: setup modal, send-invoice flow, price prompt, payment confirm modal, invoice flow sheet, session card "שלח חשבונית" CTA and "נשלחה" state
- Calendar nav modal + date picker, pull-to-refresh, dev login bypass
- Terminology swap: לקוח/לקוחות → מטופל/מטופלים across the UI

### In progress / recently stabilizing
- Morning invoice correctness (recent fixes: VAT type, client search by email, always-new-client behavior, error toasts with structured logging, service type selector, complete invoice fields)

### Planned next
- **Messaging & Notifications** — spec in [MESSAGING_SPEC.md](MESSAGING_SPEC.md). Not yet built. 6-phase plan: tables → approval + cron → WhatsApp (Meta WABA) → template builder UI → advanced triggers → polish. Email via Resend, WhatsApp via Meta Cloud API (templates must be pre-approved for outbound outside 24h window). Depends on new fields in `sessions` (`plan`, `homework`) and `practitioners` (clinic address, directions URL, quiet hours, booking URL) and new `patients` opt-in fields.

---

## Conventions

### File & route structure
- App Router; route groups in parentheses (`(auth)`, `(protected)`) for layouts without affecting URL
- API routes live under `app/api/<feature>/<action>/route.js`
- Shared UI in `components/` (flat, PascalCase `.js` files — no `.tsx` in this repo)
- Shared helpers in `lib/` (`lib/supabase/`, `lib/utils.js`, `lib/google-auth.js`)
- Supabase migrations are numbered `NNN_description.sql`, never edited after commit — add a new migration to change schema

### Language / framework
- Plain JavaScript (`.js`), not TypeScript
- `jsconfig.json` at root for path aliasing if needed
- Client Components: import from `lib/supabase/client.js`
- Server Components / Route Handlers: import from `lib/supabase/server.js`

### Styling
- Tailwind utility classes; dark theme (slate-950 background), mobile-first, iOS feel
- Custom tokens in `app/globals.css` via `@theme` block (`--color-primary`, `--color-primary-light`)
- Plum color `#6a4888` for the invoice CTA
- Min 44×44px tap targets (iOS HIG)
- iOS input focus zoom fix: set `font-size: 16px` on inputs

### RTL & Hebrew
- Use `dir="auto"` on text inputs/textareas so Hebrew aligns right and English aligns left automatically
- All user-facing copy is Hebrew; preserve Hebrew literals exactly as written

### Security
- `ALLOWED_EMAIL` enforced in middleware; all DB access under RLS
- Morning credentials stored encrypted in Supabase Vault; never returned to the client
- All Morning and Calendar API calls go through server-side routes only

### Terminology
- Patients are referred to as **מטופל / מטופלים** (not לקוח / לקוחות) across the UI. This was changed in commit 27e12b1.

---

## Known Issues / Open Questions

### Open product questions (from MESSAGING_SPEC §15)
1. Booking link: Calendly (faster) vs. self-serve in-PWA (more on-brand)?
2. After-hours approvals: leave pending, auto-send next morning, or clamp to e.g. 20:00?
3. WhatsApp template language: Hebrew only or Hebrew + English fallback?
4. Edit-before-send: offer "save back to template"?
5. Group sessions (> 1 patient per session): not in MVP — revisit later
6. Two-way WhatsApp replies: not MVP; tracked as Phase 7

### Gotchas worth remembering
- Google OAuth scope must be full `calendar`, not `calendar.readonly` (readonly drops attendee emails → patient matching breaks)
- Morning `vatType: 1` means the price *includes* VAT — this is what we want (fixed in b798837). `vatType: 0` caused mismatches.
- Morning client search is now done by the `email` field, not fuzzy `q=` (fixed in 464b2ac after a wrong-client bug)
- iOS Safari zooms inputs unless `font-size` is ≥ 16px
- Formula sheet must render via portal + lock body scroll to avoid background scrolling on iOS
- `package-lock.json` was removed from the repo because it broke Vercel builds (021d757); npm install regenerates it locally

### Files that are long-lived product specs (read, don't edit casually)
- [SPEC.md](SPEC.md) — master product spec
- [BUILD_PLAN.md](BUILD_PLAN.md) — phase-by-phase build checklist
- [MORNING_INTEGRATION.md](MORNING_INTEGRATION.md) — Morning invoice amendment spec
- [MESSAGING_SPEC.md](MESSAGING_SPEC.md) — messaging/notifications spec (not yet built)
- Screen-specific specs: [TODAY_SCREEN_SPEC.md](TODAY_SCREEN_SPEC.md), [CLIENTS_TAB_SPEC.md](CLIENTS_TAB_SPEC.md), [INTAKE_SCREEN_SPEC.md](INTAKE_SCREEN_SPEC.md), [SESSION_NOTE_SPEC.md](SESSION_NOTE_SPEC.md), [SPLASH_LOGIN_SPEC.md](SPLASH_LOGIN_SPEC.md)
- Design updates: [GLOBAL_DESIGN_UPDATE.md](GLOBAL_DESIGN_UPDATE.md), [TODAY_VIEW_DESIGN_UPDATE.md](TODAY_VIEW_DESIGN_UPDATE.md)

---

## Commands

- `npm run dev` — start Next.js dev server with hot reload
- `npm run build` — production build
- `npm start` — start prod server
- `npm run lint` — Next.js lint
- `npm run gallery` — capture a screenshot gallery of all main routes. Requires `npm run dev` running in another terminal and `NEXT_PUBLIC_DEV_USER_EMAIL` / `NEXT_PUBLIC_DEV_USER_PASSWORD` in `.env.local` (uses the dev-login bypass). Output: [gallery/index.html](gallery/index.html) — open it to browse. Source: [scripts/gallery.mjs](scripts/gallery.mjs). Routes are captured at iPhone 14 Pro viewport via headless Chromium. `gallery/` is git-ignored; re-run after UI changes.

---

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `ALLOWED_EMAIL` — single authorized user's email (server-side only)
- Google OAuth client + calendar credentials (via Supabase Auth config; token refresh handled server-side)
- Morning credentials are per-user, stored in Supabase Vault — not env vars

---

## Session Protocol

At the **end of every session**:
1. Update this file to reflect the current state (shipped vs. in progress vs. planned, new conventions, new gotchas).
2. Append a dated entry to [CONTEXT.md](CONTEXT.md) with what was built/changed, key decisions, and anything surprising a new reader should know.
