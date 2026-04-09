# Intake Screen — Design & Implementation Specification
### For Claude Code · Wellness PWA

---

## 0. Overview

The Intake screen is a **full-screen navigation push** (not a drawer).
It is triggered by tapping "התחל אינטייק ←" on a new-client session card in the Today screen.

**Purpose:** Create a new client record + first session note in a single save action.  
**On save:** Write to `clients` table + `sessions` table + `notes` table in Supabase atomically.  
**On cancel/back:** Discard everything, return to Today screen.

---

## 1. RTL & Layout

```css
/* Inherit global direction: rtl from root */
.intake-screen {
  direction: rtl;
  font-family: var(--font-ui);
  background: var(--color-bg);
  height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
```

The screen has three layers stacked:
1. `.topbar` — sticky, never scrolls
2. `.scroll-content` — `overflow-y: auto`, `flex: 1`
3. `.formula-sheet` — absolute positioned bottom sheet, slides up over content

---

## 2. Top Bar

```jsx
<div className="topbar">
  {/* right side — back in RTL = visually left */}
  <button className="back-btn" onClick={handleBack}>
    <ChevronRightIcon /> {/* › pointing right in RTL context */}
    היום
  </button>
  <h1 className="topbar-title">אינטייק ראשוני</h1>
  {/* Save — disabled until required fields filled */}
  <button className="save-btn" onClick={handleSave} disabled={!isValid}>
    שמור
  </button>
</div>
```

```css
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 20px 12px;
  background: var(--color-bg);
  border-bottom: 0.5px solid var(--color-border);
  flex-shrink: 0;
}

.topbar-title {
  font-family: var(--font-display);
  font-size: 20px;
  color: var(--color-text-primary);
  text-align: center;
  flex: 1;
  font-weight: 400;
}

.back-btn, .save-btn {
  font-size: 13px;
  font-weight: 500;
  color: var(--color-poppy);
  background: transparent;
  border: none;
  cursor: pointer;
  font-family: var(--font-ui);
  padding: 4px;
}

.save-btn:disabled { opacity: 0.3; cursor: default; }
```

---

## 3. Client Banner

Shown at top of scroll area, always visible.  
Populated from the Google Calendar event that triggered the intake.

```jsx
<div className="client-banner">
  <div className="client-banner-avatar">
    <PersonOutlineIcon />  {/* SVG outline — no initials yet */}
  </div>
  <div className="client-banner-info">
    <span className="client-banner-label">
      לקוח חדש · {dayName} {formattedDate} {sessionTime}
    </span>
    <span className="client-banner-name">{gcalEventTitle}</span>
  </div>
  <span className="client-banner-tag">לקוח חדש</span>
</div>
```

```css
.client-banner {
  background: var(--color-ink);   /* #282B30 */
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.client-banner-avatar {
  width: 40px; height: 40px;
  border-radius: 50%;
  background: var(--color-ink-muted);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

.client-banner-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(250, 249, 246, 0.45);
  display: block;
  margin-bottom: 2px;
}

.client-banner-name {
  font-family: var(--font-display);
  font-size: 16px;
  color: #FAF9F6;
}

.client-banner-tag {
  font-size: 9px;
  font-weight: 500;
  background: var(--color-poppy);
  color: #fff;
  padding: 2px 9px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
```

---

## 4. Form Sections

### 4a. פרטים אישיים (Personal Details)

#### Full name
```jsx
<input
  type="text"
  value={fullName}
  onChange={e => setFullName(e.target.value)}
  placeholder="שם פרטי ושם משפחה"
  defaultValue={gcalEventTitle}  // pre-populate from calendar
  className="form-input"
  required
/>
```

#### Gender — visual thumbnails
```jsx
const [gender, setGender] = useState(null); // 'female' | 'male' | null

<div className="gender-row">
  <div
    className={`gender-option ${gender === 'female' ? 'selected' : ''}`}
    onClick={() => setGender('female')}
  >
    <FemaleIcon />
    <span>אישה</span>
  </div>
  <div
    className={`gender-option ${gender === 'male' ? 'selected' : ''}`}
    onClick={() => setGender('male')}
  >
    <MaleIcon />
    <span>גבר</span>
  </div>
</div>
```

