# Clients Tab — Design & Implementation Specification
### For Claude Code · Wellness PWA

---

## 0. Overview

The Clients tab is the second tab in the bottom navigation bar (לקוחות).
It contains four distinct screens/states:

1. **Client List** — searchable, sortable list of all clients
2. **Client Profile** — individual client view with patient details + session history
3. **Full View** — all session notes aggregated in one scrollable document
4. **Read-only Note** — single session note in a signed, non-editable view

All screens are RTL (`direction: rtl`). All use `tokens.css` — no hardcoded hex values.

---

## 1. Component Reuse — Check Before Building

Before writing any new code, locate these existing components:

| Component | Where used before | Reuse notes |
|---|---|---|
| `ClientBanner` | Intake, Session Note | Use `variant="profile"` — new variant, same component |
| `StatusBadge` | Today screen cards | Same sage/poppy badges |
| `FormLabel` | Intake, Session Note | Section labels in read-only note |
| `FormulaChip` | Intake, Session Note | Read-only formula display |
| `TopBar` | Intake, Session Note | Back button + title + optional right action |
| `SectionNumber` | Session Note | Numbered circles in read-only note view |
| `PhotoThumbnail` | Intake, Session Note | Photo display in read-only note |

**Do NOT rewrite any of these.** Report their file locations before building.

---

## 2. Screen 1 — Client List

### Layout
```
TopBar (title only, no back button — this is a tab root)
Search box
Sort pills row
Client rows (scrollable)
```

### Search
```tsx
<input
  type="text"
  placeholder="חפש לקוח..."
  value={query}
  onChange={e => setQuery(e.target.value)}
  dir="rtl"
/>
```

Filter logic — case-insensitive match on `client.full_name`:
```typescript
const filtered = clients.filter(c =>
  c.full_name.includes(query) ||
  c.full_name.toLowerCase().includes(query.toLowerCase())
);
```

### Sort pills

Two options — only one active at a time:

```tsx
type SortMode = 'alpha' | 'recent';

// Alpha: sort by full_name A→Z (aleph → tav)
const byAlpha  = [...filtered].sort((a,b) =>
  a.full_name.localeCompare(b.full_name, 'he'));

// Recent: sort by most recent session date descending
const byRecent = [...filtered].sort((a,b) =>
  new Date(b.last_session_date) - new Date(a.last_session_date));
```

```css
.sort-pill {
  font-size: 11px;
  font-weight: 500;
  padding: 4px 14px;
  border-radius: var(--radius-pill);
  border: 0.5px solid;
  cursor: pointer;
}

.sort-pill.active {
  background: var(--color-ink);       /* #282B30 */
  color: var(--color-bg);             /* #FAF9F6 */
  border-color: var(--color-ink);
}

.sort-pill.inactive {
  background: transparent;
  color: var(--color-text-secondary);
  border-color: var(--color-border);
}
```

Labels: `א–ת` (alpha) · `אחרון` (recent)

### Client row

```tsx
<div className="client-row" onClick={() => navigate(`/clients/${client.id}`)}>
  <Avatar initials={initials(client.full_name)} colorIndex={index} />
  <div className="client-info">
    <span className="client-name">{client.full_name}</span>
    <span className="client-sub">
      טיפול {client.session_count} · {formatDate(client.last_session_date)}
    </span>
  </div>
  <StatusBadge status={client.last_session_status} />
  <ChevronIcon />
</div>
```

Status badge on client row = status of the **most recent past session**:
- Has note → `הושלם` (sage)
- No note → `נדרש סיכום` (poppy)
- No past sessions yet → no badge

```css
.client-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 16px;
  border-bottom: 0.5px solid #FAF9F6;  /* very subtle — white on feather white */
  background: var(--color-surface);
  cursor: pointer;
}

.client-name {
  font-family: var(--font-display);
  font-size: 15px;
  color: var(--color-text-primary);
}

.client-sub {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 1px;
  display: block;
}
```

### Avatar color cycling

Alternate between peach and sage families across the list so it doesn't look monotonous:

```typescript
const AVATAR_COLORS = [
  { bg: '#FFF3EC', color: '#D4845A' },  // peach
  { bg: '#EAF0E6', color: '#4A5E4A' },  // sage
];

const av = AVATAR_COLORS[index % AVATAR_COLORS.length];
```

### Supabase query

