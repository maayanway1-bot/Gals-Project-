# Session Note Screen — Design & Implementation Specification
### For Claude Code · Wellness PWA

---

## 0. Overview

The Session Note screen is a **bottom drawer** that slides up from the Today
screen when the user taps "כתוב סיכום ←" on a needs-note session card.

It is used for **follow-up sessions only** (session 2 and onwards).
The Intake screen (INTAKE_SCREEN_SPEC.md) handles session 1.

**On save:** Update the `notes` record in Supabase for this session.
The session card on Today updates from "נדרש סיכום" → "הושלם".

---

## 1. Component Reuse — CRITICAL

Before writing any new code, check for existing components in the codebase
that can be reused directly or with minor prop changes. Do NOT rewrite
components that already exist.

### Must reuse from Intake screen:

| Component | Reuse notes |
|---|---|
| `FormulaSheet` | Identical bottom sheet, same Supabase preset logic. Accept `selectedFormulas` + `onChange` props. |
| `FormulaChip` | Same chip UI (sage green). No changes needed. |
| `PhotoAttachment` | Same two hidden inputs (camera + gallery), same upload logic. Accept `photos` + `onChange` props. |
| `PhotoThumbnail` | Same thumbnail + delete UI. No changes needed. |
| `SectionNumber` | The numbered circle (①②③) with color prop. Already built. |
| `FormTextarea` | Styled RTL textarea with placeholder. Accept `label`, `placeholder`, `value`, `onChange`, `minHeight`. |
| `FormLabel` | The small uppercase label above each field. |
| `TopBar` | Back button + title + right action button. Accept `title`, `onBack`, `rightLabel`, `onRight`, `rightDisabled`. |
| `ClientBanner` | See section 3 below — extend with a `variant` prop rather than duplicating. |

### ClientBanner — extend with variant prop

The `ClientBanner` component already exists from the Intake screen.
**Do not create a new banner component.** Add a `variant` prop:

```typescript
type BannerVariant = 'intake' | 'session';

interface ClientBannerProps {
  variant: BannerVariant;
  clientName: string;
  sessionLabel: string;      // e.g. "טיפול מספר 6 · יום ג׳ 14 אפריל · 12:15"
  avatarContent: ReactNode;  // initials string OR person SVG icon
  tag: string;               // e.g. "סיכום" or "לקוח חדש"
}
```

```typescript
// Variant token map — drives all color differences
const BANNER_VARIANTS = {
  intake: {
    bg:         '#FFF3EC',
    border:     '#F5D0B4',
    avatarBg:   '#FFC6AD',
    avatarColor:'#A05020',
    labelColor: '#D4845A',
  },
  session: {
    bg:         '#FCEEE4',   // Peach Mist — one step warmer than intake
    border:     '#EDD8CC',
    avatarBg:   '#F5C4A8',
    avatarColor:'#A05020',
    labelColor: '#C07848',
  },
};
```

Usage in Session Note:
```jsx
<ClientBanner
  variant="session"
  clientName={client.full_name}
  sessionLabel={`טיפול מספר ${sessionNumber} · ${formattedDate} · ${sessionTime}`}
  avatarContent={initials}   // client is known — use initials
  tag="סיכום"
/>
```

Usage in Intake:
```jsx
<ClientBanner
  variant="intake"
  clientName={gcalEventTitle}
  sessionLabel={`לקוח חדש · ${formattedDate} · ${sessionTime}`}
  avatarContent={<PersonOutlineIcon />}  // unknown — use outline icon
  tag="לקוח חדש"
/>
```

---

## 2. Screen Structure

The note screen opens as a **bottom drawer** (sheet), not a full-screen push.
It slides up from the Today screen and covers ~95% of the viewport height.

```
┌──────────────────────────────────┐
│  drag handle                     │
│  .topbar (back + title + save)   │
│  ClientBanner variant="session"  │
├──────────────────────────────────┤
│  .scroll-content  (flex: 1)      │
│    Section 1 — הדיווח            │
│    Section 2 — הטיפול            │
│    Section 3 — המשך              │
│    Submit CTA                    │
└──────────────────────────────────┘
```

```css
.note-drawer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 95dvh;
  background: var(--color-bg);          /* #FAF9F6 Feather White */
  border-radius: 20px 20px 0 0;
  display: flex;
  flex-direction: column;
  direction: rtl;
  transform: translateY(100%);
  transition: transform 0.32s cubic-bezier(0.32, 0.72, 0, 1);
  z-index: 50;
}

.note-drawer.open {
  transform: translateY(0);
}

.drawer-handle {
  width: 36px;
  height: 4px;
  background: var(--color-border);
  border-radius: var(--radius-pill);
  margin: 10px auto 0;
  flex-shrink: 0;
}

/* Overlay behind drawer */
.drawer-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 49;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.32s;
}

.drawer-overlay.open {
  opacity: 1;
  pointer-events: all;
}
```

---

## 3. Top Bar