```css
.gender-row { display: flex; gap: 10px; }

.gender-option {
  flex: 1;
  border-radius: 12px;
  border: 1.5px solid var(--color-border);
  background: var(--color-surface);
  padding: 14px 10px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.gender-option.selected {
  border-color: var(--color-ink);
  background: #F2F0EE;
}

.gender-option span {
  font-size: 12px;
  font-weight: 500;
  color: var(--color-text-primary);
}
```

#### Age slider

```jsx
const [age, setAge] = useState(30); // DEFAULT IS 30

<div className="age-row">
  <span className="age-value">{age}</span>
  <input
    type="range"
    min={1}           // MIN IS 1
    max={90}          // MAX IS 90
    step={1}
    value={age}
    onChange={e => setAge(Number(e.target.value))}
    style={{ direction: 'ltr' }}  // CRITICAL — range inputs must be ltr
  />
</div>
```

```css
/* Age slider track — direction: ltr is REQUIRED on the input element itself */
input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: var(--color-border);
  border-radius: 2px;
  outline: none;
  direction: ltr;  /* non-negotiable */
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--color-ink);
  cursor: pointer;
  border: 3px solid var(--color-bg);
  box-shadow: 0 1px 4px rgba(0,0,0,0.2);
}

/* Fill track left of thumb using JS inline style */
/* Set on the input: style={{ background: `linear-gradient(to right, #282B30 0%, #282B30 ${pct}%, #EDEAE4 ${pct}%, #EDEAE4 100%)` }} */
```

### 4b. פרטי קשר (Contact — pre-populated from Google)

```jsx
// Pre-populated from Google Calendar event attendee data
// Fields are editable but clearly marked as coming from Google

<div className="field-label-row">
  <span>טלפון</span>
  <span className="prepop-badge">מגוגל</span>
</div>
<input
  className="form-input form-input-prepopulated"
  value={phone}
  onChange={e => setPhone(e.target.value)}
/>

<div className="field-label-row">
  <span>אימייל</span>
  <span className="prepop-badge">מגוגל</span>
</div>
<input
  className="form-input form-input-prepopulated"
  value={email}
  onChange={e => setEmail(e.target.value)}
  dir="ltr"              // email addresses are always LTR
  style={{ textAlign: 'left' }}
/>
```

```css
.form-input-prepopulated {
  background: #F5F3F0;
  color: var(--color-text-secondary);
}

.prepop-badge {
  font-size: 9px;
  font-weight: 500;
  color: var(--color-sage-deeper);
  background: var(--color-sage-tint);
  padding: 1px 7px;
  border-radius: var(--radius-pill);
}
```

### 4c. מצב קליני & 4d. טיפול

All textarea fields. Nothing special — `direction: rtl`, `resize: none`.

---

## 5. Formulas Field

### Data model

```typescript
// Supabase table: formula_presets
// Scoped per practitioner (single user app, but future-proof)
interface FormulaPreset {
  id: string;
  name: string;
  created_at: string;
  is_deleted: boolean;
}

// On the session/note record:
// formulas: string[]  — array of formula names used in this session
```

### State

```typescript
const [presetList, setPresetList]         = useState<string[]>([]); // loaded from Supabase
const [selectedFormulas, setSelected]     = useState<string[]>([]);
const [sheetOpen, setSheetOpen]           = useState(false);
const [searchQuery, setSearchQuery]       = useState('');
```

### Render: selected chips

```jsx
<div className="formula-chips-row">
  {selectedFormulas.map((f, i) => (
    <div key={i} className="formula-chip">
      <span>{f}</span>
      <button onClick={() => removeSelected(f)} aria-label="הסר">×</button>
    </div>
  ))}
</div>
<div className="formula-add-trigger" onClick={() => setSheetOpen(true)}>
  <PlusCircleIcon />
  <span>הוסף פורמולה...</span>
</div>
```

### Bottom sheet

```jsx
{sheetOpen && (
  <>
    <div className="sheet-overlay" onClick={() => setSheetOpen(false)} />
    <div className="formula-sheet open">
      <div className="sheet-handle" />
      <div className="sheet-header">
        <span>בחר פורמולה</span>
        <button onClick={() => setSheetOpen(false)}>סגור</button>
      </div>

      {/* Search / add new */}
      <input
        className="sheet-search-input"
        placeholder="חפש או הוסף פורמולה..."
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        autoFocus
      />

      {/* Filtered preset list */}
      <div className="sheet-scroll-list">
        {filteredPresets.map(f => (
          <div key={f} className="sheet-list-item">
            <span style={selectedFormulas.includes(f) ? { textDecoration:'line-through', color:'#8A8680' } : {}}>
              {f}
            </span>
            <div className="sheet-item-actions">
              {!selectedFormulas.includes(f) && (
                <button onClick={() => selectFormula(f)}>הוסף</button>
              )}
              {/* DELETE FROM PRESET — removes from master list */}
              <button
                className="sheet-item-delete"
                onClick={() => deleteFromPreset(f)}
                aria-label="מחק מהרשימה"
              >
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* "Add new" row — shown when query doesn't match any preset */}
      {searchQuery && !exactPresetMatch && (
        <div className="sheet-add-new" onClick={addNewToPreset}>
          <PlusCircleIcon />
          <span>הוסף "{searchQuery}" לרשימה</span>
        </div>
      )}
    </div>
  </>
)}
```

### Preset list logic

```typescript
// Load on mount
useEffect(() => {
  const presets = await supabase
    .from('formula_presets')
    .select('name')
    .eq('is_deleted', false)
    .order('created_at', { ascending: false });
  setPresetList(presets.data.map(p => p.name));
}, []);

// Add new formula to preset (called when user types a new name and confirms)
async function addNewToPreset() {
  const name = searchQuery.trim();
  if (!name || presetList.includes(name)) return;
  await supabase.from('formula_presets').insert({ name });
  setPresetList(prev => [name, ...prev]);
  setSelected(prev => [...prev, name]);
  setSheetOpen(false);
  setSearchQuery('');
}

// Delete from preset list (soft delete)
async function deleteFromPreset(name: string) {
  await supabase
    .from('formula_presets')
    .update({ is_deleted: true })
    .eq('name', name);
  setPresetList(prev => prev.filter(p => p !== name));
  // Also remove from current selection if selected
  setSelected(prev => prev.filter(s => s !== name));
}

// Select from preset
function selectFormula(name: string) {
  if (!selectedFormulas.includes(name)) {
    setSelected(prev => [...prev, name]);
  }
  setSheetOpen(false);
  setSearchQuery('');
}

function removeSelected(name: string) {
  setSelected(prev => prev.filter(s => s !== name));
}

const filteredPresets = presetList.filter(f =>
  f.toLowerCase().includes(searchQuery.toLowerCase())
);
const exactPresetMatch = presetList.some(
  f => f.toLowerCase() === searchQuery.toLowerCase()
);
```

---

## 6. Photo Attachment — CRITICAL iOS/Android Implementation

### Why this is tricky in a PWA

- `<button onClick={() => input.click()}>` can silently fail on iOS Safari
  if the `.click()` is not called in the **same synchronous callstack** as the tap event.
- iOS Safari in PWA (home screen) mode has stricter user gesture requirements than browser mode.
- `capture="environment"` on iOS forces the camera — it WILL NOT show the gallery option.
- Never use `setTimeout`, `Promise`, or `async/await` between the user tap and `input.click()`.

### Correct implementation

```tsx
// Two separate hidden inputs — one for camera, one for gallery.
// This is the most reliable cross-platform approach.

const cameraInputRef = useRef<HTMLInputElement>(null);
const galleryInputRef = useRef<HTMLInputElement>(null);
const [photos, setPhotos] = useState<string[]>([]);

// ── CAMERA BUTTON ──
// iOS: opens native camera directly
// Android: opens camera directly
const handleCameraClick = () => {
  // MUST call .click() synchronously, directly inside the event handler.
  // No await, no setTimeout, no intermediate async step.
  cameraInputRef.current?.click();
};

// ── GALLERY BUTTON ──
// iOS: shows native photo picker (Photos app)
// Android: shows file picker with gallery/camera options
const handleGalleryClick = () => {
  galleryInputRef.current?.click();
};

// ── FILE CHANGE HANDLER ── (same for both inputs)
const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
  const files = Array.from(e.target.files || []);
  files.forEach(file => {
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos(prev => [...prev, reader.result as string]);
    };
    reader.readAsDataURL(file);
  });
  // IMPORTANT: Reset the input value so the same file can be re-selected.
  e.target.value = '';
};
```

```tsx
// ── HIDDEN INPUTS — place these OUTSIDE the scrollable area, at root of component ──
// They must be in the DOM at all times, not conditionally rendered.

<>
  {/* Camera input — capture="environment" = rear camera, "user" = front */}
  <input
    ref={cameraInputRef}
    type="file"
    accept="image/*"
    capture="environment"
    onChange={handleFileChange}
    style={{ display: 'none' }}
    aria-hidden="true"
  />

  {/* Gallery input — NO capture attribute = shows photo library */}
  <input
    ref={galleryInputRef}
    type="file"
    accept="image/*"
    // DO NOT add capture here — it would bypass the gallery on iOS
    multiple       // allow selecting multiple images
    onChange={handleFileChange}
    style={{ display: 'none' }}
    aria-hidden="true"
  />

  {/* UI buttons */}
  <div className="photo-buttons-row">
    <div className="photo-button" onClick={handleCameraClick}>
      <CameraIcon />
      <span>מצלמה</span>
    </div>
    <div className="photo-button" onClick={handleGalleryClick}>
      <GalleryIcon />
      <span>גלריה</span>
    </div>
  </div>

  {/* Thumbnails */}
  <div className="photo-thumbnails">
    {photos.map((src, i) => (
      <div key={i} className="photo-thumb">
        <img src={src} alt={`תמונה ${i+1}`} />
        <button
          className="photo-thumb-delete"
          onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
          aria-label="הסר תמונה"
        >
          ×
        </button>
      </div>
    ))}
  </div>
</>
```

### Platform behaviour summary

| Scenario | Camera input (capture="environment") | Gallery input (no capture) |
|---|---|---|
| iOS Safari browser | Opens camera directly | Opens native photo picker sheet |
| iOS PWA (home screen) | Opens camera directly | Opens native photo picker sheet |
| Android Chrome | Opens camera directly | Shows chooser: camera or files |
| Android PWA | Opens camera directly | Shows chooser: camera or files |

### Uploading to Supabase Storage

```typescript
async function uploadPhoto(dataUrl: string, sessionId: string): Promise<string> {
  // Convert base64 dataUrl to Blob
  const res = await fetch(dataUrl);
  const blob = await res.blob();
  const ext = blob.type.split('/')[1] || 'jpg';
  const filename = `${sessionId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('session-photos')
    .upload(filename, blob, {
      contentType: blob.type,
      upsert: false,
    });

  if (error) throw error;

  const { data: { publicUrl } } = supabase.storage
    .from('session-photos')
    .getPublicUrl(filename);

  return publicUrl;
}
```

### Notes on iOS PWA permissions

- iOS 13+ allows camera access in PWA home screen mode.
- iOS does NOT require explicit `getUserMedia` for `<input type="file" capture>` — the system handles permissions.
- No `navigator.permissions.query` is needed.
- If the user has previously denied camera access, `input.click()` will either silently fail or show a system prompt to go to Settings — handle this gracefully with a try/catch and a user-friendly message.

---

## 7. Form Validation

```typescript
// Required fields
const isValid =
  fullName.trim().length > 0 &&
  chiefComplaint.trim().length > 0 &&
  sessionNotes.trim().length > 0;
```

The Save button (`שמור`) in the top bar is disabled (opacity 0.3) until `isValid` is true.

---

## 8. Save Action

```typescript
async function handleSave() {
  if (!isValid) return;

  // 1. Upload photos (parallel)
  const photoUrls = await Promise.all(
    photos.map(p => uploadPhoto(p, gcalEventId))
  );

  // 2. Create client record
  const { data: client } = await supabase
    .from('clients')
    .insert({
      full_name:       fullName,
      gender:          gender,
      age:             age,
      phone:           phone,
      email:           email,
      created_from:    'intake',
      gcal_event_id:   gcalEventId,
    })
    .select()
    .single();

  // 3. Create session record (links to the Google Calendar event)
  const { data: session } = await supabase
    .from('sessions')
    .insert({
      client_id:       client.id,
      gcal_event_id:   gcalEventId,
      session_date:    gcalEventDate,
      session_type:    'intake',
    })
    .select()
    .single();

  // 4. Create note record
  await supabase
    .from('notes')
    .insert({
      session_id:      session.id,
      client_id:       client.id,
      chief_complaint: chiefComplaint,
      diagnosis:       diagnosis,
      treatment_done:  treatmentDone,
      treatment_plan:  treatmentPlan,
      formulas:        selectedFormulas,
      photo_urls:      photoUrls,
      note_type:       'intake',
    });

  // 5. Navigate back to Today — the session card should now show as "הושלם"
  navigate('/today');
}
```

---

## 9. Hebrew Strings

```typescript
export const INTAKE_STRINGS = {
  screenTitle:       'אינטייק ראשוני',
  back:              'היום',
  save:              'שמור',
  newClientLabel:    'לקוח חדש',
  submitBtn:         'צור כרטיס לקוח ושמור סיכום',

  // Sections
  sectionPersonal:   'פרטים אישיים',
  sectionContact:    'פרטי קשר',
  sectionClinical:   'מצב קליני',
  sectionTreatment:  'טיפול',
  sectionFormulas:   'פורמולות',
  sectionPhotos:     'תמונות',

  // Fields
  fullName:          'שם מלא',
  gender:            'מגדר',
  genderFemale:      'אישה',
  genderMale:        'גבר',
  age:               'גיל',
  phone:             'טלפון',
  email:             'אימייל',
  fromGoogle:        'מגוגל',
  chiefComplaint:    'תלונה עיקרית',
  diagnosis:         'אבחנה',
  treatmentDone:     'מה נעשה בטיפול',
  treatmentPlan:     'תכנית טיפול',

  // Formulas sheet
  formulaSheetTitle: 'בחר פורמולה',
  formulaClose:      'סגור',
  formulaSearch:     'חפש או הוסף פורמולה...',
  formulaAdd:        'הוסף',
  formulaAddNew:     (name: string) => `הוסף "${name}" לרשימה`,
  formulaTrigger:    'הוסף פורמולה...',

  // Photos
  cameraBtn:         'מצלמה',
  galleryBtn:        'גלריה',

  // Placeholders
  phFullName:        'שם פרטי ושם משפחה',
  phChiefComplaint:  'תאר את הסיבה העיקרית לפנייה...',
  phDiagnosis:       'לפי RA״מ / TCM...',
  phTreatmentDone:   'נקודות שנבחרו, שיטות, תצפיות...',
  phTreatmentPlan:   'תדירות, מספר טיפולים, יעדים...',
};
```

---

## 10. Implementation Checklist

- [ ] Screen is full-screen push navigation, not a drawer
- [ ] `tokens.css` tokens used throughout — no hardcoded hex values
- [ ] `direction: rtl` inherited from root
- [ ] Age slider: `min=1`, `max=90`, `defaultValue=30`, `direction: ltr` on input element
- [ ] Gender thumbnails: `selected` state uses Ink border (#282B30)
- [ ] Phone + email pre-populated from Google Calendar attendee
- [ ] Phone + email have "מגוגל" green badge
- [ ] Email input has `dir="ltr"` and `textAlign: left`
- [ ] Formula presets loaded from `formula_presets` Supabase table
- [ ] New formula items saved to `formula_presets` immediately on add
- [ ] Delete from preset does soft delete (`is_deleted: true`) in Supabase
- [ ] Formula bottom sheet slides up with CSS transform transition
- [ ] "Add new" row in sheet only visible when query ≠ any existing preset
- [ ] Camera hidden input has `capture="environment"`
- [ ] Gallery hidden input has NO `capture` attribute
- [ ] Both hidden inputs are always in the DOM (not conditionally rendered)
- [ ] `input.click()` called **synchronously** directly inside `onClick` handler
- [ ] No `setTimeout` / `async/await` before `input.click()`
- [ ] `e.target.value = ''` after file selection (allows re-selecting same file)
- [ ] Photos uploaded to Supabase Storage bucket `session-photos`
- [ ] Save creates: client record + session record + note record atomically
- [ ] Save button disabled until `fullName + chiefComplaint + treatmentDone` filled
- [ ] On save success → navigate back to Today, session card state = "הושלם"

---

## 11. Banner — Peach Family (updated)

The client banner uses **Peach Tint**, not Ink. The dark banner has been replaced.

```css
.client-banner {
  background: var(--color-peach-tint);       /* #FFF3EC */
  border-bottom: 0.5px solid #F5D0B4;
  padding: 14px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.client-banner-avatar {
  width: 42px; height: 42px;
  border-radius: 50%;
  background: var(--color-peach);            /* #FFC6AD */
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
}

/* Person SVG icon inside avatar — use peach-deep color */
.client-banner-avatar svg { stroke: var(--color-peach-deep); /* #D4845A */ }

.client-banner-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-peach-deep);            /* #D4845A */
  display: block;
  margin-bottom: 2px;
}

.client-banner-name {
  font-family: var(--font-display);
  font-size: 17px;
  color: var(--color-text-primary);          /* #282B30 */
}

/* "לקוח חדש" tag stays Poppy */
.client-banner-tag {
  background: var(--color-poppy);
  color: #fff;
  font-size: 9px;
  font-weight: 500;
  padding: 3px 10px;
  border-radius: var(--radius-pill);
  flex-shrink: 0;
}
```

Photo button icons use `var(--color-peach-deep)` (#D4845A) instead of Ink,
and the icon background is `var(--color-peach-tint)` (#FFF3EC).

---

## 12. Database Migrations

### 12a. `clients` table — add intake fields

The intake form writes directly to the `clients` table. These fields must be
added as a migration. All fields are nullable so existing client records
(created before intake flow existed) are not broken.

```sql
-- Migration: add_intake_fields_to_clients
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS gender          TEXT CHECK (gender IN ('female', 'male', 'other')),
  ADD COLUMN IF NOT EXISTS age             INTEGER CHECK (age >= 1 AND age <= 90),
  ADD COLUMN IF NOT EXISTS phone           TEXT,
  ADD COLUMN IF NOT EXISTS email           TEXT,
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis       TEXT,
  ADD COLUMN IF NOT EXISTS treatment_plan  TEXT,
  ADD COLUMN IF NOT EXISTS created_from    TEXT DEFAULT 'manual'
                                           CHECK (created_from IN ('manual', 'intake')),
  ADD COLUMN IF NOT EXISTS gcal_event_id   TEXT;  -- the calendar event that triggered intake
```

> **Important:** `chief_complaint`, `diagnosis`, and `treatment_plan` live on
> BOTH the `clients` table (as the baseline/intake values on the client chart)
> AND on each `notes` record (per-session values that may change over time).
> The intake save writes to both simultaneously.

### 12b. `notes` table — ensure all intake fields present

```sql
-- Migration: add_intake_fields_to_notes
ALTER TABLE notes
  ADD COLUMN IF NOT EXISTS note_type       TEXT DEFAULT 'session'
                                           CHECK (note_type IN ('session', 'intake')),
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis       TEXT,
  ADD COLUMN IF NOT EXISTS treatment_done  TEXT,
  ADD COLUMN IF NOT EXISTS treatment_plan  TEXT,
  ADD COLUMN IF NOT EXISTS formulas        TEXT[],   -- array of formula names
  ADD COLUMN IF NOT EXISTS photo_urls      TEXT[];   -- array of Supabase Storage URLs
```

### 12c. `formula_presets` table — new table

```sql
-- Migration: create_formula_presets
CREATE TABLE IF NOT EXISTS formula_presets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL UNIQUE,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed with common TCM formulas
INSERT INTO formula_presets (name) VALUES
  ('Gui Zhi Fu Ling Wan'),
  ('Xiao Yao San'),
  ('Liu Wei Di Huang Wan'),
  ('Ba Zhen Tang'),
  ('Si Ni San'),
  ('Chai Hu Shu Gan San'),
  ('Tian Wang Bu Xin Dan'),
  ('Er Chen Tang'),
  ('Zhi Bai Di Huang Wan'),
  ('Wen Jing Tang')
ON CONFLICT (name) DO NOTHING;
```

### 12d. Supabase Storage bucket

```sql
-- Run in Supabase dashboard SQL editor or via CLI
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-photos', 'session-photos', false)
ON CONFLICT (id) DO NOTHING;
```

Storage policy (authenticated user can read/write their own files):
```sql
CREATE POLICY "Authenticated users can upload session photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'session-photos');

CREATE POLICY "Authenticated users can read session photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'session-photos');
```

---

## 13. Intake Save — Full Write (updated)

The save action writes to **three tables simultaneously** and updates
the `clients` record with the intake baseline values.

```typescript
async function handleSave() {
  if (!isValid) return;

  // 1. Upload photos in parallel
  const photoUrls = await Promise.all(
    photos.map(p => uploadPhoto(p, gcalEventId))
  );

  // 2. Create (or upsert) client record
  //    Includes all intake fields — these become the client's baseline chart
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .insert({
      full_name:        fullName,
      gender:           gender,
      age:              age,
      phone:            phone,
      email:            email,
      chief_complaint:  chiefComplaint,   // baseline on client chart
      diagnosis:        diagnosis,        // baseline on client chart
      treatment_plan:   treatmentPlan,    // baseline on client chart
      created_from:     'intake',
      gcal_event_id:    gcalEventId,
    })
    .select()
    .single();

  if (clientError) throw clientError;

  // 3. Create session record
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({
      client_id:      client.id,
      gcal_event_id:  gcalEventId,
      session_date:   gcalEventDate,
      session_type:   'intake',
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  // 4. Create note record
  //    Note also stores its own copy of clinical fields (snapshot of this session)
  const { error: noteError } = await supabase
    .from('notes')
    .insert({
      session_id:       session.id,
      client_id:        client.id,
      note_type:        'intake',
      chief_complaint:  chiefComplaint,
      diagnosis:        diagnosis,
      treatment_done:   treatmentDone,
      treatment_plan:   treatmentPlan,
      formulas:         selectedFormulas,
      photo_urls:       photoUrls,
    });

  if (noteError) throw noteError;

  // 5. Navigate back — card updates to "הושלם"
  navigate('/today');
}
```

> **Why duplicate fields?** The `clients` table stores the **baseline** values
> from the intake (what the client presented with when they first arrived).
> Each `notes` record stores **per-session** values that evolve over time.
> Future sessions may have different diagnoses, treatment plans, and formulas —
> the client chart baseline stays fixed as the intake snapshot unless
> explicitly edited by the practitioner.
