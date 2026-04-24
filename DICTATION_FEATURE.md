# DICTATION_FEATURE.md
## Phase 10 — AI Voice Dictation → Session Note Autofill

This file specifies the full implementation of the voice dictation feature for `SessionNoteDrawer.js`. Read it completely before writing any code. When implementation is complete, update `SPEC.md` and `BUILD_PLAN.md` as instructed at the bottom of this file.

---

## Overview

The practitioner can dictate a free-form Hebrew summary of a treatment session. The app records audio, sends it to Gemini 2.0 Flash (via a server-side API route), and automatically populates the session note fields from the AI-structured response. Fields are pre-filled but fully editable before saving.

**Scope: `SessionNoteDrawer.js` only.** Do not touch the intake form, patient profile, today view, or any other component. Do not change any existing save logic, field validation, or database write behavior.

---

## 1. Privacy — No PHI sent to Gemini

**This is a hard requirement.** The Gemini API is a third-party service. No personally identifiable information (PHI) about the patient may be included in any request sent to it.

### What must never be sent to Gemini
- Patient name
- Patient email
- Patient phone number
- Patient date of birth or age
- Any field from the `patients` table that could identify an individual
- The `session_id`, `patient_id`, or any database ID

### What is permitted to send
- The audio blob (contains only the practitioner's own voice describing clinical observations — no patient identifiers are expected or required in the dictation)
- The patient's **chief complaint** as plain clinical text (e.g. "כאב גב תחתון") — this is a symptom description, not an identifier
- The practitioner's formula preset names (user-defined clinical vocabulary, no patient data)

### Implementation rules
- The API route (`/api/ai/dictate-note`) must accept **only** the three fields listed in the request spec below: `audio`, `chiefComplaint`, and `formulas`
- The client (`SessionNoteDrawer.js`) must **not** pass patient name, email, ID, or any other identifying field to this route — not even as a convenience for logging
- Server-side: do not log the request body, the chief complaint, or any field that could be traced back to a patient
- If you find yourself needing patient context beyond chief complaint to improve AI output quality, **stop and consult** — do not add new fields to the request without reviewing this constraint first

---

## 2. New environment variable (renumbered — was §1)

Add to `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

Add `GEMINI_API_KEY` to your Vercel/production environment variables. The key must never appear in any client-side file.

---

## 3. New API route: `POST /api/ai/dictate-note`

File: `app/api/ai/dictate-note/route.js`

### Request
`multipart/form-data` with two fields:
- `audio` — the recorded audio blob (WebM/Opus or MP4/AAC)
- `chiefComplaint` — string, the patient's chief complaint (may be empty string)
- `formulas` — JSON string array of the practitioner's existing formula preset names (for vocabulary context)

### Behavior

1. Read the audio file from the form data and convert to base64.
2. Call the Gemini 2.0 Flash API (`gemini-2.0-flash` model) with:
   - The audio as an inline base64 part
   - A system instruction (see prompt below)
   - A user text part with the chief complaint and formula list for context
3. Parse the JSON response.
4. **Discard the audio immediately** — do not log it, store it, or retain it anywhere after the API call completes. Clinical audio is sensitive data.
5. Return the parsed JSON to the client.

### Gemini system prompt (Hebrew)

```
אתה עוזר קליני לרופא/ת רפואה סינית, דיקור ושיאצו.
קיבלת הקלטת שמע בעברית של סיכום טיפול שנאמר בקול חופשי על ידי המטפל/ת.
המשימה שלך: לחלץ מהדיקטציה את המידע הקליני הרלוונטי ולארגן אותו בשדות המתאימים.

החזר אך ורק JSON תקני, ללא הסבר, ללא markdown, ללא גרשיים כפולים מיותרים, בפורמט הבא:
{
  "client_report": "...",
  "tongue_and_pulse": "...",
  "treatment_done": "...",
  "treatment_plan": "...",
  "homework": "...",
  "formulas": []
}

כללים:
- אל תמציא מידע שלא הוזכר בהקלטה.
- שדה שלא הוזכר כלל יקבל ערך null — לא מחרוזת ריקה.
- formulas הוא מערך של שמות פורמולות בלבד (מחרוזות קצרות). השתמש אך ורק בשמות המדויקים מהרשימה שסופקה. אם פורמולה הוזכרה אך לא נמצאת ברשימה — אל תכלול אותה במערך.
- כתוב את כל הטקסט בעברית.
- אל תכלול שום דבר מחוץ ל-JSON.
```

User text part to include in the request:
```
התלונה העיקרית של המטופל/ת: {chiefComplaint}
רשימת פורמולות קיימות: {formulas joined by ", "}
```

### Response shape returned to client

```json
{
  "client_report": "string or null",
  "tongue_and_pulse": "string or null",
  "treatment_done": "string or null",
  "treatment_plan": "string or null",
  "homework": "string or null",
  "formulas": ["string", ...] // may be empty array
}
```

### Error handling (server-side)

- If Gemini returns malformed JSON or an unexpected structure: return HTTP 500 with `{ error: "parse_error" }`
- If the Gemini API call fails (network, quota, etc.): return HTTP 500 with `{ error: "gemini_error" }`
- If the audio field is missing or empty: return HTTP 400 with `{ error: "no_audio" }`

---

## 4. Changes to `SessionNoteDrawer.js`

### 3a. Sticky bottom bar

The existing Save button must become part of a **sticky bottom bar** that is always visible regardless of scroll position. This bar contains two elements side by side:

- **Left (in RTL: visually right):** the dictation icon button (46×46px, described below)
- **Right (in RTL: visually left):** the Save button (flex: 1, fills remaining width)

The bar has a top border (`0.5px solid #E4DDD3`), background `#F5F0E8`, padding `10px 14px 12px`, and sits flush at the bottom of the drawer at all times.

**If a sticky Save button already exists in the drawer, modify it in place. Do not add a second Save button.**

### 3b. Dictation button — four states

The dictation button occupies the fixed 46×46px slot in the sticky bar. It transitions through four states controlled by a `dictationState` variable: `'idle' | 'recording' | 'processing' | 'done'`.

**State: `idle`**
- 46×46px square button, `border-radius: 12px`, border `1.5px solid #C0BBB4`, transparent background
- Microphone SVG icon (20×20px) centered
- Small circular badge (14×14px) in the top-left corner: background `#FA523C`, contains a `✦` sparkle in white at 8px — this signals "AI-powered"
- Tapping triggers microphone permission request then starts recording

**State: `recording`**
- The 46×46px button slot is replaced by an expanded recording bar that takes up the full left portion of the sticky bar
- This expanded area contains (RTL order, right to left visually): pulsing red dot (9px, animated) + live elapsed timer (`0:00` format, tabular nums, `#C02020`, 15px/500)
- To the right of the expanded area: **pause button** (46×46px, border `1.5px solid #E03030`, background `#FFF0F0`, two vertical bar rectangles in `#E03030`)
- To the right of pause: **stop button** (46×46px, border `1.5px solid #E03030`, background `#E03030`, white square icon inside)
- Save button shrinks to `max-width: 70px` and is `opacity: 0.3`, `pointer-events: none`
- Timer counts up from 0:00 using `setInterval` every second
- At 4:00 (240 seconds), recording stops automatically as if stop was tapped
- Pause button toggles between paused/recording: when paused, dot stops pulsing, timer freezes, MediaRecorder is paused
- Stop button ends recording and triggers processing

**State: `processing`**
- The dictation slot shows only a spinner (18×18px, border `2px solid #D4CBBF`, top color `#FA523C`, rotating)
- No text
- Save button remains dimmed (`opacity: 0.3`, `pointer-events: none`)

**State: `done`**
- The dictation slot shows a green checkmark button (46×46px, border `1.5px solid #7AB870`, background `#EEF7EC`, checkmark SVG path in `#4A8A40`)
- Tapping the green checkmark resets state to `idle` — allowing re-dictation
- Save button is fully active
- A small hint line appears **above the sticky bar** (just below the last form field, or above the bar border): `✦ הופק מהכתבה` in 10px, color `#8A6A9A`, right-aligned

### 3c. Recording implementation

Use the `MediaRecorder` API. Request `audio/webm;codecs=opus`; if not supported, fall back to `audio/mp4`.

```js
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
```

Request mic permission only when the idle button is tapped — not on drawer open, not on component mount.

Collect chunks with `ondataavailable` into an array. On stop, assemble into a single `Blob`.

**Screen Wake Lock:** Acquire `navigator.wakeLock.requestWakeLock('screen')` immediately when recording starts. Release it when recording stops (both manual stop and 4-minute auto-stop). Wrap in try/catch — if Wake Lock is unsupported, fail silently and continue.

**visibilitychange handling:** If the user switches apps mid-recording (`document.visibilityState === 'hidden'`), pause the MediaRecorder automatically and set state to a paused variant. When visibility returns (`'visible'`), do not auto-resume — leave in paused state so she must consciously tap to continue.

### 3d. Field population logic

After a successful API response, iterate over the six fields. For each field:

**If the API returned `null` for that field:** leave the existing field value untouched.

**If the API returned a non-null string:**
- If the existing field value is empty/null: set it directly to the AI value.
- If the existing field value already has content: **append** with a line break separator: `existingValue + "\n" + aiValue`

**For `formulas`:**
- The drawer already has a `FormulaField` component with a selected formulas state.
- Match each returned formula name against the practitioner's existing `formula_presets` (case-insensitive).
- For exact or case-insensitive matches: add them to the selected formulas set.
- For non-matching names: **silently ignore them.** Do not add unrecognized formulas, do not create new presets, do not surface any indication to the user that a formula was mentioned but not found.
- Append to any already-selected formulas; do not replace.

### 3e. Field highlight on populate

When fields are populated by AI, apply a brief background highlight to each field that received new content:

- Immediately after population: set a CSS class (e.g. `ai-highlight`) on the textarea/field wrapper that sets background to `#FEF9EC` (warm amber tint)
- After 3 seconds: remove the class so the background fades back to white
- Use a CSS transition: `background-color 0.6s ease` on the field wrapper
- Fields that received `null` (were not changed) should not be highlighted

### 3f. Error toasts

Use whatever existing toast/notification pattern is already in the codebase. If none exists, use a simple fixed-position toast at the top of the drawer.

| Scenario | Message |
|---|---|
| Mic permission denied | `לא ניתן לגשת למיקרופון — בדקי הגדרות הרשאות` |
| Recording blob is empty or < 1 second | `ההקלטה קצרה מדי — נסי שוב` — do not send to API |
| API returns any error | `לא הצלחנו לעבד את ההקלטה — נסי שוב` — form fields remain untouched, state resets to `idle` |

---

## 5. What not to change

- Do not modify any existing save logic in `SessionNoteDrawer.js`
- Do not modify `handleSave`, the upsert logic, or anything that writes to Supabase
- Do not modify `PhotoAttachment.js`, `FormulaField.js`, `FormTextarea.js`, or any other shared component
- Do not modify the intake form (`app/(protected)/intake/page.js`)
- Do not modify `SPEC.md` or `BUILD_PLAN.md` until implementation is complete (see section 5)
- Do not add new Supabase columns or migrations — dictation output goes into existing note fields only

---

## 6. After implementation: update the source-of-truth files

Once all checklist items below pass, make the following updates:

### `SPEC.md`
- Add a row to the tech stack table: `AI Dictation | Gemini 2.0 Flash (Google)`
- Add `GEMINI_API_KEY` to the environment variables section
- Under the SessionNoteDrawer screen description, add: "Bottom sticky bar contains a Save button and a dictation icon button. Tapping the dictation button records audio, sends to `/api/ai/dictate-note`, and auto-populates note fields."

### `BUILD_PLAN.md`
Append the following as Phase 10:

```
## Phase 10 — AI Voice Dictation for Session Notes

### Goal
Practitioner can dictate a free-form Hebrew session summary and have AI populate the session note fields automatically.

### Tasks
- [ ] Add GEMINI_API_KEY to .env.local and production environment
- [ ] Create POST /api/ai/dictate-note route (Gemini 2.0 Flash, server-side only)
- [ ] Make Save button part of a sticky bottom bar in SessionNoteDrawer
- [ ] Add dictation icon button (46×46px) to sticky bar
- [ ] Implement four-state button: idle → recording → processing → done
- [ ] MediaRecorder audio capture (WebM/Opus with MP4 fallback)
- [ ] Screen Wake Lock during recording
- [ ] visibilitychange pause handling
- [ ] 4-minute auto-stop
- [ ] Field population logic: null = skip, existing content = append with line break
- [ ] Formula matching against existing presets
- [ ] 3-second highlight fade on AI-populated fields
- [ ] Error toast handling (mic denied, too short, API error)

### Validation Checklist
- [ ] Tapping idle button requests mic permission (not before)
- [ ] Timer counts up correctly during recording
- [ ] Pause/resume works — timer freezes when paused
- [ ] Stop at 4 minutes triggers processing automatically
- [ ] Switching apps mid-recording pauses; does not auto-resume on return
- [ ] Screen does not auto-lock during recording
- [ ] API key never appears in any client-side file or network request from browser
- [ ] Audio blob is not logged or stored server-side after Gemini call
- [ ] Patient name is not sent to Gemini — confirm by inspecting the request payload in network tab
- [ ] Patient email is not sent to Gemini
- [ ] No patient IDs (patient_id, session_id) are sent to Gemini
- [ ] Server-side route does not log request body or chief complaint
- [ ] Fields with content get AI output appended, not overwritten
- [ ] Fields the AI returned null for are left untouched
- [ ] AI-populated fields show highlight fade (3 seconds)
- [ ] Formula names match existing presets case-insensitively
- [ ] All three error toasts display correctly
- [ ] Green checkmark tapped → resets to idle state correctly
- [ ] Tested on real iOS device (Safari PWA)

### Ship when: all checklist items pass on a real iOS device
```

---

## Notes for Claude Code

- This is a Next.js 14 App Router project in **plain JavaScript (not TypeScript)**. Do not add type annotations.
- The project is Hebrew RTL throughout. Any new UI text must be in Hebrew.
- Follow the existing design system: background `#F5F0E8`, white cards, `#FA523C` accent, Rubik font for UI text.
- Do not introduce any new npm packages without confirming first. The Gemini API call should use native `fetch` — no SDK needed.
- The sticky bar is the only structural change to the drawer layout. Everything else (sections, fields, formula picker, photo attachment) stays exactly as-is.
