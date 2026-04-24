# Messaging & Notifications — Design & Implementation Specification
### For Claude Code · Wellness PWA

---

## 0. Overview

A **messaging system** that sends templated, personalized messages to patients
via **Email** and **WhatsApp** around their sessions. Supports two modes per
template: **auto-send on trigger** or **queue for approval** in the in-app
Notification Center before sending.

### Primary use cases

| Use case | Channel | Timing | Default mode |
|---|---|---|---|
| Pre-session reminder ("your session is tomorrow + how to arrive") | WhatsApp (primary), Email (fallback) | 24h before session start | **Auto-send** |
| Post-session follow-up (plan + homework + book-next-session link) | WhatsApp / Email | 1–2h after session end | **Approval required** (first few) → promoted to auto later |
| Payment reminder (outstanding invoice from Morning) | WhatsApp / Email | 3 days after unpaid invoice | **Approval required** (always) |
| Birthday greeting | WhatsApp | 9:00 on patient birthday | Auto-send |
| "We miss you — come back" (no session in 90d) | WhatsApp / Email | 90d after last session | Approval required |

### Out of scope (this spec)

- Inbound messaging (two-way chat). WhatsApp replies arrive at the
  practitioner's personal number/app, not in the PWA.
- Bulk marketing blasts. One message is tied to one patient and one trigger.
- SMS (Hebrew SMS is expensive and WhatsApp adoption in Israel is ~97%).
- Multi-language template variants. All templates are Hebrew + RTL for MVP.

---

## 1. Design Principles

1. **Never surprise the patient.** The practitioner always controls the content.
   Auto-send is for templates that have been reviewed and proven safe over time.
2. **Never surprise the practitioner.** Every message — even auto-sent — appears
   in the Notification Center with a clear "sent" status.
3. **One screen to review everything.** The Notification Center is the single
   place to approve pending, see sent, and retry failed messages.
4. **Templates are editable in plain language.** No Mustache/Handlebars in the
   UI. Variables are inserted via a "+ Insert field" chip menu.
5. **WhatsApp is expensive and rate-limited.** Every send is logged, retries
   are bounded, and the UI warns before duplicate sends.
6. **Dark theme, mobile-first, RTL.** Consistent with the rest of the app.

---

## 2. Component Reuse — CRITICAL

Before writing any new code, check for existing components.

### Must reuse

| Component | Reuse notes |
|---|---|
| `TopBar` | Back + title + right action (Save / Send now). |
| `ClientBanner` | Add a `variant: 'message'` option (muted, no action chip) for the approval preview screen. |
| `BottomSheet` | For the "+ Insert field" picker and the channel/trigger picker. |
| `FormTextarea` | The body editor is a styled RTL textarea with a live preview area below. |
| `FormLabel` | Field labels in the template builder. |
| Tab bar (bottom nav) | Add a new **"התראות"** (Notifications) tab with a badge for pending approvals. |

---

## 3. Information Architecture

### New routes

```
app/(protected)/
├── notifications/
│   ├── page.jsx                  # Notification Center (list, tabs)
│   └── [id]/page.jsx             # Single message: preview, edit, approve, send
├── templates/
│   ├── page.jsx                  # Template library (list)
│   ├── new/page.jsx              # New template wizard (channel → trigger → builder)
│   └── [id]/page.jsx             # Template builder (edit)
└── settings/
    └── messaging/page.jsx        # WhatsApp/email creds, quiet hours, defaults

app/api/
├── messages/
│   ├── send/route.js             # POST — actually fire the send (WhatsApp/email)
│   ├── approve/route.js          # POST — approve + send a pending message
│   └── reject/route.js           # POST — dismiss a pending message
├── webhooks/
│   ├── whatsapp/route.js         # Delivery receipts from provider
│   └── email/route.js            # Bounces / opens from email provider
└── cron/
    └── evaluate-triggers/route.js  # Scheduled — fans triggers into `messages`
```