Reuse the existing `TopBar` component:

```jsx
<TopBar
  title="סיכום טיפול"
  onBack={handleClose}         // closes drawer, returns to Today
  backLabel="היום"
  rightLabel="שמור"
  onRight={handleSave}
  rightDisabled={!hasAnyText}  // see validation section
/>
```

---

## 4. Form Sections

### Section 1 — הדיווח

```jsx
<SectionNumber number={1} color="#D4845A" bg="#FFF3EC" />
<span>הדיווח — מה מביא הלקוח</span>

<FormTextarea
  label="דיווח הלקוח"
  placeholder="מה מדווח הלקוח? תסמינים, שינויים, תחושות, שינה, אנרגיה..."
  value={clientReport}
  onChange={setClientReport}
  minHeight={80}
/>

<FormTextarea
  label="לשון ודופק"
  placeholder="תצפיות: לשון, דופק, מראה כללי..."
  value={tongueAndPulse}
  onChange={setTongueAndPulse}
  minHeight={52}
/>
```

### Section 2 — הטיפול

```jsx
<SectionNumber number={2} color="#C93E2C" bg="#FDEAE6" />
<span>הטיפול — מה נעשה</span>

<FormTextarea
  label="מה נעשה בטיפול"
  placeholder="נקודות דיקור, שיאצו, מוקסה, כוסות, שיטות..."
  value={treatmentDone}
  onChange={setTreatmentDone}
  minHeight={80}
/>

{/* Reuse PhotoAttachment component from Intake */}
<PhotoAttachment
  label="תמונות"
  photos={photos}
  onChange={setPhotos}
  sessionId={sessionId}
/>
```

### Section 3 — המשך

```jsx
<SectionNumber number={3} color="#4A5E4A" bg="#EAF0E6" />
<span>המשך — תכנית ושיעורי בית</span>

<FormTextarea
  label="תכנית לטיפול הבא"
  placeholder="מה יהיה בפגישה הבאה? כיוון, שינויים בגישה..."
  value={treatmentPlan}
  onChange={setTreatmentPlan}
  minHeight={68}
/>

<FormTextarea
  label="שיעורי בית"
  placeholder="המלצות תזונה, תרגילים, שינויים באורח חיים, תה..."
  value={homework}
  onChange={setHomework}
  minHeight={68}
/>

{/* Reuse FormulaSheet component from Intake */}
<FormulaField
  label="פורמולות"
  triggerLabel="הוסף פורמולה לטיפול זה..."
  selectedFormulas={selectedFormulas}
  onChange={setSelectedFormulas}
/>
```

---

## 5. Validation

The save button (both top bar "שמור" and bottom CTA) is **disabled** until
at least one text field contains at least one non-whitespace character.

```typescript
const textFields = [
  clientReport,
  tongueAndPulse,
  treatmentDone,
  treatmentPlan,
  homework,
];

const hasAnyText = textFields.some(f => f.trim().length > 0);

// Disabled state
// opacity: 0.3, pointer-events: none when !hasAnyText
// opacity: 1,   pointer-events: auto when hasAnyText
```

This applies to BOTH:
- The "שמור" button in the `TopBar`
- The "שמור סיכום" CTA at the bottom of the scroll area

They should share the same `hasAnyText` state — when one is disabled,
both are disabled. When one is enabled, both are enabled.

---

## 6. Formulas — Per-Session Logic

Each session note stores its own independent formula list.
This is a snapshot of what was prescribed in THIS session only.

```typescript
// formulas field on notes table: TEXT[]
// Each session note has its own array.
// Do NOT read or modify formulas from other sessions.
// The client profile derives "current formulas" by reading
// the most recent note that has a non-empty formulas array.
```

Reuse the `FormulaSheet` component from the Intake screen.
The same `formula_presets` Supabase table is used.
Adding a new formula here also adds it to the global preset list.
Deleting from the preset list soft-deletes (`is_deleted: true`).

---

## 7. Save Action

```typescript
async function handleSave() {
  if (!hasAnyText) return;

  // 1. Upload any new photos
  const photoUrls = await Promise.all(
    photos
      .filter(p => p.startsWith('data:'))  // only upload new base64 images
      .map(p => uploadPhoto(p, sessionId))
  );

  const allPhotoUrls = [
    ...existingPhotoUrls,
    ...photoUrls,
  ];

  // 2. Upsert note record
  // Use upsert in case a draft was auto-saved
  await supabase
    .from('notes')
    .upsert({
      session_id:       sessionId,
      client_id:        clientId,
      note_type:        'session',
      client_report:    clientReport.trim(),
      tongue_and_pulse: tongueAndPulse.trim(),
      treatment_done:   treatmentDone.trim(),
      treatment_plan:   treatmentPlan.trim(),
      homework:         homework.trim(),
      formulas:         selectedFormulas,
      photo_urls:       allPhotoUrls,
      updated_at:       new Date().toISOString(),
    }, {
      onConflict: 'session_id',
    });

  // 3. Close drawer — Today screen re-fetches and card shows "הושלם"
  handleClose();
}
```