```typescript
const { data: clients } = await supabase
  .from('clients')
  .select(`
    id, full_name, gender, age, phone, email,
    chief_complaint, created_at,
    sessions (
      id, session_date, session_type,
      notes ( id )
    )
  `)
  .order('full_name', { ascending: true });
```

Derive `last_session_date`, `session_count`, `last_session_status` client-side
from the joined sessions data.

---

## 3. Screen 2 — Client Profile

### Hierarchy — top to bottom, in this exact order:

```
1. ClientBanner (variant="profile")
2. פרטי המטופל/ת card
3. Session list (upcoming first, then past)
4. "תצוגת תיק מלאה" ghost pill (bottom)
```

### ClientBanner — variant="profile"

Add `variant="profile"` to the existing `ClientBanner` component.
Same colors as `variant="session"` (Peach Mist family):

```typescript
profile: {
  bg:          '#FCEEE4',
  border:      '#EDD8CC',
  avatarBg:    '#F5C4A8',
  avatarColor: '#A05020',
  labelColor:  '#C07848',
}
```

```tsx
<ClientBanner
  variant="profile"
  clientName={client.full_name}
  sessionLabel={`${client.session_count} טיפולים · מ${formatMonthYear(client.created_at)}`}
  avatarContent={initials(client.full_name)}
  tag={isActive ? 'פעילה' : 'לא פעילה'}
  tagStyle="sage"
/>
```

### פרטי המטופל/ת card

```tsx
<div className="patient-details-card">
  <div className="pd-header">
    <span className="pd-title">פרטי המטופל/ת</span>
    <span className="pd-date">{formatDate(client.created_at)}</span>
  </div>
  <div className="pd-grid">
    <Field label="גיל"    value={client.age} />
    <Field label="מגדר"   value={client.gender === 'female' ? 'אישה' : 'גבר'} />
    <Field label="טלפון"  value={client.phone} dir="ltr" />
    <Field label="אימייל" value={client.email} dir="ltr" fontSize={10} />
  </div>
  <div className="pd-complaint">
    <span className="pd-complaint-label">תלונה עיקרית</span>
    <span className="pd-complaint-val">{client.chief_complaint}</span>
  </div>
</div>
```

```css
.patient-details-card {
  margin: 12px 14px 0;
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.pd-header {
  padding: 8px 12px;
  background: var(--color-bg);
  border-bottom: 0.5px solid var(--color-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pd-title {
  font-size: 10px;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-secondary);
}

.pd-date { font-size: 10px; color: var(--color-text-muted); }

.pd-grid {
  padding: 10px 12px;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
```

### Session list — upcoming FIRST, then past

```typescript
const today = new Date();

const upcoming = sessions
  .filter(s => new Date(s.session_date) > today)
  .sort((a,b) => new Date(a.session_date) - new Date(b.session_date))
  .slice(0, 3);  // Maximum 3 upcoming sessions shown

const past = sessions
  .filter(s => new Date(s.session_date) <= today)
  .sort((a,b) => new Date(b.session_date) - new Date(a.session_date));
  // Descending — most recent first. Loaded in pages — see section 3a.
```

### 3a. Pagination — Infinite Scroll for Past Sessions

Past sessions are loaded in pages of 10 as the user scrolls down.
Do NOT load all past sessions at once.

```typescript
const PAGE_SIZE = 10;

// State
const [pastSessions, setPastSessions] = useState<Session[]>([]);
const [page, setPage]                 = useState(0);
const [hasMore, setHasMore]           = useState(true);
const [loading, setLoading]           = useState(false);
const loaderRef                       = useRef<HTMLDivElement>(null);

// Fetch one page
async function loadPage(pageIndex: number) {
  if (loading || !hasMore) return;
  setLoading(true);

  const { data, error } = await supabase
    .from('sessions')
    .select('*, notes(*)')
    .eq('client_id', clientId)
    .eq('session_type', 'session')          // exclude intake
    .lte('session_date', new Date().toISOString())
    .order('session_date', { ascending: false })
    .range(pageIndex * PAGE_SIZE, (pageIndex + 1) * PAGE_SIZE - 1);

  if (error || !data) { setLoading(false); return; }

  setPastSessions(prev => [...prev, ...data]);
  setHasMore(data.length === PAGE_SIZE);    // if fewer than 10 returned, we're done
  setLoading(false);
}

// Load first page on mount
useEffect(() => { loadPage(0); }, [clientId]);

// Increment page when sentinel comes into view
useEffect(() => {
  if (page === 0) return;
  loadPage(page);
}, [page]);

// IntersectionObserver watches the sentinel div at the bottom of the list
useEffect(() => {
  if (!loaderRef.current) return;
  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting && hasMore) setPage(p => p + 1); },
    { threshold: 0.1 }
  );
  observer.observe(loaderRef.current);
  return () => observer.disconnect();
}, [loaderRef.current, hasMore]);
```