### Tab bar update

```
[ Today ]   [ Patients ]   [ Notifications • 3 ]
                                            └── red dot = pending approvals
```

---

## 4. Core Concepts

### 4.1 Template

A reusable blueprint for a message. Has a channel, a trigger config, a body
with merge fields, and an approval mode.

### 4.2 Trigger

A rule that decides *when* a message should be created from a template.
Triggers run on a schedule (cron every 15 min) and on certain events
(session saved, invoice issued).

### 4.3 Message (aka Scheduled Message / Notification)

A concrete instance of a template bound to one patient and one event. Lives
in the `messages` table with a status lifecycle. Every message — auto or
manual — appears in the Notification Center.

### 4.4 Approval Mode

Per template, not per message:

- `auto` — On trigger fire, message is created with status `scheduled` and
  sent at send-time by the cron. A row also appears in the Notification
  Center as "Sent".
- `manual` — On trigger fire, message is created with status `pending_approval`
  and appears in the Notification Center with a red dot. User must tap
  Approve (or Edit → Approve) to send.

---

## 5. Data Model

All tables live in Supabase and use RLS where relevant.

### `message_templates`

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| name | text | Hebrew-friendly, e.g. "תזכורת יום לפני טיפול" |
| channel | text | `whatsapp` \| `email` \| `both` |
| trigger_type | text | See §6 |
| trigger_config | jsonb | Offset, time-of-day, filters (see §6) |
| subject | text | Email subject (null for whatsapp-only) |
| body | text | The template body with `{{merge_fields}}` |
| approval_mode | text | `auto` \| `manual` |
| enabled | boolean | Master on/off |
| quiet_hours_respected | boolean | If true, defer sends during quiet hours |
| whatsapp_template_id | text | Provider template ID (Meta WABA requires pre-approved templates for outbound-initiated) |
| created_at | timestamp | |
| updated_at | timestamp | |

### `messages`

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK |
| template_id | uuid | FK → `message_templates` (nullable for one-off manual sends) |
| patient_id | uuid | FK → `patients` |
| session_id | uuid | FK → `sessions` (nullable, set for session-bound messages) |
| channel | text | `whatsapp` \| `email` (resolved at creation) |
| to_phone | text | Snapshot of patient phone at creation time |
| to_email | text | Snapshot of patient email at creation time |
| rendered_subject | text | Merge-fields expanded |
| rendered_body | text | Merge-fields expanded |
| status | text | See §5.1 |
| scheduled_for | timestamp | When to send (trigger time + template offset) |
| sent_at | timestamp | Nullable |
| delivered_at | timestamp | From webhook |
| read_at | timestamp | From webhook (WhatsApp blue ticks) |
| error_code | text | Nullable |
| error_message | text | Nullable |
| approved_by | uuid | Nullable, FK → `auth.users` (single user — always same but useful for audit) |
| approved_at | timestamp | Nullable |
| retry_count | int | Default 0, max 3 |
| provider_message_id | text | Nullable, for webhook correlation |
| created_at | timestamp | |

### 5.1 `messages.status` lifecycle

```
         ┌──────────────────┐
         │ pending_approval │ ← created from a manual-mode template
         └────────┬─────────┘
        approve  │         │ reject
                 ▼         ▼
         ┌────────────┐  ┌──────────┐
         │ scheduled  │  │ rejected │  (terminal)
         └─────┬──────┘  └──────────┘
        sender│
               ▼
         ┌─────────┐   provider error   ┌────────┐
         │  sent   │ ────────────────▶  │ failed │ ──retry──▶ scheduled
         └────┬────┘                    └────────┘
       webhook│
               ▼
         ┌───────────┐
         │ delivered │
         └─────┬─────┘
       webhook│
               ▼
         ┌──────┐
         │ read │  (terminal)
         └──────┘
```

Auto-mode templates skip `pending_approval` and start at `scheduled`.