---

## 8. Database Migration

Add the session-note-specific fields to the `notes` table.
These are in addition to the intake fields already added in INTAKE_SCREEN_SPEC.md.

```sql
-- Migration: add_session_note_fields_to_notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS client_report     TEXT,
  ADD COLUMN IF NOT EXISTS tongue_and_pulse  TEXT,
  ADD COLUMN IF NOT EXISTS homework          TEXT;

-- note_type already exists from intake migration
-- treatment_done, treatment_plan, formulas, photo_urls already exist
-- Just confirm they exist before running
```

---

## 9. Hebrew Strings

```typescript
export const SESSION_NOTE_STRINGS = {
  screenTitle:      'סיכום טיפול',
  back:             'היום',
  save:             'שמור',
  submitBtn:        'שמור סיכום',
  bannerTag:        'סיכום',
  sessionLabel:     (n: number, date: string, time: string) =>
                      `טיפול מספר ${n} · ${date} · ${time}`,

  // Section titles
  section1Title:    'הדיווח — מה מביא הלקוח',
  section2Title:    'הטיפול — מה נעשה',
  section3Title:    'המשך — תכנית ושיעורי בית',

  // Field labels
  clientReport:     'דיווח הלקוח',
  tongueAndPulse:   'לשון ודופק',
  treatmentDone:    'מה נעשה בטיפול',
  treatmentPlan:    'תכנית לטיפול הבא',
  homework:         'שיעורי בית',
  formulas:         'פורמולות',
  photos:           'תמונות',

  // Placeholders
  phClientReport:   'מה מדווח הלקוח? תסמינים, שינויים, תחושות, שינה, אנרגיה...',
  phTongueAndPulse: 'תצפיות: לשון, דופק, מראה כללי...',
  phTreatmentDone:  'נקודות דיקור, שיאצו, מוקסה, כוסות, שיטות...',
  phTreatmentPlan:  'מה יהיה בפגישה הבאה? כיוון, שינויים בגישה...',
  phHomework:       'המלצות תזונה, תרגילים, שינויים באורח חיים, תה...',
  phFormulaAdd:     'הוסף פורמולה לטיפול זה...',
};
```

---

## 10. Implementation Checklist

### Component reuse
- [ ] `ClientBanner` extended with `variant` prop — NOT duplicated
- [ ] `FormulaSheet` reused from Intake — NOT rewritten.
      This includes the bottom sheet UI, the search input, the preset list,
      the "add new" row, and the soft-delete logic. Zero new formula code.
- [ ] `FormulaChip` reused from Intake — NOT rewritten
- [ ] `PhotoAttachment` reused from Intake — NOT rewritten.
      This includes BOTH hidden inputs (camera with capture="environment",
      gallery without capture), the input.click() synchronous handler,
      the e.target.value='' reset, and the Supabase Storage upload function.
      Do NOT re-implement photo picking logic anywhere in this screen.
- [ ] `PhotoThumbnail` reused from Intake — NOT rewritten
- [ ] `FormTextarea` reused from Intake — NOT rewritten.
      Every textarea in this screen (client report, tongue & pulse,
      treatment done, treatment plan, homework) must use this component.
      Do NOT write raw <textarea> elements in this screen.
- [ ] `TopBar` reused from Intake — NOT rewritten
- [ ] `SectionNumber` reused from Intake — NOT rewritten

### Screen behaviour
- [ ] Opens as bottom drawer (translateY transition), not full-screen push
- [ ] Drawer overlay behind sheet, tapping overlay closes drawer
- [ ] Drag handle at top of sheet
- [ ] `ClientBanner` uses `variant="session"` — Peach Mist `#FCEEE4` background
- [ ] Avatar shows client initials (not outline icon — client is known)
- [ ] Banner tag says "סיכום" with Poppy background

### Validation
- [ ] Save disabled (opacity 0.3, pointer-events none) on open
- [ ] Save enabled as soon as ANY text field has ≥ 1 non-whitespace character
- [ ] Both top "שמור" and bottom "שמור סיכום" share same disabled state
- [ ] Disables again if all text fields are cleared back to empty

### Save
- [ ] Only uploads new photos (base64), not existing URLs
- [ ] Uses `upsert` with `onConflict: 'session_id'`
- [ ] Closes drawer on success
- [ ] Today screen card updates to "הושלם" after close

### Formulas
- [ ] Per-session snapshot — does not read or write other sessions' formulas
- [ ] Same preset list as Intake (shared `formula_presets` table)
- [ ] New formulas added here also appear in Intake's formula sheet

### RTL
- [ ] Drawer direction: rtl
- [ ] All textareas: direction rtl
- [ ] All labels and section titles: text-align right (inherited from rtl)

### Migration
- [ ] Run migration to add `client_report`, `tongue_and_pulse`, `homework`
      fields to `notes` table before building the screen
