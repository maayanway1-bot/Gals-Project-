# Morning Invoice Integration — Amendment Spec

This file describes the Morning (Green Invoice) invoicing integration to be added to the app.

**After implementing everything in this file, update `SPEC.md` and `BUILD_PLAN.md` so they remain the single source of truth. Specific instructions for what to update in each file are at the bottom.**

---

## Overview

Practitioners can send a legally signed invoice to a patient directly from the app by tapping "שלח חשבונית" on a session card in the Today View. The invoice is issued from the practitioner's own Morning (Green Invoice) account and emailed to the patient automatically by Morning.

---

## External Service: Morning (Green Invoice) API

- **Production base URL:** `https://api.greeninvoice.co.il/api/v1`
- **Sandbox base URL:** `https://sandbox.greeninvoice.co.il/api/v1`
- **Auth:** JWT Bearer token, obtained by POSTing API key credentials
- **Credentials source:** Each practitioner's own Morning account → Settings → Developer Tools → API Keys

---

## Data Model Changes

### `practitioners` table (new)
One row per authenticated user. Created on first login if it doesn't exist.

| Field | Type | Notes |
|---|---|---|
| id | uuid | PK, FK → auth.users |
| full_name | text | |
| clinic_name | text | |
| morning_api_key_id | text | Encrypted via Supabase Vault |
| morning_api_key_secret | text | Encrypted via Supabase Vault |
| created_at | timestamp | |

### `patients` table (update existing)
Add one column:

| Field | Type | Notes |
|---|---|---|
| morning_client_id | text | Nullable. Morning's own ID for this patient, cached after first invoice. |

---

## Morning Credentials Setup — Lazy Flow

There is **no onboarding wizard**. Credentials are collected the first time they are needed.

**Trigger:** Practitioner taps "שלח חשבונית" on any session card.

**Flow:**
1. App checks if `practitioners.morning_api_key_id` exists for this user
2. **If yes** → proceed directly to invoice flow (see below)
3. **If no** → show the Morning Setup Modal before proceeding

### Morning Setup Modal
A bottom sheet modal with:
- Short explanation: "כדי לשלוח חשבוניות, יש לחבר את חשבון המורנינג שלך"
- Link / instruction telling the practitioner where to find their API keys in Morning (Settings → Developer Tools → API Keys)
- Two fields: **Key ID** and **Secret**
- **"בדוק חיבור"** button — calls `POST /account/token` with the entered credentials
  - On success: show green confirmation, enable the save button
  - On failure: show clear error message, let them retry
- **"שמור ושלח"** button (enabled only after successful test)
- On save: credentials stored encrypted in Supabase Vault → proceed to invoice flow

---

## Invoice Flow

Triggered after credentials are confirmed to exist.

### Step 1 — Resolve Morning Client ID
```
Check patients.morning_client_id
  ├── EXISTS → use it, skip to Step 2
  └── NULL →
        Search Morning: GET /clients/search?q={patient.email}
          ├── FOUND → save returned ID to patients.morning_client_id, proceed
          └── NOT FOUND →
                Create client: POST /clients { name, email, phone }
                Save returned ID to patients.morning_client_id, proceed
```

> ⚠️ Patient email is required for this flow. If a patient has no email in the DB, show an inline error: "לא קיים מייל עבור מטופל זה. יש להוסיף מייל בפרופיל המטופל לפני שליחת חשבונית."

### Step 2 — Create Invoice
```
POST /documents
{
  "type": 320,           // חשבונית מס קבלה — combined invoice + receipt, correct for עוסק מורשה who collects payment at time of service
  "lang": "he",
  "currency": "ILS",
  "vatType": 0,          // Morning applies correct VAT automatically
  "client": {
    "id": "{morning_client_id}"
  },
  "income": [
    {
      "description": "טיפול דיקור",
      "quantity": 1,
      "price": {session_price}   // see Session Price section below
    }
  ]
}
```

Morning automatically emails the signed invoice to the patient.

### Step 3 — Update Session Record
After successful invoice creation, update the session in Supabase:
- `invoice_sent: true`
- `invoice_id: {returned document ID from Morning}`

### Step 4 — UI Feedback
- Session card status changes from plum ("נדרשת חשבונית") to a neutral/resolved state
- Brief success toast: "החשבונית נשלחה בהצלחה ✓"

---

## Session Price

The invoice needs a price. Handle as follows:
- Add `price` (integer, ILS, nullable) field to the `sessions` table
- When "שלח חשבונית" is tapped, if `session.price` is null → show a simple prompt asking for the amount before proceeding
- Once entered, save to `sessions.price` and continue
- If `session.price` already exists → use it silently, no prompt

---

## Token Management

- JWT tokens from Morning expire periodically
- Cache the token in memory (or a short-lived server-side store) with its expiry timestamp
- Before each Morning API call, check if the cached token is still valid
- If expired or missing → re-authenticate automatically using stored credentials
- Never expose credentials or tokens to the client side — all Morning API calls must go through a Next.js API route

---

## Error Handling

| Scenario | User-facing message |
|---|---|
| Wrong API credentials | "פרטי ה-API שגויים. יש לבדוק את המפתחות בחשבון המורנינג." |
| Patient has no email | "לא קיים מייל עבור מטופל זה. יש להוסיף מייל בפרופיל המטופל." |
| Morning API unreachable | "לא ניתן להתחבר למורנינג כרגע. יש לנסות שוב." |
| Invoice already sent | Disable the button, show "נשלחה" label |

---

## Multi-Practitioner Architecture

This integration is built multi-practitioner-ready from day one:
- Each practitioner has their own row in `practitioners` with their own Morning credentials
- All Morning API calls are scoped to the authenticated user's credentials
- `patients.morning_client_id` is scoped per practitioner (if the same patient sees two practitioners, each practitioner creates/caches their own Morning client ID for that patient — consider making `morning_client_id` a separate join table `practitioner_patients` in the future if needed)
- Practitioners join via self sign-up (Supabase Auth)
- No shared credentials anywhere

---

## New API Routes (Next.js)

| Route | Method | Purpose |
|---|---|---|
| `/api/morning/test-connection` | POST | Validate API key pair, return success/failure |
| `/api/morning/send-invoice` | POST | Full invoice flow: resolve client → create document |

Both routes must:
- Authenticate the calling user via Supabase session
- Fetch that user's Morning credentials from Supabase Vault
- Never return raw credentials in the response

---

## Updates Required to Existing Files

### `SPEC.md`
After implementing, make the following updates to `SPEC.md`:

1. **Data Model section** — add the `practitioners` table and add `morning_client_id` + `price` columns to the relevant tables
2. **Screens section** — add description of the Morning Setup Modal under a new "Invoice Setup" subsection
3. **Today View screen description** — note that session cards with `invoice_sent: false` show a "שלח חשבונית" CTA (plum color, `#6a4888`)
4. **Remove** "Payments / receipts" from the Out of Scope / v2 list — it is now in scope
5. **Add** a new top-level section: **"Invoicing"** describing the Morning integration, lazy setup flow, and client matching strategy
6. **Tech Stack table** — add row: `Invoicing | Morning (Green Invoice) API`

### `BUILD_PLAN.md`
After implementing, append the following as **Phase 9**:

```
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
```
