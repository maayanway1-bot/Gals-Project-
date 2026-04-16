# Build Plan — Acupuncture Practice Manager

## How to work with Claude Code

Each phase below is a self-contained unit. The rule is simple:
**Don't start the next phase until you can check every box in the current one.**

Give Claude Code one phase at a time. Paste the phase prompt, let it build,
then validate manually before moving on. If something is broken, fix it in
the same phase — don't carry bugs forward.

---

## Phase 1 — Project Scaffold + Auth

### What to build
- Next.js app with App Router
- Tailwind CSS configured
- Supabase client set up (env vars)
- Google OAuth login via Supabase Auth
- Middleware that blocks any login except `ALLOWED_EMAIL`
- Single protected route: `/` redirects to `/login` if not authenticated
- Basic shell layout: bottom nav bar with tabs (Today, Patients) + top bar

### Prompt to give Claude Code
```
Create a new Next.js 14 app with App Router and Tailwind CSS.
Set up Supabase Auth with Google OAuth. Add middleware that checks
the logged-in user's email against an ALLOWED_EMAIL environment variable
and signs out anyone else. Create a /login page and a protected shell
layout with a bottom navigation bar (Today, Patients tabs) and a top bar.
Mobile-first, iOS feel. No content yet — just the skeleton.
```

### ✅ Validation checklist
- [ ] `npm run dev` starts with no errors
- [ ] `/login` shows a "Sign in with Google" button
- [ ] Signing in with the correct Google account lands on the app shell
- [ ] Signing in with a different Google account gets rejected
- [ ] Bottom nav renders, tabs are tappable
- [ ] Deploy to Vercel — confirm it works on iPhone Safari, not just desktop

### 🚦 Move on when: all boxes checked, app loads on your phone

---

## Phase 2 — Supabase Database

### What to build
- Create `patients` and `sessions` tables in Supabase
- Row Level Security (RLS) policies on both tables
- Supabase Storage bucket `tongue-photos` (private)
- Test that DB is reachable from the app

### Prompt to give Claude Code
```
Set up the Supabase database for this app. Create two tables:

patients: id (uuid PK), full_name (text), phone (text), email (text),
date_of_birth (date nullable), chief_complaint (text nullable),
tongue_photo_url (text nullable), created_at (timestamp default now())

sessions: id (uuid PK), patient_id (uuid FK → patients), session_number (int),
date (timestamp), notes (text nullable), tongue_photo_url (text nullable),
google_event_id (text nullable), created_at (timestamp default now())

Add RLS policies so users can only read/write their own rows (auth.uid() check).
Create a Supabase Storage bucket called tongue-photos set to private.
Generate the SQL migration file and the TypeScript types.
```

### ✅ Validation checklist
- [ ] Migration runs in Supabase SQL editor with no errors
- [ ] RLS is enabled on both tables (check Supabase dashboard)
- [ ] TypeScript types file generated
- [ ] Can insert a test patient row via the app and see it in Supabase dashboard
- [ ] Cannot read rows when signed out (test in Supabase dashboard with RLS)

### 🚦 Move on when: all boxes checked

---

## Phase 3 — Patient List + New Patient Intake

### What to build
- Patients tab: list of all patients, sorted by created_at for now
- Search bar (client-side filter by name)
- New Patient Intake form (name, phone, email mandatory; DOB, chief complaint optional)
- On save: inserts to Supabase, navigates to Patient Profile (stub page for now)
- FAB "+ New Patient" button

### Prompt to give Claude Code
```
Build the Patients tab. It should show a list of all patients from Supabase,
sorted by created_at descending. Add a search bar that filters by name
(client-side, instant). Each row shows: full name, phone number.
Add a floating action button (FAB) in the bottom right that opens a
New Patient Intake form. Mandatory fields: full name, phone, email.
Optional: date of birth, chief complaint. On save, insert to Supabase
patients table and navigate to /patients/[id] (stub page for now).
Mobile-first, iOS feel.
```

### ✅ Validation checklist
- [ ] Patient list loads from Supabase
- [ ] Search filters correctly as you type
- [ ] FAB opens the intake form
- [ ] Submitting the form with missing mandatory fields shows validation errors
- [ ] Submitting valid form creates a row in Supabase and navigates to stub profile
- [ ] Created patient appears in the list immediately

### 🚦 Move on when: all boxes checked

---

## Phase 4 — Patient Profile + Session Notes

### What to build
- Patient Profile page: header (name, chief complaint), session history list
- Session Detail: read-only view of a session note
- New Session Note: full-screen free-text editor, RTL-aware, auto-save draft
- Save session → inserts to Supabase, increments session_number, returns to profile
- Session number auto-increment logic (count existing sessions for patient + 1)