### `template_variables` (seed table, not user-editable)

| key | label | example | source |
|---|---|---|---|
| `patient.first_name` | שם פרטי | מיכל | `patients.full_name` split |
| `patient.full_name` | שם מלא | מיכל כהן | `patients.full_name` |
| `session.date_hebrew` | תאריך הטיפול | יום ג׳ 14 אפריל | `sessions.date` formatted |
| `session.time` | שעה | 12:15 | `sessions.date` formatted |
| `session.plan` | תוכנית טיפול | ... | `sessions.plan` (new field? see §11) |
| `session.homework` | שיעורי בית | ... | `sessions.homework` (new field? see §11) |
| `session.number` | מספר טיפול | 6 | `sessions.session_number` |
| `clinic.name` | שם הקליניקה | | `practitioners.clinic_name` |
| `clinic.address` | כתובת | | `practitioners.clinic_address` (new field) |
| `clinic.directions_url` | הוראות הגעה | waze link | `practitioners.directions_url` (new field) |
| `booking.next_session_url` | קישור לקביעת טיפול הבא | | Deep link to booking page (future) or Calendly URL |
| `invoice.amount` | סכום לתשלום | 320 ₪ | From Morning API |
| `invoice.pay_url` | קישור לתשלום | | Morning payment link |

---

## 6. Trigger System

Triggers are evaluated by a cron job (`/api/cron/evaluate-triggers`) every
15 minutes. Each trigger evaluation is **idempotent**: we never create a
duplicate `message` for the same `(template_id, patient_id, session_id, trigger_occurrence)` tuple.

### 6.1 Supported `trigger_type` values

| `trigger_type` | Fires when | Key `trigger_config` keys |
|---|---|---|
| `pre_session` | N hours before a session start | `offset_hours: -24`, `send_time_local: "09:00"` |
| `post_session` | N hours after a session end | `offset_hours: 2` |
| `session_note_saved` | When the practitioner saves a session note | `delay_minutes: 0` |
| `invoice_unpaid` | Invoice from Morning is unpaid after N days | `days_unpaid: 3` |
| `no_session_in` | Patient has no session in N days | `days_silent: 90` |
| `birthday` | Patient's date_of_birth matches today | `send_time_local: "09:00"` |
| `manual` | Never fires automatically; created from patient profile | — |

### 6.2 Trigger evaluation pseudocode

```js
// Simplified. Runs every 15 min.
for (const template of enabledTemplates) {
  const candidates = resolveCandidates(template); // patients × events
  for (const c of candidates) {
    if (await alreadyScheduled(template.id, c.patient_id, c.event_key)) continue;

    const msg = {
      template_id: template.id,
      patient_id: c.patient_id,
      session_id: c.session_id ?? null,
      channel: chooseChannel(template, c.patient),
      rendered_subject: render(template.subject, c),
      rendered_body: render(template.body, c),
      scheduled_for: computeSendTime(template, c),
      status: template.approval_mode === 'auto' ? 'scheduled' : 'pending_approval',
    };
    await insertMessage(msg);
  }
}
```

### 6.3 Quiet hours

Stored on `practitioners` (new fields `quiet_start_local`, `quiet_end_local`,
default 21:00–08:00). If `template.quiet_hours_respected` and the computed
`scheduled_for` falls inside quiet hours, the send is shifted to the next
`quiet_end`.

---

## 7. UI — Template Library

Route: `app/(protected)/templates/page.jsx`

```
┌───────────────────────────────────────────┐
│  תבניות הודעות                       ＋   │  ← top bar; + opens new-template wizard
├───────────────────────────────────────────┤
│  ┌─ תזכורת יום לפני טיפול ─────────────┐ │
│  │ WhatsApp · 24 שעות לפני · אוטומטי  │ │  ← status chips
│  │ ■ פעיל                              │ │
│  └──────────────────────────────────────┘ │
│  ┌─ סיכום אחרי טיפול ──────────────────┐ │
│  │ WhatsApp · שעתיים אחרי · דורש אישור │ │
│  │ ■ פעיל                              │ │
│  └──────────────────────────────────────┘ │
│  ┌─ תזכורת תשלום ──────────────────────┐ │
│  │ Email · 3 ימים · דורש אישור         │ │
│  │ ■ פעיל                              │ │
│  └──────────────────────────────────────┘ │
└───────────────────────────────────────────┘
```

