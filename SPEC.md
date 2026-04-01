# Acupuncture Practice Manager — MVP Spec

## Product Summary
A Progressive Web App (PWA) for a solo Chinese medicine & acupuncture practitioner.
Runs in Safari on iOS, saved to home screen. Feels native. No App Store required.
Single user. Core loop: check today's appointments → open patient → write session note.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router) |
| Styling | Tailwind CSS — iOS-feel, mobile-first |
| Backend / DB | Supabase (Postgres + Auth + Storage) |
| Auth | Google OAuth via Supabase Auth (single user) |
| Google Calendar | Google Calendar API v3 (OAuth2, read + write) |
| PWA | next-pwa — manifest.json + service worker |
| RTL | `dir="auto"` on text inputs, CSS logical properties |
| Deployment | Vercel |

---

## Data Model

### `patients`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| full_name | text | |
| phone | text | Mandatory |
| email | text | Mandatory — used for calendar matching |
| date_of_birth | date | Optional |
| chief_complaint | text | Optional, pinned to profile |
| tongue_photo_url | text | Supabase Storage URL, intake photo (optional) |
| created_at | timestamp | |

### `sessions`
| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| patient_id | uuid | FK → patients |
| session_number | int | Auto-incremented per patient |
| date | timestamp | |
| notes | text | Free text, Hebrew + English, RTL-aware |
| tongue_photo_url | text | Supabase Storage URL, one per session (optional) |
| google_event_id | text | Linked calendar event (nullable) |
| created_at | timestamp | |

---

## Google Calendar as Source of Truth

Google Calendar is the canonical record for all scheduling. The app never stores visit history independently.

### Derived from Calendar:
- **Last appointment date** — most recent past event where patient is attendee
- **Next appointment** — next future event where patient is attendee
- **Visit pattern** — average interval between past events (display only, no logic on it in MVP)

### Patient ↔ Event linking:
- Matched via attendee email (exact, case-insensitive)
- On patient creation, email is stored in `patients.email`
- Calendar is queried per-patient when their profile is opened

---

## Screens & User Flows

### 1. Today View (Home)
- Fetches today's Google Calendar events on load + pull-to-refresh
- For each event, reads attendee emails and matches against `patients.email`
- Three states per appointment card:
  - ✅ **Known patient** → tap opens Patient Profile
  - 🆕 **Unmatched email** → tap opens New Patient Intake, name + email pre-filled
  - ❓ **No attendee email** → tap opens New Patient Intake, name pre-filled only
- FAB: "+ New Patient" for walk-ins not on calendar

### 2. Patient List
- Full list, sorted by last calendar appointment date
- Search by name (instant, client-side)
- Each row: name, last seen date (from calendar)

### 3. Patient Profile
- Header: name, total sessions, last seen (from calendar), next appointment (from calendar)
- Chief complaint pinned below header (if set)
- Intake tongue photo thumbnail (if set) — tap to view full screen
- Session history: newest-first timeline
- Each session row: date, session number, tongue photo indicator, first line of notes
- Tap session → Session Detail
- FAB: "+ New Session Note"

### 4. New Patient Intake
**Mandatory:**
- Full name (pre-filled from calendar if available)
- Phone number
- Email (pre-filled from calendar if available)

**Optional:**
- Date of birth
- Chief complaint
- Tongue photo (camera or photo library)

On save → Patient Profile

### 5. New Session Note
- Full-screen free-text editor
- Large, distraction-free input
- Hebrew (RTL auto-detected) and English in same note
- Tongue photo: optional, one per session — camera or library
  - Thumbnail shown inline once added, tap to remove / replace
- Auto-saves draft every 5 seconds
- "Save" → commits session, increments session number
- After save, one optional prompt:
  - "Schedule next appointment?" → opens Schedule Next Appointment

### 6. Session Detail
- Read-only: date, session number, full note text
- Tongue photo full-width below notes (if present), tap for full screen
- Edit button → back to editor

### 7. Schedule Next Appointment
- Date + time picker
- Duration picker (30 / 45 / 60 / 90 min)
- Creates Google Calendar event: title = patient name, attendee = patient email
- Stores `google_event_id` on session record

---

## Photo Storage
- Supabase Storage bucket: `tongue-photos` (private, signed URLs)
- Upload via `<input type="file" accept="image/*" capture="environment">` — camera or library
- Path pattern:
  - Intake: `/{user_id}/{patient_id}/intake.jpg`
  - Session: `/{user_id}/{patient_id}/sessions/{session_id}.jpg`

---

## PWA Configuration
- `manifest.json`: name, icons, `display: standalone`, `theme_color`
- iOS meta tags: `apple-mobile-web-app-capable`, status bar style
- Service worker: offline shell (Today View shows cached data if offline)

---

## Auth & Security
- Google OAuth via Supabase Auth
- Single allowed user: `ALLOWED_EMAIL` env var, enforced at middleware
- Supabase RLS: all tables and storage scoped to authenticated user ID

---

## Google Calendar Integration

### Auth
- OAuth2 scope: `https://www.googleapis.com/auth/calendar`
  - ⚠️ Full scope required to read attendee emails. The narrower `calendar.readonly` does NOT return attendee data. Must be added to Google Cloud OAuth consent screen explicitly.
- Token stored in Supabase session, refreshed via Next.js API route

### Read
- Today's events: on app load + pull-to-refresh
- Patient history: per-patient when Profile is opened

### Write
- Create event: title = patient name, attendee = patient email, duration as selected
- Update / delete: out of scope for MVP

---

## Out of Scope (v2)
- Nudge / retention message system
- Notification center
- Payments / receipts
- Medicine formula tracker
- Clinic / location tracking
- Multi-user / receptionist access
- Patient-facing booking
- Push notifications
- Outcome tracking / analytics
- Multiple tongue photos per session
