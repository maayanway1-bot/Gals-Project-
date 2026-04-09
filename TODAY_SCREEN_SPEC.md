# Today Screen — Design Specification
### For Claude Code implementation · Wellness PWA

---

## 0. Context

This document covers **the Today screen only**. All other screens (Clients tab,
Notifications tab, Intake screen, Note drawer) should use the same design tokens
but their detailed layout specs will follow separately.

**Stack:** React PWA · Supabase backend · Google Calendar API · Hebrew/RTL UI  
**Token file:** `tokens.css` (must be imported globally)

---

## 1. Global RTL Rules

```css
/* Root */
html, body, #root {
  direction: rtl;
  font-family: var(--font-ui);
  background: var(--color-bg);
  color: var(--color-text-primary);
}
```

**Critical exceptions — these specific elements must be `direction: ltr`:**

| Element | Why |
|---|---|
| `.status-bar` | System icons & time always LTR |
| `.session-row` | Time column stays on the left (Google Calendar convention) |
| `[class*="time"]` | Clock values are LTR numbers |

**Card content inside `.session-row` must override back to RTL:**
```css
.session-card { direction: rtl; }
```

**Do not use `margin-left` / `padding-left` — use logical properties:**
```css
/* ✅ correct */
padding-inline-start: 16px;
margin-inline-end: 8px;

/* ❌ wrong */
padding-left: 16px;
```

---

## 2. Screen Structure

```
┌──────────────────────────────────┐
│  .status-bar          (LTR)      │  height: 44px (iOS safe area)
├──────────────────────────────────┤
│  .day-header          (sticky)   │  ~80px
│    .nav-row                      │
│      [›  tomorrow]  [date]  [yesterday  ‹]
│    .meta-pills                   │
│      [X נדרשים סיכום] [X לקוחות חדשים]
├──────────────────────────────────┤
│  .session-list        (scroll)   │  flex: 1, overflow-y: auto
│    .period-label                 │
│    .session-row × N              │
│      .time-col + .session-card   │
├──────────────────────────────────┤
│  .bottom-nav                     │  height: 56px + safe area
│    [היום] [לקוחות] [התראות]      │  RTL order (right = first)
└──────────────────────────────────┘
```

---

## 3. Day Header

### Navigation arrows — CRITICAL

```
RIGHT button  ›   →  onClick: goToNextDay()    (tomorrow)
LEFT button   ‹   →  onClick: goPrevDay()      (yesterday)
```

> Both arrows point **outward from the date**. Right arrow faces right
> (toward tomorrow). Left arrow faces left (toward yesterday).
> This matches universal time-direction convention.

```jsx
<div className="nav-row">
  {/* RIGHT = tomorrow */}
  <div className="arr" onClick={goToNextDay}>›</div>

  <div className="date-center">
    {isToday && <span className="today-tag">היום</span>}
    <span className="date-main">{formattedDate}</span>
  </div>

  {/* LEFT = yesterday */}
  <div className="arr" onClick={goPrevDay}>‹</div>
</div>
```

### Date format
```js
// Hebrew day names
const DAY_NAMES = ['יום א׳','יום ב׳','יום ג׳','יום ד׳','יום ה׳','יום ו׳','שבת'];

// Hebrew month names
const MONTH_NAMES = [
  'ינואר','פברואר','מרץ','אפריל','מאי','יוני',
  'יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'
];

// Output: "יום ג׳, 14 באפריל"
const formatted = `${DAY_NAMES[date.getDay()]}, ${date.getDate()} ב${MONTH_NAMES[date.getMonth()]}`;
```

### Styles
```css
.day-header {
  background: var(--color-bg);
  padding: 10px 16px 10px;
  border-bottom: 0.5px solid var(--color-border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.arr {
  width: 32px; height: 32px;
  border-radius: 50%;
  border: 0.5px solid var(--color-border);
  background: var(--color-surface);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px;
  color: var(--color-text-primary);
  cursor: pointer;
  font-family: system-ui; /* not Rubik — system chevron rendering */
  flex-shrink: 0;
}

.today-tag {
  font-size: 9px;
  font-weight: 500;
  color: var(--color-poppy);
  letter-spacing: 0.06em;
  text-transform: uppercase;
  display: block;
  margin-bottom: 1px;
}

.date-main {
  font-family: var(--font-display);
  font-size: 18px;
  color: var(--color-text-primary);
  line-height: 1.1;
}

.date-center { text-align: center; flex: 1; }
```