### Prompt to give Claude Code
```
Build the Patient Profile page at /patients/[id]. Show: patient name,
chief complaint (if set), total session count, and a newest-first list of
sessions (date, session number, first line of notes).

Add a FAB "+ New Session Note" that opens a full-screen text editor.
The editor should be distraction-free with a large text area. Support
RTL text direction auto-detection (use dir="auto" on the textarea).
Auto-save draft to localStorage every 5 seconds. On "Save", insert a new
session to Supabase with session_number = (existing session count + 1),
then navigate back to the Patient Profile.

Tapping a session in the list opens a read-only Session Detail page showing
the full note, date, and session number. Add an Edit button that reopens
the editor with the existing content.
```

### ✅ Validation checklist
- [ ] Patient Profile shows correct name, chief complaint, session count
- [ ] Session list shows newest first
- [ ] New Session Note editor opens full-screen
- [ ] Typing Hebrew text auto-aligns right
- [ ] Auto-save works (type something, close tab, reopen — draft is there)
- [ ] Saving creates a session in Supabase with correct session_number
- [ ] Session appears in profile list immediately after save
- [ ] Tapping session opens read-only detail
- [ ] Edit button reopens editor with existing content

### 🚦 Move on when: all boxes checked

---

## Phase 5 — Tongue Photos

### What to build
- Photo upload on New Patient Intake (optional)
- Photo upload on New Session Note (optional, one per session)
- Upload to Supabase Storage, store signed URL in DB
- Display in Patient Profile (intake photo thumbnail)
- Display in Session Detail (full-width photo)

### Prompt to give Claude Code
```
Add optional tongue photo upload to two places:

1. New Patient Intake form: add an optional photo field at the bottom.
Use <input type="file" accept="image/*" capture="environment"> so it
opens camera or library on iOS. On form submit, upload the image to
Supabase Storage at /{user_id}/{patient_id}/intake.jpg and save the
signed URL to patients.tongue_photo_url.

2. New Session Note editor: add a camera icon button in the toolbar.
Same input, uploads to /{user_id}/{patient_id}/sessions/{session_id}.jpg,
saves URL to sessions.tongue_photo_url. Show a thumbnail inline in the
editor after upload. Tap thumbnail to remove/replace.

In Patient Profile: show the intake photo as a small thumbnail in the header.
Tap to view full screen.

In Session Detail: if tongue_photo_url exists, show the image full-width
below the note text. Tap for full screen.
```

### ✅ Validation checklist
- [ ] Intake form shows photo picker, uploads correctly to Supabase Storage
- [ ] Intake photo thumbnail appears in Patient Profile header
- [ ] Session editor shows camera button, thumbnail appears after upload
- [ ] Removing/replacing photo works
- [ ] Session Detail shows photo full-width if present
- [ ] Full-screen tap works on both
- [ ] Photos load correctly on iPhone Safari (test signed URLs)

### 🚦 Move on when: all boxes checked

---

## Phase 6 — Google Calendar Integration (Read)

### What to build
- Google Calendar OAuth (additional scope on top of existing Google auth)
- Today View: fetch today's events, match attendees to patients by email
- Three card states: known patient / unmatched / no email
- Tapping unmatched → New Patient Intake with pre-filled name + email

### Prompt to give Claude Code
```
Add Google Calendar integration. The user is already signed in with Google
via Supabase Auth — extend the OAuth flow to also request the
https://www.googleapis.com/auth/calendar scope. Store the access token
and refresh token securely. Add a token refresh API route.

On the Today tab, fetch today's calendar events using the Calendar API v3
(timeMin = start of today, timeMax = end of today). For each event:
- Read the attendees array and extract emails
- Match against patients.email in Supabase (case-insensitive)
- If matched: show the patient name, appointment time — tap opens Patient Profile
- If unmatched email found: show event title, time, "New Patient" badge —
  tap opens New Patient Intake with name (from event title) and email pre-filled
- If no attendee email: show event title, time — tap opens New Patient Intake
  with name pre-filled only

Add pull-to-refresh. Show a loading skeleton while fetching.

⚠️ Important: use the full calendar scope, NOT calendar.readonly —
readonly does not return attendee emails.
```

### ✅ Validation checklist
- [ ] OAuth consent screen includes calendar scope (check Google Cloud Console)
- [ ] Today View loads real calendar events
- [ ] Known patients show name and link to their profile
- [ ] Unknown attendee email shows "New Patient" badge, intake pre-fills correctly
- [ ] Tapping pre-filled intake and saving creates the patient correctly
- [ ] Pull-to-refresh works
- [ ] Loading state shows while fetching

### 🚦 Move on when: all boxes checked, tested with real calendar events

---

## Phase 7 — Google Calendar Integration (Write)

### What to build
- "Schedule Next Appointment" flow after saving a session note
- Date + time picker, duration picker
- Creates a Google Calendar event with patient as attendee
- Stores google_event_id on the session

