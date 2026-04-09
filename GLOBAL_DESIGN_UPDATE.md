# Global Design System Update — All Screens

## Context
The Today view has already been redesigned with a new design system. This prompt applies that same system consistently across every other screen in the app. Do not touch the Today view — it is already done.

Before starting, read the completed Today view implementation to understand the established patterns, then apply them everywhere else.

---

## The Design System

### Colors
```css
/* Backgrounds */
--color-bg:               #f5f0e8;   /* parchment — all page backgrounds */
--color-surface:          #fdfaf6;   /* cards, panels */
--color-surface-alt:      #ede8de;   /* subtle nested surfaces, pills */
--color-border:           #e8e0d4;   /* card borders */
--color-border-nav:       #e0d8cc;   /* header / footer / dividers */

/* Text */
--color-text-primary:     #2e2a38;
--color-text-secondary:   #a8a0a8;
--color-text-muted:       #b8b0b8;

/* Intake state */
--color-intake-bg:        #eef6f3;
--color-intake-text:      #3a7060;
--color-intake-border:    #a8d0c8;

/* Needs note state */
--color-note-bg:          #f9f0f3;
--color-note-text:        #a05870;
--color-note-border:      #e0b8c8;

/* Completed state */
--color-done-bg:          #f4faf7;
--color-done-border:      #c8dfd4;
--color-done-text:        #8a9e94;

/* Primary action / nav active */
--color-primary:          #c07088;

/* Avatar alternating colors */
--color-avatar-a-bg:      #f5e8ee;   /* rose family */
--color-avatar-a-text:    #a05870;
--color-avatar-b-bg:      #eef6f3;   /* teal family */
--color-avatar-b-text:    #3a7060;
```

### Fonts
```css
/* Display: patient names, dates, headings */
font-family: 'Cormorant Garamond', Georgia, serif;
font-weight: 300 (light) or 400 (regular);

/* UI: everything else — labels, meta, buttons, inputs */
font-family: 'Rubik', sans-serif;
font-weight: 400 (regular) or 500 (medium);
```

Make sure both fonts are imported. They are already in the project from the Today view update.

### Shared component rules
- All page backgrounds: `#f5f0e8`
- All cards: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 16px
- All dividers/borders between sections: `0.5px solid #e0d8cc`
- All top bars / sticky headers: bg `#f5f0e8`, bottom border `0.5px solid #e0d8cc`
- All back buttons / primary text links: color `#c07088`
- All CTA buttons: soft outlined style — light tinted bg, colored text, 0.5px border (see Today view for reference)
- Section labels: `Rubik` 9px weight 500, uppercase, letter-spacing 0.14em, `#b8b0b8`
- Remove any solid filled buttons (dark/black backgrounds) — replace with the soft outlined style

---

## Screen-by-screen instructions

### 1. Client List screen

- Page background: `#f5f0e8`
- Screen title ("לקוחות"): `Cormorant Garamond` 26px weight 300, `#2e2a38`
- Search box: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 12px
- Sort buttons (alphabetical / recency): outlined pill style — inactive: border `0.5px solid #d8d0c0`, text `#a8a0a8` — active: border `#2e2a38`, text `#2e2a38`, bg `#ede8de`
- Client rows: bg `#fdfaf6`, bottom border `0.5px solid #e8e0d4`
- Client name: `Cormorant Garamond` 17px weight 400, `#2e2a38`
- Client sub-line (last session, session count): `Rubik` 11px, `#a8a0a8`
- Avatars: alternate between rose (`#f5e8ee` / `#a05870`) and teal (`#eef6f3` / `#3a7060`) families, `Cormorant Garamond` initials

### 2. Client Profile screen

- Page background: `#f5f0e8`
- Top bar: bg `#f5f0e8`, border `0.5px solid #e0d8cc`, back button color `#c07088`
- Patient banner: bg `#f5e8ee`, border-bottom `0.5px solid #e0b8c8` — patient name in `Cormorant Garamond` 22px weight 300, `#2e2a38`
- "פרטי המטופל/ת" card: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 16px
- Field labels inside the card: `Rubik` 10px uppercase `#b8b0b8`
- Field values: `Rubik` 13px `#2e2a38`
- Section divider between patient details and session list: `0.5px solid #e0d8cc`
- "upcoming" session items: bg `#eef6f3`, border `0.5px solid #a8d0c8` — teal family
- "past" session items: bg `#fdfaf6`, border `0.5px solid #e8e0d4`
- Session date/time: `Cormorant Garamond` 16px weight 300
- Session meta: `Rubik` 11px `#a8a0a8`
- "תצוגת תיק מלאה" button: outlined pill, border `0.5px solid #d8d0c0`, text `#a8a0a8`, bg transparent

### 3. Session Note — read-only view

- Page background: `#f5f0e8`
- Top bar: same as above, back button `#c07088`
- Document card: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 16px, padding generous
- Section headings inside note: `Cormorant Garamond` 16px weight 400, `#2e2a38`
- Section numbers/circles: bg `#ede8de`, text `#2e2a38`
- Body text / note content: `Rubik` 13px `#2e2a38`, line-height 1.7
- Formula chips: bg `#eef6f3`, border `0.5px solid #a8d0c8`, text `#3a7060`
- "חתימה" / signed footer: `Rubik` 11px `#b8b0b8`

### 4. Session Note — editable / write view

- Page background: `#f5f0e8`
- Top bar: same style, "שמור" save button: outlined, border `0.5px solid #a8d0c8`, text `#3a7060`, bg `#eef6f3`
- Input fields / textareas: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 12px, `Rubik` 13px `#2e2a38`
- Focused input border: `0.5px solid #c07088`
- Section labels above inputs: `Rubik` 9px uppercase `#b8b0b8`
- Formula chip add button: same teal outlined style

### 5. Intake form

- Page background: `#f5f0e8`
- Top bar: same style
- All form cards/sections: bg `#fdfaf6`, border `0.5px solid #e8e0d4`, border-radius 16px
- Input styling: same as session note editable view above
- "שמור אינטייק" submit button: bg `#eef6f3`, text `#3a7060`, border `0.5px solid #a8d0c8`
- Required field indicators: `#c07088`

### 6. Full patient file view ("תצוגת תיק מלאה")

- Page background: `#f5f0e8`
- Document sections: same card style as read-only note
- Section dividers: `0.5px solid #e0d8cc`
- Export / print button: outlined, `#a8a0a8`

---

## Bottom navigation

Already updated on the Today view. Make sure the same nav renders consistently on the Clients tab with:
- Active tab color: `#c07088`
- Inactive: `#a8a0a8`
- Tab order right → left: היום · לקוחות · התראות

---

## What NOT to change

- All data fetching, Supabase queries, Google Calendar calls
- All routing and navigation logic
- Form validation and submission handlers
- Authentication / email allowlist logic
- Any business logic or status derivation
- RTL page direction (`dir="rtl"`)