### Meta pills

Show **only** these two pills, and **only when count > 0**:

```jsx
<div className="meta-pills">
  {needsNoteCount > 0 && (
    <span className="pill pill-note">{needsNoteCount} נדרשים סיכום</span>
  )}
  {newClientCount > 0 && (
    <span className="pill pill-new">{newClientCount} לקוחות חדשים</span>
  )}
  {!isToday && (
    <span className="pill pill-jump" onClick={goToToday}>חזרה להיום ←</span>
  )}
</div>
```

```css
.meta-pills {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin-top: 8px;
  min-height: 24px;
}

.pill {
  font-size: 10px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  border: 0.5px solid;
}

.pill-note {
  background: var(--color-poppy-tint);
  border-color: var(--color-poppy-mid);
  color: var(--color-poppy-text);
}

.pill-new {
  background: var(--color-ink);
  border-color: var(--color-ink);
  color: #FAF9F6;
}

.pill-jump {
  background: transparent;
  border-color: var(--color-border);
  color: var(--color-text-secondary);
  cursor: pointer;
}
```

---

## 4. Session List

```css
.session-list {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 12px 100px; /* bottom padding for nav bar */
  background: var(--color-bg);
  -webkit-overflow-scrolling: touch;
}

/* Hide scrollbar on iOS */
.session-list::-webkit-scrollbar { display: none; }
.session-list { -ms-overflow-style: none; scrollbar-width: none; }
```

### Period labels

```js
// Grouping logic
function getPeriod(timeStr) {
  const hour = parseInt(timeStr.split(':')[0]);
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

const PERIOD_LABELS = {
  morning:   'בוקר',
  afternoon: 'צהריים',
  evening:   'ערב',
};
```

```css
.period-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
  text-align: right;
  margin: 12px 0 6px 6px;
}
```

### Session row wrapper

```css
/* Row is LTR so time stays on the left */
.session-row {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  margin-bottom: 6px;
  direction: ltr;
}

.time-col {
  width: 36px;
  flex-shrink: 0;
  text-align: left;
  padding-top: 10px;
}

.time-value {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-secondary);
  font-family: system-ui; /* numbers always system font */
  line-height: 1;
}
```

---

## 5. Session Card States

**Card wrapper (common):**
```css
.session-card {
  flex: 1;
  border-radius: var(--radius-md);  /* 10px */
  padding: 9px 11px;
  direction: rtl;                   /* content is RTL */
}

/* Card inner top row */
.card-top {
  display: flex;
  align-items: center;
  gap: 7px;
  margin-bottom: 5px;
}

.card-avatar {
  width: 24px; height: 24px;
  border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  font-size: 9px;
  font-weight: 500;
  flex-shrink: 0;
}

.patient-name {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  flex: 1;
  line-height: 1;
  color: var(--color-text-primary);
}

.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 3px;
}

.card-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.complaint-text {
  font-size: 10px;
  color: var(--color-text-secondary);
}

.status-badge {
  font-size: 9px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-pill);
}

/* CTA — ALWAYS use div/span, never <button>
   <button> has browser default styles that override color/background */
.cta-action {
  display: block;
  width: 100%;
  background: var(--color-poppy) !important;
  color: #FFFFFF !important;
  font-family: var(--font-ui) !important;
  font-size: 9px;
  font-weight: 500;
  border-radius: var(--radius-pill);
  padding: 5px 0;
  margin-top: 7px;
  text-align: center;
  cursor: pointer;
  -webkit-appearance: none;
  border: none;
}
```

---

### State 1 · Completed — הושלם

Trigger: client exists in DB **and** a session note exists for this session,
**or** the session is in the future (not yet happened).

```css
.card-completed {
  background: #EAF0E6;
  border: 0.5px solid #CFDDBE;
}
.card-completed .card-avatar { background: #CFDDBE; color: #3D5630; }
.card-completed .status-dot  { background: #7A8E78; }
.card-completed .status-badge { background: #C4D8AE; color: #3D5630; }
```