Each card shows: name, channel icon, trigger summary, approval mode, enabled
toggle. Tap opens the builder.

---

## 8. UI — Template Builder

Route: `app/(protected)/templates/[id]/page.jsx`

Single scrollable screen. Top bar: **"בטל"** / title / **"שמור"**.

### Sections (top to bottom)

1. **שם התבנית** — plain text input.
2. **ערוץ** — segmented control: `WhatsApp` · `Email` · `שניהם`.
3. **טריגר** — a card that opens a bottom sheet. Summary line shows the
   current config in plain Hebrew, e.g. "24 שעות לפני טיפול · שליחה ב-09:00".
4. **נושא** (email only) — single line text input.
5. **גוף ההודעה** — large RTL textarea with a floating toolbar above:
   `[+ הוסף שדה] [B] [I]` (WhatsApp supports `*bold*` and `_italic_`).
   Tapping **+ הוסף שדה** opens a bottom sheet listing merge fields
   grouped by category (פרטי מטופל / פרטי טיפול / קליניקה / תשלום).
   Selecting a field inserts `{{patient.first_name}}` at the cursor.
   In the editor, merge fields render as soft blue pills (not raw `{{}}`).
6. **תצוגה מקדימה** — live preview card that renders the body with a
   sample patient ("דוגמה: מיכל · טיפול 6 · יום ג׳ 14 אפריל"). For
   WhatsApp, the preview uses the familiar WhatsApp green bubble look.
7. **מצב אישור** — toggle group:
   - `אוטומטי` — "נשלח מיידית כשהתנאי מתקיים"
   - `דורש אישור` — "יופיע במרכז ההתראות לאישור לפני שליחה"
   With a warning icon next to Auto: "לא מומלץ לתבניות שקשורות בכסף".
8. **שמירה של שעות שקט** — toggle, default on.
9. **פעיל** — master on/off toggle.
10. **מחק תבנית** — destructive, at the very bottom.

### Validation

- Cannot save with unresolved merge fields that aren't in the seed list.
- WhatsApp: body must be < 1024 chars.
- If channel includes WhatsApp and trigger is outside the 24h customer-care
  window (i.e. conversation-initiated), require `whatsapp_template_id` to
  be filled in (Meta WABA rule — see §10.2).
- Warn if approval_mode is `auto` and the body contains words like "תשלום",
  "חשבונית", "חוב".

---

## 9. UI — Notification Center

Route: `app/(protected)/notifications/page.jsx`

```
┌───────────────────────────────────────────┐
│  התראות                                    │
├───────────────────────────────────────────┤
│ [ ממתינות (3) ] [ נשלחו ] [ נכשלו (1) ]   │  ← segmented tabs
├───────────────────────────────────────────┤
│  ● מיכל כהן — סיכום אחרי טיפול            │  ← red dot = pending
│    יישלח ב-18:00 · WhatsApp                │
│  ────────────────────────────────────────  │
│  ● יוסי לוי — תזכורת תשלום                │
│    יישלח עכשיו · Email                    │
│  ────────────────────────────────────────  │
│  ● דנה אבני — סיכום אחרי טיפול            │
│    יישלח ב-19:30 · WhatsApp                │
└───────────────────────────────────────────┘
```

### Tabs

- **ממתינות (Pending)** — `status = pending_approval`. Count shown.
- **נשלחו (Sent)** — `status ∈ {scheduled, sent, delivered, read}`.
- **נכשלו (Failed)** — `status = failed`. Count shown.