### Prompt to give Claude Code
```
After a session note is saved, show an optional bottom sheet prompt:
"Schedule next appointment?" with a "Schedule" button and a "Skip" option.

The Schedule flow should show:
- A date picker (default: 2 weeks from today)
- A time picker (default: same time as today's appointment if known)
- A duration picker: 30 / 45 / 60 / 90 min

On confirm: create a Google Calendar event via the Calendar API with:
- title = patient full_name
- attendees = [{ email: patient.email }]
- start = selected date + time
- end = start + selected duration

Save the returned event ID to sessions.google_event_id.
Show a success confirmation with the scheduled date.
```

### ✅ Validation checklist
- [ ] Prompt appears after saving a session note
- [ ] Skip works (no event created)
- [ ] Date / time / duration pickers work correctly
- [ ] Event appears in Google Calendar after confirming
- [ ] Patient is listed as attendee in the calendar event
- [ ] google_event_id saved to session in Supabase
- [ ] Success message shows the correct scheduled date

### 🚦 Move on when: all boxes checked, event verified in Google Calendar

---

## Phase 8 — PWA + Polish

### What to build
- PWA manifest and service worker
- iOS home screen meta tags
- Offline shell (Today View cached)
- Visual polish: spacing, typography, transitions
- Final iPhone Safari QA

### Prompt to give Claude Code
```
Make this app a fully installable PWA for iOS Safari.

Add:
- manifest.json with name, short_name, icons (192x192 and 512x512),
  display: standalone, background_color, theme_color
- iOS meta tags: apple-mobile-web-app-capable, apple-mobile-web-app-status-bar-style,
  apple-mobile-web-app-title, apple-touch-icon
- Service worker via next-pwa that caches the app shell for offline use
- "Add to Home Screen" instruction shown once to the user on first visit

Then do a UI polish pass:
- Ensure all tap targets are at least 44x44px (iOS HIG)
- Add page transition animations (slide in/out between routes)
- Smooth loading skeletons everywhere data is fetched
- Check all Hebrew text renders correctly RTL
- Verify nothing overflows on iPhone SE screen width (375px)
```

### ✅ Validation checklist
- [ ] App can be added to iPhone home screen via Safari share sheet
- [ ] Launches in standalone mode (no browser chrome)
- [ ] App icon appears correctly on home screen
- [ ] Status bar color matches app theme
- [ ] Today View loads from cache when offline
- [ ] All tap targets comfortable to tap with thumb
- [ ] Hebrew notes render right-aligned
- [ ] No layout breaks on 375px width
- [ ] Page transitions feel smooth

### 🚦 Ship it when: all boxes checked on a real iPhone

---

## Phase 9 — Morning Invoice Integration

### Goal
Practitioners can send a legally signed invoice to a patient from the Today View.

### Tasks
- [ ] Supabase: create `practitioners` table with Vault-encrypted Morning credential columns
- [ ] Supabase: add `morning_client_id` column to `patients`
- [ ] Supabase: add `price`, `invoice_sent`, `invoice_id` columns to `sessions`
- [ ] Next.js API route: `POST /api/morning/test-connection`
- [ ] Next.js API route: `POST /api/morning/send-invoice` (full flow: token → resolve client → create document → update session)
- [ ] Morning Setup Modal UI (bottom sheet, fields, test button, save)
- [ ] Wire "שלח חשבונית" button on Today View session cards
- [ ] Price prompt when session has no price
- [ ] Success/error toast feedback
- [ ] Session card reflects `invoice_sent` state (button disabled, "נשלחה" label)

### Validation Checklist
- [ ] Credentials save correctly and are encrypted in Vault
- [ ] Test connection button gives clear pass/fail feedback
- [ ] First invoice to a new patient creates them in Morning and caches the ID
- [ ] Second invoice to the same patient uses cached Morning client ID (no duplicate created)
- [ ] Invoice arrives in patient's email from Morning
- [ ] Session card updates to "נשלחה" after success
- [ ] Patient with no email shows correct error
- [ ] All Morning API calls go through server-side routes only (no credentials on client)

### Ship when: all checklist items pass on a real device with a Morning sandbox account

---

## Tips for working with Claude Code

- **One phase at a time.** Don't ask it to build phases 3 and 4 together.
- **Always paste the SPEC.md** at the start of each new Claude Code session so it has full context.
- **If it goes off-track**, paste the relevant phase section and say: "Stick to exactly this, nothing more."
- **For the Calendar OAuth phase** (Phase 6), this is the hardest part. If it gets stuck, come back here and ask for help — the token refresh flow in Next.js + Supabase has some gotchas worth talking through first.
- **Test on a real iPhone** at the end of every phase, not just desktop Chrome.
