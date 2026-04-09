# Splash Screen & Login Screen — Implementation Spec

## Setup

A logo image file is attached to this prompt. Save it to `public/logo.png`.
Use it as a standard `<img>` tag everywhere — do not recreate it in SVG or CSS.

---

## Screen 1 — Splash Screen

### Route & behavior
- Renders at app startup before auth check
- Displays for a minimum of 2 seconds
- After 2 seconds, check auth state:
  - If user is already authenticated → navigate to `/today`
  - If not authenticated → navigate to `/login`
- Do not let the user interact with this screen — it is purely a loading/brand moment

### Layout
Full screen, centered column, `direction: rtl`, background `#f5f0e8`.

Three elements stacked vertically, centered horizontally, with generous spacing between them:

```
[ logo ]
[ wordmark ]
[ loader dots ]
```

### Logo
```html
<img src="/logo.png" width="200" height="200" alt="מרפאה שלי" />
```
- Centered
- No border, no shadow, no circle wrapper — the logo is already circular
- Animation: fade in from opacity 0 to 1 over 600ms, easing `ease-out`, delay 0ms

### Wordmark
Two lines, centered:

**Line 1 — app name:**
```
מרפאה שלי
```
- Font: `Cormorant Garamond`, 36px, weight 300
- Color: `#2e2a38`
- "שלי" rendered in `<em>` — italic, color `#c07088`
- Letter-spacing: 0.06em

**Divider:** a 34px wide, 0.5px horizontal line, color `#c0b0b8`, opacity 0.5, centered

**Line 2 — tagline:**
```
ניהול מטופלים
```
- Font: `Rubik`, 9px, weight 400
- Color: `#a8a0a8`
- Letter-spacing: 0.26em
- Uppercase
- Text-align: center

Wordmark animation: fade in + translate up 12px → 0px, duration 600ms, easing `ease-out`, delay 300ms

### Loading dots
Three dots in a row, centered, gap 7px between them.

Each dot:
- 5×5px circle, background `#c07088`
- Pulsing animation: opacity 0.2 → 0.65 → 0.2, scale 0.85 → 1.15 → 0.85
- Duration: 1.5s, easing `ease-in-out`, infinite loop
- Staggered delays: dot 1 = 0ms, dot 2 = 220ms, dot 3 = 440ms

Dots animation: fade in, duration 400ms, delay 700ms

### CSS animation keyframes
```css
@keyframes splashFadeUp {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}

@keyframes dotPulse {
  0%, 100% { opacity: 0.2; transform: scale(0.85); }
  50%       { opacity: 0.65; transform: scale(1.15); }
}
```

---

## Screen 2 — Login Screen

### Route & behavior
- Route: `/login`
- If user is already authenticated, redirect immediately to `/today`
- Only one auth method: **Google OAuth via Supabase**
- On successful Google login, check if user's email is in the `ALLOWED_EMAILS` env var (comma-separated list). If not allowed, sign them out and show an error message: "הגישה מוגבלת. אנא פני למנהל המערכת."
- On success, navigate to `/today`

### Layout
Full screen, `direction: rtl`, background `#f5f0e8`.

Three sections stacked vertically, centered, with `justify-content: center` and generous gap:

```
[ logo + greeting ]
[ Google button ]
[ footer note ]
```

### Logo + greeting block
Centered column, gap 20px:

**Logo:**
```html
<img src="/logo.png" width="100" height="100" alt="מרפאה שלי" />
```
Centered, no wrapper needed.

**Greeting text** (centered, `direction: rtl`):
```
שלום,
ברוכה הבאה
```
- Font: `Cormorant Garamond`, 30px, weight 300, color `#2e2a38`, line-height 1.3
- Below it: "התחברי כדי להמשיך"
  - Font: `Rubik`, 11px, weight 400, color `#a8a0a8`, letter-spacing 0.03em
- Margin between greeting and sub-line: 8px

### Google sign-in button
```
[ G logo ]  [ המשך עם Google ]
```

- Width: 100%
- Background: `#fdfaf6`
- Border: `0.5px solid #e8e0d4`
- Border-radius: 14px
- Padding: 16px 24px
- Display: flex, align-items center, justify-content center, gap 12px
- **Important: set `direction: ltr` on this button** — Google branding requires the G logo to always appear on the left side of the label, regardless of page RTL direction

Google G logo SVG (exact colors per Google brand guidelines):
```svg
<svg width="18" height="18" viewBox="0 0 18 18" fill="none">
  <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615Z" fill="#4285F4"/>
  <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z" fill="#34A853"/>
  <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z" fill="#FBBC05"/>
  <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z" fill="#EA4335"/>
</svg>
```

Label: `Rubik`, 14px, weight 500, color `#2e2a38`, text "המשך עם Google"

Button states:
- Default: as above
- Hover: background `#f5f0e8`, border-color `#d8d0c0`
- Active: scale 0.98, transition 100ms
- Loading: replace label with a small spinner, disable pointer events

### Error message (conditional)
If email not in allowlist, show below the button:
- `Rubik`, 11px, color `#a05870`
- Text: "הגישה מוגבלת. אנא פני למנהל המערכת."
- Animate in: fade + slide down 6px, 250ms ease-out

### Footer note
```
גישה מוגבלת לאנשי צוות מורשים בלבד
```
- Font: `Rubik`, 10px, weight 400, color `#c8c0c8`
- Text-align: center
- `direction: rtl`

---

## Fonts

Both screens require these fonts. Confirm they are already imported globally from the Today view update. If not, add to the global CSS:

```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=Rubik:wght@300;400;500&display=swap');
```

---

## What NOT to change
- Existing Supabase auth configuration
- `ALLOWED_EMAILS` env var logic
- Any other screen or component