Tapping a row opens the single-message screen.

### Single message screen — `notifications/[id]/page.jsx`

```
┌───────────────────────────────────────────┐
│  ← חזור   סיכום אחרי טיפול    ⋯           │
├───────────────────────────────────────────┤
│  ┌─ מיכל כהן · WhatsApp ───────────────┐ │
│  │ → 052-xxx-xxxx                       │ │  ← ClientBanner variant="message"
│  └──────────────────────────────────────┘ │
│                                            │
│  ┌─ תצוגה ─────────────────────────────┐ │
│  │ ┌─ WhatsApp bubble ────────────────┐ │ │
│  │ │ היי מיכל! תודה על הטיפול היום.   │ │ │
│  │ │ זכרי להמשיך עם תרגילי הנשימה    │ │ │
│  │ │ פעמיים ביום.                      │ │ │
│  │ │ לקביעת טיפול הבא: https://...    │ │ │
│  │ └──────────────────────────────────┘ │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  [  ערוך  ]   [  דחה  ]   [  שלח עכשיו  ] │
└───────────────────────────────────────────┘
```

### Actions (pending)

- **שלח עכשיו** (primary) — writes `approved_at`, `approved_by`, flips
  status to `scheduled`, triggers immediate send via `/api/messages/send`.
- **ערוך** — opens the rendered body in an editor. Saves as a
  one-off override on the message row (template is not changed).
- **דחה** — status → `rejected`.

### Actions (sent)

- Read-only. Shows timestamps: Sent / Delivered / Read.
- **שלח שוב** option (creates a *new* message row, does not reuse).

### Actions (failed)

- **נסה שוב** — manual retry. Increments `retry_count` (up to 3).
- Error reason shown inline ("מספר טלפון לא תקין", "WhatsApp טמפלייט לא אושר").

---

## 10. Integrations

### 10.1 Email — Resend (recommended)

- Single transactional email provider. Domain verified once.
- SDK: `resend` npm package.
- Send flow: `POST /api/messages/send` → `resend.emails.send({from, to, subject, html})`.
- Webhook: `/api/webhooks/email` consumes `email.delivered`, `email.bounced`,
  `email.opened`. Updates `messages.delivered_at`, `messages.status`.

**Why Resend?** Cheapest for low volume (free tier covers MVP), clean API,
works with any domain.

### 10.2 WhatsApp — Meta WhatsApp Business Cloud API

There are three realistic paths; recommend #1 for the long term, but call
out #2 as a faster first step.

| Option | Pros | Cons |
|---|---|---|
| **1. Meta WABA Cloud API (direct)** | No middleman, Meta-official, ~$0.03–0.08 per conversation in IL | Requires business verification; templates must be pre-approved for outbound-initiated messages |
| **2. Twilio WhatsApp** | Simplest SDK, sandbox for dev | ~2× the per-message cost of direct Meta; still requires Meta-approved templates |
| **3. MessageBird / 360dialog / Vonage** | Similar to Twilio | Same template approval still required |

**Key rule for all paths:** Meta distinguishes two kinds of outbound messages:

- **Inside the 24h customer-care window** (patient wrote to you within 24h):
  any freeform message allowed.
- **Outside the 24h window** (the vast majority of our use cases — patient
  hasn't just written): only pre-approved **Message Templates** (utility,
  authentication, or marketing category). Templates are submitted to Meta
  and approved in minutes to hours.

**Implication for this spec:** Every `message_template` with channel=whatsapp
must map to a Meta-approved template ID (`whatsapp_template_id`). The body
on our side is a rendered version of that same template. We store both.

Required new env vars:

- `WHATSAPP_PROVIDER` — `meta` \| `twilio`
- `WHATSAPP_PHONE_ID` — Meta
- `WHATSAPP_ACCESS_TOKEN` — Meta
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` — Meta

Webhook: `/api/webhooks/whatsapp` processes `messages.status` events
(`sent`, `delivered`, `read`, `failed`) and updates `messages` by
`provider_message_id`.

### 10.3 Morning (Green Invoice) — for payment messages

Already integrated per `SPEC.md`. The `invoice_unpaid` trigger calls
Morning's API every 15 min, cross-references with our `patients` table,
and creates messages for any invoice that is > N days unpaid.

---

## 11. Dependencies on Other Features

### New fields needed on existing tables

`sessions` — add:
- `plan` text — captured in Session Note screen (currently lives in `notes`).
- `homework` text — captured in Session Note screen.

These fields already exist conceptually but aren't structured. We need them
structured so the post-session template can render them. Low effort update to
`SESSION_NOTE_SPEC.md`.

`practitioners` — add:
- `clinic_address` text
- `directions_url` text — Waze or Google Maps link
- `quiet_start_local` time, default `21:00`
- `quiet_end_local` time, default `08:00`
- `booking_url` text — for `{{booking.next_session_url}}`; initially Calendly

`patients` — add:
- `whatsapp_opt_in` boolean, default `true` but with a settings toggle per
  patient on the profile screen. Legal cover + practical courtesy.
- `email_opt_in` boolean, default `true`.

### Patient profile screen

Add a "הודעות" section with:
- WhatsApp opt-in toggle
- Email opt-in toggle
- A "שלח הודעה ידנית" button — opens a template picker → message builder
  → creates a message with `trigger_type = manual`.

---

## 12. Security & Privacy

1. **Patient data never leaves Supabase except as rendered message text.**
   No PII in webhook payloads we log.
2. **Opt-out handling.** If a patient replies "הסר" / "STOP" to a WhatsApp
   message, the webhook catches it and flips `whatsapp_opt_in = false`.
   Future sends for that patient are blocked at the evaluator.
3. **Rate limiting at the API layer.** `/api/messages/send` is rate-limited
   to prevent runaway loops (e.g. 60 sends / 5 min).
4. **Audit trail.** Every status transition on a `message` row writes to an
   append-only `message_events` table: `(message_id, event, actor, at, meta)`.
5. **Approval is logged.** `approved_by` + `approved_at` are always set for
   manual-mode sends. Even in a single-user app this matters for future
   disputes with patients.
6. **Soft deletes.** Deleting a patient soft-deletes their messages but
   keeps the audit trail for 2 years.

---

## 13. Error Handling & Edge Cases

| Case | Behavior |
|---|---|
| Patient has no phone and template is whatsapp | `status = failed`, `error_code = no_destination` |
| Patient has no email and template is email | Same |
| Patient `whatsapp_opt_in = false` | Message is **not created**. Evaluator skips. |
| Session cancelled after a `pre_session` message was already queued (status `scheduled`) | Cron checks session still exists + not cancelled at send-time. If not, mark `rejected` with reason `session_cancelled`. |
| Duplicate trigger evaluation | Idempotency key `(template_id, patient_id, session_id, trigger_occurrence)` enforced by unique index. |
| WhatsApp template not approved | Send fails with `error_code = template_not_approved`. Surface in Failed tab with a "Go to template settings" link. |
| Provider outage | Message stays `scheduled`. Exponential backoff, max 3 retries. After 3, `failed`. |
| Patient's phone number changed between creation and send | Snapshot on `messages.to_phone` wins. The practitioner sees the snapshot in the message detail screen. A small "Phone number has changed since scheduling" warning appears if current ≠ snapshot. |

---

## 14. MVP Phasing

### Phase 1 — Foundation (ship first)

- `message_templates`, `messages` tables + RLS.
- Template Library screen (read-only list, create/edit via DB only).
- Two seed templates: pre-session reminder (auto), post-session follow-up (manual).
- Email channel via Resend.
- Manual "send test" button in template detail, no triggers yet.
- Notifications tab, Pending / Sent tabs only.

### Phase 2 — Approval flow + cron

- `/api/cron/evaluate-triggers` running every 15 min (Vercel Cron).
- `pre_session` and `post_session` triggers only.
- Approval + Reject + Edit actions in Notification Center.
- Notifications tab badge count.

### Phase 3 — WhatsApp

- Meta WABA integration (sandbox first, then production).
- WhatsApp template submission flow in the builder.
- Webhook handler for delivery receipts.

### Phase 4 — Template builder UI

- Full in-app template creation / editing.
- Live preview.
- Merge-field chip picker.

### Phase 5 — Advanced triggers

- `invoice_unpaid`, `no_session_in`, `birthday`.
- Per-patient opt-out handling.
- Audit log screen.

### Phase 6 — Polish

- Quiet hours.
- Retry controls.
- Message events drill-down.
- Analytics (delivery rate, read rate per template).

---

## 15. Open Questions for the PO

1. **Booking link source.** For MVP do we use Calendly (external) or build
   a self-serve booking page inside the PWA? The former is faster; the
   latter is more on-brand.
2. **Who approves after-hours approvals?** If the practitioner is asleep at
   23:00 when a `post_session` message is queued, do we:
   (a) leave it pending until morning,
   (b) auto-send the next morning,
   (c) auto-send at a clamped time (e.g. always at 20:00 for same-day)?
   Recommendation: (c), clamped to 20:00.
3. **WhatsApp template language.** All templates Hebrew only for v1, or
   Hebrew + English fallback for tourists / English-speaking patients?
4. **Edit-before-send — save back to template?** When the practitioner edits
   a pending message, should the app offer "save this change to the template
   for next time"? Recommendation: yes, as a soft prompt.
5. **Group sessions.** Any session with > 1 patient? If yes, a single
   trigger must fan out to N messages. Not in MVP.
6. **Two-way replies.** When a patient replies to a WhatsApp message, we
   currently drop it (it goes to the practitioner's personal WhatsApp).
   Long-term, should we mirror replies into the PWA? Recommendation: not
   MVP, but track this as a Phase 7.

---

## 16. Success Metrics

Track these in Supabase with simple views:

| Metric | Target (90 days post-launch) |
|---|---|
| % of sessions that sent a pre-session reminder | > 95% |
| Pre-session reminder → no-show rate | -30% vs baseline |
| Post-session messages sent | > 80% of completed sessions |
| Approval latency (pending → sent) | median < 4h |
| Messages edited before approval | < 20% (signal that templates are good) |
| Delivery rate (WhatsApp) | > 98% |
| Bounce rate (Email) | < 2% |
| Patient opt-out rate | < 1% |

---

## 17. Summary of New Files to Build (when Claude Code is told to build)

```
app/(protected)/notifications/page.jsx
app/(protected)/notifications/[id]/page.jsx
app/(protected)/templates/page.jsx
app/(protected)/templates/new/page.jsx
app/(protected)/templates/[id]/page.jsx
app/(protected)/settings/messaging/page.jsx

app/api/messages/send/route.js
app/api/messages/approve/route.js
app/api/messages/reject/route.js
app/api/webhooks/whatsapp/route.js
app/api/webhooks/email/route.js
app/api/cron/evaluate-triggers/route.js

components/MessageTemplateCard.jsx
components/MessageTemplateBuilder.jsx
components/MergeFieldPicker.jsx
components/WhatsAppPreviewBubble.jsx
components/EmailPreviewCard.jsx
components/NotificationRow.jsx
components/NotificationTabs.jsx
components/TriggerConfigSheet.jsx
components/ChannelPicker.jsx

lib/messaging/render.js          # merge-field expansion
lib/messaging/triggers.js        # trigger evaluators
lib/messaging/providers/whatsapp.js
lib/messaging/providers/email.js
lib/messaging/quietHours.js

supabase/migrations/2026xxxx_messaging.sql
```

---

*End of spec.*
