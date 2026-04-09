# Today View — Design Update Spec for Claude Code

## Overview
Update the Today screen (`/today`) to implement the new design system.
Preserve all existing functionality, data logic, routing, and component structure.
This update is scoped to the Today view only.

---

## 1. Design tokens

Apply these CSS variables across the Today screen:

```css
--color-bg:              #f5f0e8;   /* parchment page background */
--color-surface:         #fdfaf6;   /* card background */
--color-border:          #e8e0d4;   /* card borders */
--color-border-nav:      #e0d8cc;   /* header / footer borders */

--color-text-primary:    #2e2a38;
--color-text-secondary:  #a8a0a8;
--color-text-muted:      #b8b0b8;

/* State: intake */
--color-intake-cta-bg:    #eef6f3;
--color-intake-cta-text:  #3a7060;
--color-intake-cta-border:#a8d0c8;
--color-intake-pill:      #4a8a78;

/* State: needs note */
--color-note-cta-bg:      #f9f0f3;
--color-note-cta-text:    #a05870;
--color-note-cta-border:  #e0b8c8;
--color-note-pill:        #c07088;

/* State: completed */
--color-done-bg:          #f4faf7;
--color-done-border:      #c8dfd4;
--color-done-vline:       #a8d0bc;
--color-done-check-bg:    #d8f0e4;
--color-done-check-border:#8ec8a8;
--color-done-check-icon:  #4a9070;
--color-done-text:        #8a9e94;
--color-done-meta:        #90b8a0;
--color-done-pill:        #6888a0;

/* Nav active */
--color-nav-active:       #c07088;

/* Summary pills */
--color-pill-bg:          #ede8de;
--color-pill-border:      #ddd5c8;
```

**Fonts:**
- Display / patient names / time: `Cormorant Garamond`, weight 300–400
- UI labels / meta / CTAs: `Rubik`, weight 400–500

---

## 2. Header — replace current header

Remove the existing header entirely. Replace with:

```
[ ‹ chevron ]    [ TODAY label / Date / subtitle ]    [ › chevron ]
```

### Chevron buttons
- Size: 34×34px circle
- Border: `0.5px solid #d8d0c0`, background: `#eee8da`
- Use SVG chevrons — NOT text characters:
  - **Right button** → navigates to **tomorrow**
  - **Left button** → navigates to **yesterday**
- Right chevron SVG path: `M1.5 1.5L6.5 7L1.5 12.5`
- Left chevron SVG path: `M6.5 1.5L1.5 7L6.5 12.5`
- Stroke: `#2a2a35`, stroke-width 1.5, linecap round, viewBox `0 0 8 14`

### Date center block
- "היום" label: `Rubik` 9px weight 500, `#c07088`, uppercase, letter-spacing 0.14em — visible only when viewing today's date
- Date: `Cormorant Garamond` 22px weight 300, `#2e2a38`
- Subtitle: `Rubik` 10px `#a098a8` — e.g. "7 פגישות · 3 דורשות פעולה" (derive from session count and action count)
- Header bottom border: `0.5px solid #e0d8cc`
- Sticky at top, background `#f5f0e8`

---

## 3. Summary filter pills

Horizontally scrollable RTL row directly below the header.

**Active statuses for this release (show pill only if count > 0):**
- אינטייק — number color `#4a8a78`
- סיכום — number color `#c07088`
- הושלם — number color `#6888a0`

> ⚠️ Do NOT add payment or invoice pills — those features are not yet implemented.

### Pill styling
- Background: `#ede8de`, border: `0.5px solid #ddd5c8`, border-radius: 12px, padding: 8px 11px
- Number: `Cormorant Garamond` 20px weight 300, colored per state above
- Label: `Rubik` 8px uppercase, `#a09898`

### Filter interaction
- Tapping a pill filters the list to show only that status
- Section labels (בוקר / צהריים / ערב) hide if they have no visible sessions after filtering
- Active pill gets: border-width 1.5px + tinted background matching its color family
- A "נקה סינון ✕" button appears in `#c07088` when filter is active
- Tapping the active pill again, or the clear button, resets the view

---

## 4. Session cards

Keep all data and logic. Visual changes only:

### Card container
- Background: `#fdfaf6`
- Border: `0.5px solid #e8e0d4`, border-radius: 16px
- Remove any left-side colored accent bar

### Time column
- Single inline string: `08:00` — no line break between hour and minutes
- `Cormorant Garamond` 19px weight 300, `#2e2a38`
- Remove the divider/separator line between time and card body

### Patient name
- `Cormorant Garamond` 18px weight 400, `#2e2a38`

### Meta line
- `Rubik` 11px, `#a8a0a8`
- Show duration only (e.g. "45 דק׳")
- **Remove chief complaint**

### Status badge — REMOVE
- Do not render any chip or badge on the card
- The CTA communicates the status

### CTA button
- border-radius: 10px, padding: 9px 16px, margin: 0 14px 12px
- `Rubik` 11px weight 500, letter-spacing 0.06em, border: 0.5px solid

| Status | Label | bg | text | border |
|---|---|---|---|---|
| Intake | התחל אינטייק | `#eef6f3` | `#3a7060` | `#a8d0c8` |
| Needs note | כתוב סיכום | `#f9f0f3` | `#a05870` | `#e0b8c8` |

---

## 5. Completed session cards

No CTA. Visually receded to signal "done, nothing to do":

- Card background: `#f4faf7`
- Card border: `0.5px solid #c8dfd4`
- Vertical divider line: `#a8d0bc`
- Patient name: `#8a9e94`
- Time: `#b0a8b0`
- Meta: `#90b8a0`, text "הושלם"
- **Green checkmark circle** on the trailing edge of the card:
  - 26×26px circle, background `#d8f0e4`, border `1.5px solid #8ec8a8`
  - SVG: `<path d="M1 5L4.5 8.5L11 1.5" stroke="#4a9070" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>` inside viewBox `0 0 12 10`

---

## 6. Section labels

- `Rubik` 9px weight 500, uppercase, letter-spacing 0.14em, color `#c0b8c0`
- Groups: בוקר / צהריים / ערב — keep existing grouping logic
- Hide label when all its sessions are filtered out

---

## 7. Bottom nav — tab order and colors

**Order right → left (RTL):**

| Position | Label | Icon |
|---|---|---|
| Right | היום | Calendar |
| Middle | לקוחות | People |
| Left | התראות | Bell |

- Background: `#f5f0e8`, top border: `0.5px solid #e0d8cc`
- Active tab: `#c07088` on both icon stroke and label
- Inactive: `#a8a0a8`
- Notification dot on bell when alerts exist: 4px circle `#c07088`, absolute top-right of icon

---

## 8. What NOT to change

- All routing and navigation logic
- Google Calendar data fetching and session mapping
- Session status derivation logic
- Supabase queries
- Any other screen (clients, patient profile, notes)
- RTL page direction (`dir="rtl"`)
- Existing CTA tap actions and handlers