Render the sentinel and loading indicator at the bottom of the past sessions list:

```tsx
{pastSessions.map(s => <SessionRow key={s.id} session={s} />)}

{/* Sentinel — triggers next page load when scrolled into view */}
<div ref={loaderRef} style={{ height: 1 }} />

{/* Loading indicator */}
{loading && (
  <div style={{ textAlign: 'center', padding: '12px', color: '#B8B4B0', fontSize: 12 }}>
    טוען...
  </div>
)}

{/* End of list */}
{!hasMore && pastSessions.length > 0 && (
  <div style={{ textAlign: 'center', padding: '12px', color: '#B8B4B0', fontSize: 11 }}>
    · סוף הרשימה ·
  </div>
)}
```

**Important:** Reset pagination when navigating away and back:
```typescript
useEffect(() => {
  return () => {
    setPastSessions([]);
    setPage(0);
    setHasMore(true);
  };
}, []);
```

**Upcoming session row** — Peach family:
```css
.session-row-upcoming {
  background: #FFF3EC;
  border: 0.5px solid #F5D0B4;
  border-radius: var(--radius-md);
  padding: 9px 11px;
  margin-bottom: 5px;
  cursor: pointer;
}
```

Sub-label shows days until appointment:
```typescript
function daysUntil(date: string): string {
  const days = Math.ceil(
    (new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return 'היום';
  if (days === 1) return 'מחר';
  return `בעוד ${days} ימים`;
}
```

**Past session row** — white, standard:
```css
.session-row-past {
  background: var(--color-surface);
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-md);
  padding: 9px 11px;
  margin-bottom: 5px;
  cursor: pointer;
}
```

Intake session row — muted (opacity 0.45), badge says "אינטייק",
not tappable into read-only note (intake is its own view — TBD).

Session number derived from chronological order:
```typescript
const numbered = [...sessions]
  .sort((a,b) => new Date(a.session_date) - new Date(b.session_date))
  .map((s, i) => ({ ...s, number: i + 1 }));
```

### "תצוגת תיק מלאה" — ghost pill at bottom

```tsx
<div className="fullview-footer">
  <div className="fullview-btn" onClick={() => navigate(`/clients/${id}/full`)}>
    <DocumentIcon />
    <span>תצוגת תיק מלאה</span>
  </div>
</div>
```

```css
.fullview-footer {
  padding: 12px 14px 16px;
  display: flex;
  justify-content: center;
}

.fullview-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: transparent;
  border: 0.5px solid var(--color-border);
  border-radius: var(--radius-pill);
  padding: 8px 18px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
```

This is NOT a primary CTA. It is a secondary utility action.
Do not make it poppy, do not make it large, do not make it filled.

---

## 4. Screen 3 — Full View (תצוגת תיק מלאה)

White background (`#FFFFFF`) — signals "document mode, not app UI."

### Layout
```
TopBar — back (client name) + title "תיק מלא" + "ייצוא" right action
Client header strip (Peach Mist — compact)
פרטי המטופל/ת block
Session divider
Session 7 (upcoming) block — if exists
Session divider
Session 6 block
Session divider
Session 5 block
... and so on, newest past first
```

### "ייצוא" — top right of TopBar

Small, Poppy colored text button. NOT a filled button.
Tapping triggers `window.print()` — see section 5.

```tsx
<TopBar
  title="תיק מלא"
  onBack={() => navigate(`/clients/${id}`)}
  backLabel={client.full_name}
  rightLabel="ייצוא"
  rightAction={handleExport}
  rightColor="poppy"   // new prop — renders in var(--color-poppy) instead of default
/>
```

### Session block structure