Label: `הושלם`  
Avatar: patient initials  
**No CTA** — tapping the card opens the patient profile screen.

---

### State 2 · Needs Note — נדרש סיכום

Trigger: client exists in DB, session time is in the past, **no note** in Supabase.

```css
.card-needs-note {
  background: #FDEAE6;
  border: 0.5px solid #F5C4B4;
}
.card-needs-note .card-avatar { background: #F5C4B4; color: #B03020; }
.card-needs-note .status-dot  { background: var(--color-poppy); }
.card-needs-note .status-badge { background: #F5B8A8; color: #B03020; }
```

Label: `נדרש סיכום`  
Avatar: patient initials  
**CTA:** `כתוב סיכום ←`  
Action: opens **Session Note drawer** (bottom sheet, slides up from today screen)

---

### State 3 · New Client — לקוח חדש

Trigger: Google Calendar event has **no matching client** in Supabase.
Matching logic: email address on the calendar event OR name match.

```css
.card-new-client {
  background: #F2F0EE;
  border: 1px solid var(--color-ink);  /* thicker, darker — intentional */
}
.card-new-client .card-avatar { background: #D8D4CE; color: var(--color-ink); }
.card-new-client .status-dot  { background: var(--color-ink); }
.card-new-client .status-badge { background: var(--color-ink); color: #FAF9F6; }
```

Label: `לקוח חדש`  
Avatar: **person SVG outline** (no initials — client not in system yet)

```jsx
// Avatar SVG for new client
<svg width="11" height="11" viewBox="0 0 16 16" fill="none">
  <circle cx="8" cy="5.5" r="2.5" stroke="#282B30" strokeWidth="1.5"/>
  <path d="M3 13c0-2.76 2.24-5 5-5s5 2.24 5 5"
        stroke="#282B30" strokeWidth="1.5" strokeLinecap="round"/>
</svg>
```

**CTA:** `התחל אינטייק ←`  
Action: navigates to **Intake screen** (full screen, not a drawer)

**Flow on tapping "התחל אינטייק":**
1. Navigate to Intake screen
2. Intake screen = combined "create client + first session note" form
3. On save → client record created in Supabase + session note saved
4. Card state updates to "הושלם" on return to Today

---

### Break Slot — הפסקה

Not a session card. Rendered when the Google Calendar event title is "הפסקה"
(or configured break keywords).

```css
.break-slot {
  flex: 1;
  background: rgba(0, 0, 0, 0.03);
  border: 0.5px solid rgba(0, 0, 0, 0.06);
  border-radius: 8px;
  padding: 7px 11px;
  direction: rtl;
}

.break-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--color-text-muted);
}
```

Not tappable. No action.

---

### Block Slot — Solo Events

Rendered when the Google Calendar event has **no other attendees** (only the practitioner).
This is a personal block (e.g. admin time, lunch, study) — not a patient session.

```css
.block-slot {
  flex: 1;
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 9px 11px;
  direction: rtl;
}

.block-title {
  font-family: var(--font-display);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.block-meta {
  font-size: 10px;
  color: var(--color-text-muted);
  margin-top: 2px;
}
```

Not tappable. No action. Shows event title and duration.

---

### Filtering Rules

- **All-day events**: filtered out (no `dateTime` on start/end)
- **Duration**: only events > 15 min and < 120 min
- **Group meetings**: events with 5+ non-self attendees are filtered out
- **Solo events** (0 non-self attendees): shown as block slots, not sessions

---

## 6. Bottom Navigation Bar

```css
.bottom-nav {
  background: var(--color-surface);
  border-top: 0.5px solid var(--color-border);
  flex-shrink: 0;
  display: flex;
  direction: rtl;  /* tabs flow right → left */
  padding: 0 8px;
  padding-bottom: env(safe-area-inset-bottom, 12px);
}

.nav-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 10px 4px 4px;
  cursor: pointer;
}

.nav-tab-label {
  font-size: 9px;
  font-weight: 500;
  color: var(--color-text-inactive);
}

/* Active state */
.nav-tab.active .nav-tab-label { color: var(--color-poppy); }
.nav-tab.active svg             { color: var(--color-poppy); }

/* Active pip */
.nav-pip {
  width: 3px; height: 3px;
  border-radius: 50%;
  background: var(--color-poppy);
}

/* Home indicator spacing */
.home-bar {
  width: 120px; height: 5px;
  background: var(--color-border);
  border-radius: var(--radius-pill);
  margin: 6px auto 0;
}
```