Each session renders:
```tsx
<div className="session-block">
  <div className="session-block-header">
    <span className="sbh-number">טיפול {session.number}</span>
    <span className="sbh-date">{formatDate(session.session_date)}</span>
    <StatusBadge status={...} />  {/* reuse existing component */}
  </div>
  <div className="session-block-content">
    {note.client_report    && <NoteField label="דיווח הלקוח"    value={note.client_report} />}
    {note.tongue_and_pulse && <NoteField label="לשון ודופק"      value={note.tongue_and_pulse} />}
    {note.treatment_done   && <NoteField label="מה נעשה"         value={note.treatment_done} />}
    {note.treatment_plan   && <NoteField label="תכנית לטיפול הבא" value={note.treatment_plan} />}
    {note.homework         && <NoteField label="שיעורי בית"      value={note.homework} />}
    {note.formulas?.length > 0 && (
      <div>
        <NoteFieldLabel>פורמולות</NoteFieldLabel>
        <div className="chip-row">
          {note.formulas.map(f => <FormulaChip key={f} name={f} readOnly />)}
        </div>
      </div>
    )}
  </div>
</div>
```

**Only render fields that have content** — skip empty fields entirely.
This keeps the full view clean when some sessions have partial notes.

Between each session — a horizontal divider:
```css
.session-divider {
  height: 0.5px;
  background: var(--color-border);
  margin: 12px 16px;
}
```

---

## 5. Export / Print

No external library required. Uses the browser's native print dialog.
On iOS Safari: gives "Save to Files" as PDF.
On Android Chrome: opens print dialog with PDF export.

```typescript
function handleExport(client: Client, sessions: Session[], notes: Note[]) {
  const html = buildExportHTML(client, sessions, notes);
  const win = window.open('', '_blank');
  if (!win) return; // popup blocked
  win.document.write(html);
  win.document.close();
  // Wait for fonts/styles to render before opening print dialog
  setTimeout(() => win.print(), 400);
}
```

### buildExportHTML

Generates a complete standalone HTML document string:

```typescript
function buildExportHTML(client, sessions, notes): string {
  const sessionBlocks = sessions
    .filter(s => s.session_type !== 'intake')
    .sort((a,b) => new Date(b.session_date) - new Date(a.session_date))
    .map((s, i, arr) => {
      const note = notes.find(n => n.session_id === s.id);
      const num = arr.length - i;
      return buildSessionBlock(s, note, num);
    })
    .join('<div class="divider"></div>');

  return `
    <!DOCTYPE html>
    <html dir="rtl" lang="he">
    <head>
      <meta charset="UTF-8">
      <title>תיק לקוח · ${client.full_name}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Rubik&family=Cormorant+Garamond&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Rubik', sans-serif; direction: rtl;
               color: #282B30; background: #fff; padding: 32px; }
        h1 { font-family: 'Cormorant Garamond', serif; font-size: 28px;
             font-weight: 400; margin-bottom: 4px; }
        .meta { font-size: 12px; color: #8A8680; margin-bottom: 20px; }
        .intake-block { background: #FAF9F6; border: 0.5px solid #EDEAE4;
                        border-radius: 8px; padding: 14px; margin-bottom: 24px; }
        .intake-title { font-size: 10px; font-weight: 500; color: #8A8680;
                        letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 10px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 10px; }
        .field-label { font-size: 10px; color: #8A8680; text-transform: uppercase;
                       letter-spacing: 0.07em; margin-bottom: 2px; }
        .field-val { font-size: 13px; color: #282B30; }
        .session-num { font-family: 'Cormorant Garamond', serif; font-size: 18px; }
        .session-date { font-size: 12px; color: #8A8680; margin-right: 10px; }
        .session-header { display: flex; align-items: baseline; gap: 8px;
                          margin-bottom: 10px; padding-bottom: 6px;
                          border-bottom: 0.5px solid #EDEAE4; }
        .note-field { margin-bottom: 10px; }
        .divider { height: 1px; background: #EDEAE4; margin: 20px 0; }
        .chip { display: inline-block; background: #EAF0E6; color: #3D5630;
                font-size: 11px; font-weight: 500; padding: 2px 10px;
                border-radius: 100px; margin-left: 4px; }
        .footer { margin-top: 32px; padding-top: 14px; border-top: 0.5px solid #EDEAE4;
                  text-align: center; font-size: 10px; color: #B8B4B0; }
        @media print {
          body { padding: 20px; }
          @page { margin: 1.5cm; }
        }
      </style>
    </head>
    <body>
      <h1>${client.full_name}</h1>
      <div class="meta">
        ${client.age ? client.age + ' · ' : ''}
        ${client.gender === 'female' ? 'אישה' : 'גבר'} ·
        ${sessions.filter(s=>s.session_type!=='intake').length} טיפולים ·
        יוצא ${formatDate(new Date())}
      </div>

      <div class="intake-block">
        <div class="intake-title">פרטי המטופל/ת · ${formatDate(client.created_at)}</div>
        <div class="grid">
          <div><div class="field-label">טלפון</div><div class="field-val" dir="ltr">${client.phone || '—'}</div></div>
          <div><div class="field-label">אימייל</div><div class="field-val" dir="ltr" style="font-size:11px">${client.email || '—'}</div></div>
        </div>
        <div><div class="field-label">תלונה עיקרית</div><div class="field-val">${client.chief_complaint || '—'}</div></div>
        ${client.treatment_plan ? `<div style="margin-top:8px"><div class="field-label">תכנית טיפול</div><div class="field-val">${client.treatment_plan}</div></div>` : ''}
      </div>

      ${sessionBlocks}

      <div class="footer">
        תיק מלא · ${client.full_name} · יוצא ${new Date().toLocaleDateString('he-IL')}
      </div>
    </body>
    </html>
  `;
}
```

---

## 6. Screen 4 — Read-only Note

Opened by tapping a past session row in the client profile.
This is a full-screen push (not a drawer).

### Key rules
- **No edit affordances** — no inputs, no textareas, no CTAs
- **Read-only** — all fields displayed as static text
- **Signed stamp** at top — green pill showing "סוכם" + timestamp

### Signed stamp
```tsx
<div className="signed-stamp">
  <div className="stamp-dot" />
  <span className="stamp-text">סוכם</span>
  <span className="stamp-date">{formatDateTime(note.created_at)}</span>
</div>
```

```css
.signed-stamp {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--color-sage-tint);
  border: 0.5px solid var(--color-sage-mid);
  border-radius: var(--radius-pill);
  padding: 4px 12px;
  margin: 12px 14px 0;
}

.stamp-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--color-sage-deep);
  flex-shrink: 0;
}

.stamp-text { font-size: 10px; font-weight: 500; color: var(--color-sage-deeper); }
.stamp-date { font-size: 10px; color: var(--color-text-secondary); margin-right: auto; }
```

### NoteSection component (reuse SectionNumber)

```tsx
<NoteSection number={1} color="#D4845A" bg="#FFF3EC" title="הדיווח">
  <NoteField label="דיווח הלקוח"  value={note.client_report} />
  <NoteField label="לשון ודופק"    value={note.tongue_and_pulse} />
</NoteSection>

<NoteSection number={2} color="#C93E2C" bg="#FDEAE6" title="הטיפול">
  <NoteField label="מה נעשה" value={note.treatment_done} />
</NoteSection>

<NoteSection number={3} color="#4A5E4A" bg="#EAF0E6" title="המשך">
  <NoteField label="תכנית לטיפול הבא" value={note.treatment_plan} />
  <NoteField label="שיעורי בית"        value={note.homework} />
  {note.formulas?.length > 0 && (
    <div>
      <NoteFieldLabel>פורמולות</NoteFieldLabel>
      {note.formulas.map(f => <FormulaChip key={f} name={f} readOnly />)}
    </div>
  )}
</NoteSection>
```

Only render `NoteField` when value is non-empty.

---

## 7. Hebrew Strings

```typescript
export const CLIENTS_STRINGS = {
  // Tab
  tabLabel:          'לקוחות',
  searchPlaceholder: 'חפש לקוח...',
  sortAlpha:         'א–ת',
  sortRecent:        'אחרון',

  // Profile
  patientDetails:    'פרטי המטופל/ת',
  sessionHistory:    'היסטוריית טיפולים',
  fullViewBtn:       'תצוגת תיק מלאה',
  active:            'פעילה',
  inactive:          'לא פעילה',

  // Session row
  upcoming:          'קרוב',
  completed:         'הושלם',
  needsNote:         'נדרש סיכום',
  intake:            'אינטייק',
  today:             'היום',
  tomorrow:          'מחר',
  inDays:            (n: number) => `בעוד ${n} ימים`,

  // Full view
  fullViewTitle:     'תיק מלא',
  exportLabel:       'ייצוא',
  sessionNum:        (n: number) => `טיפול ${n}`,

  // Read-only note
  signedLabel:       'סוכם',
  section1Title:     'הדיווח',
  section2Title:     'הטיפול',
  section3Title:     'המשך',
  clientReport:      'דיווח הלקוח',
  tongueAndPulse:    'לשון ודופק',
  treatmentDone:     'מה נעשה',
  treatmentPlan:     'תכנית לטיפול הבא',
  homework:          'שיעורי בית',
  formulas:          'פורמולות',

  // Export doc
  exportFooter:      (name: string, date: string) =>
                       `תיק מלא · ${name} · יוצא ${date}`,
};
```

---

## 8. Supabase Queries

### Client list
```typescript
const { data } = await supabase
  .from('clients')
  .select(`
    id, full_name, age, gender, phone, email,
    chief_complaint, treatment_plan, created_at,
    sessions (
      id, session_date, session_type,
      notes ( id, created_at )
    )
  `);
```

### Client profile + sessions
```typescript
const { data: client } = await supabase
  .from('clients')
  .select('*')
  .eq('id', clientId)
  .single();

const { data: sessions } = await supabase
  .from('sessions')
  .select(`*, notes (*)`)
  .eq('client_id', clientId)
  .order('session_date', { ascending: false });
```

Also fetch upcoming sessions from Google Calendar API
using the client's email to match attendees.

---

## 9. Implementation Checklist

### Component reuse
- [ ] `ClientBanner` extended with `variant="profile"` — NOT duplicated
- [ ] `StatusBadge` reused from Today screen — NOT rewritten
- [ ] `FormulaChip` reused with `readOnly` prop — NOT rewritten
- [ ] `SectionNumber` reused in read-only note — NOT rewritten
- [ ] `TopBar` reused across all screens — NOT rewritten

### Screen 1 — Client list
- [ ] Search filters by name, case-insensitive
- [ ] Sort pills: א–ת (Hebrew locale sort) and אחרון (by last session date)
- [ ] Only one sort active at a time
- [ ] Status badge = status of most recent past session
- [ ] Avatar colors alternate peach / sage

### Screen 2 — Client profile
- [ ] Hierarchy: Banner → פרטי המטופל/ת → Session list → Ghost pill
- [ ] פרטי המטופל/ת card shows: גיל, מגדר, טלפון, אימייל, תלונה עיקרית
- [ ] Phone and email displayed `dir="ltr"` (they are LTR values)
- [ ] Upcoming sessions: maximum 3 shown, peach background, "קרוב" badge, days-until label
- [ ] Upcoming sorted ascending (nearest first), capped at 3
- [ ] Past sessions loaded via IntersectionObserver infinite scroll, PAGE_SIZE = 10
- [ ] First page of past sessions loads on mount
- [ ] Subsequent pages load as user scrolls to sentinel div
- [ ] Loading indicator ("טוען...") shown while fetching
- [ ] "סוף הרשימה" shown when no more pages
- [ ] Pagination state resets on unmount
- [ ] Past sessions: white background, sage/poppy badge
- [ ] Intake session row: muted (opacity 0.45), "אינטייק" badge
- [ ] "תצוגת תיק מלאה" ghost pill at bottom — NOT a primary CTA

### Screen 3 — Full view
- [ ] White background (#FFFFFF) — not Feather White
- [ ] "ייצוא" in TopBar right — small Poppy text, not a filled button
- [ ] פרטי המטופל/ת block at top
- [ ] Sessions newest-first, divided by 0.5px lines
- [ ] Empty note fields are skipped entirely
- [ ] FormulaChip rendered read-only (no delete button)

### Export
- [ ] Uses `window.open` + `document.write` — no external library
- [ ] `setTimeout(() => win.print(), 400)` — waits for render
- [ ] Standalone HTML with inline styles (no external CSS dependencies)
- [ ] Empty fields omitted from export HTML
- [ ] `@media print` styles set page margins

### Screen 4 — Read-only note
- [ ] No edit affordances anywhere
- [ ] Signed stamp at top with timestamp
- [ ] Same 3-section structure as Session Note writer
- [ ] Empty fields omitted
- [ ] Photos displayed as thumbnails (reuse PhotoThumbnail, readOnly)