**Tab order (rightmost = first in RTL flex):**

| Position | Label | Tab ID |
|---|---|---|
| Right (primary) | היום | `today` |
| Center | לקוחות | `clients` |
| Left | התראות | `notifications` |

Notification badge on התראות tab:
```css
.notif-badge {
  position: absolute;
  top: 8px;
  /* In RTL, 'left' is visually on the right side of the icon */
  left: calc(50% - 18px);
  width: 16px; height: 16px;
  border-radius: 50%;
  background: var(--color-poppy);
  color: #fff;
  font-size: 9px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 7. Hebrew String Reference

```js
export const STRINGS = {
  // Nav
  today:          'היום',
  clients:        'לקוחות',
  notifications:  'התראות',

  // Header
  backToToday:    'חזרה להיום ←',

  // Periods
  morning:        'בוקר',
  afternoon:      'צהריים',
  evening:        'ערב',

  // Card badges
  completed:      'הושלם',
  needsNote:      'נדרש סיכום',
  newClient:      'לקוח חדש',
  breakSlot:      'הפסקה',

  // CTAs
  writeNote:      'כתוב סיכום ←',
  startIntake:    'התחל אינטייק ←',

  // Pills (use template literals)
  needsNotePill:  (n) => `${n} נדרשים סיכום`,
  newClientPill:  (n) => `${n} לקוחות חדשים`,
};
```

---

## 8. Session Status Logic

```typescript
type SessionStatus = 'completed' | 'needs-note' | 'new-client';

function deriveStatus(session: GCalEvent, db: SupabaseClient): SessionStatus {
  const clientRecord = db.clients.findByEmail(session.attendeeEmail)
                    ?? db.clients.findByName(session.title);

  // No client record in app → new-client (regardless of session time)
  if (!clientRecord) return 'new-client';

  // Client exists — check if session is past
  const isPast = new Date(session.endTime) < new Date();
  if (!isPast) return 'completed'; // future sessions show as completed (neutral)

  // Past session — check for note
  const hasNote = db.notes.existsForSession(session.gcalEventId);
  return hasNote ? 'completed' : 'needs-note';
}
```

---

## 9. Component Checklist for Claude Code

- [ ] `tokens.css` imported at root
- [ ] `html { direction: rtl }` set globally
- [ ] `DayHeader` component with **right=tomorrow, left=yesterday** navigation
- [ ] Date formatted as `יום ג׳, 14 באפריל`
- [ ] Only 2 meta pills, conditionally rendered
- [ ] `SessionList` groups sessions by `getPeriod()`
- [ ] `SessionRow` wrapper has `direction: ltr` (time on left)
- [ ] `SessionCard` has `direction: rtl` (content RTL)
- [ ] `CardCompleted` — sage, no CTA, tap → patient profile
- [ ] `CardNeedsNote` — poppy, CTA opens note drawer
- [ ] `CardNewClient` — ink border, person SVG avatar, CTA → intake screen
- [ ] All CTAs use `<div>` not `<button>` (avoids browser colour overrides)
- [ ] `BreakSlot` rendered for break events — not tappable
- [ ] `BottomNav` with `direction: rtl` — right tab = היום
- [ ] Nav badge on התראות tab
- [ ] `safe-area-inset-bottom` padding on nav bar for iPhone notch
- [ ] All colours reference CSS tokens, no hardcoded hex values in components
- [ ] `font-family: system-ui` on time values and nav arrow characters

---

## 10. Notes for Other Screens

All other screens (Clients tab, Notifications tab, Intake screen, Session Note
drawer) should use the same `tokens.css` and global RTL setup. Their detailed
component specs will be documented separately. For now, default to:

- Feather White (`var(--color-bg)`) backgrounds
- White (`var(--color-surface)`) card surfaces
- Poppy (`var(--color-poppy)`) for all primary actions
- Ink (`var(--color-ink)`) for headings and "new client" accents
- Rubik for all UI text, Cormorant Garamond for display headings only
