# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- **Dev server:** `npm run dev` (Next.js with hot reload)
- **Build:** `npm run build`
- **Start prod:** `npm start`
- **Lint:** `npm run lint`

## Architecture

Next.js 14 (App Router) PWA for acupuncture practice management. Single-user app with Supabase backend (Postgres + Auth + Storage) and Google Calendar integration.

### Route Groups
- `app/(auth)/login/` — Public login page (Google OAuth via Supabase)
- `app/(protected)/` — Authenticated shell with top bar + bottom nav (Today, Patients tabs)
- `app/auth/callback/` — OAuth code exchange route

### Key Files
- `middleware.js` — Session refresh, ALLOWED_EMAIL enforcement, auth redirects
- `lib/supabase/client.js` — Browser Supabase client (for Client Components)
- `lib/supabase/server.js` — Server Supabase client (for Server Components / Route Handlers)
- `lib/supabase/middleware.js` — Supabase session management in middleware

### Auth Flow
1. User clicks "Sign in with Google" → Supabase OAuth redirect
2. Google redirects back to `/auth/callback` → exchanges code for session
3. Middleware checks `user.email === ALLOWED_EMAIL` on every request; rejects others
4. Unauthenticated requests redirect to `/login`

## Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon/public key
- `ALLOWED_EMAIL` — The single authorized user's email (server-side only)

## Style

- Tailwind CSS v4 with `@tailwindcss/postcss`
- Dark theme (slate-950 background), mobile-first, iOS feel
- Custom colors defined in `app/globals.css` via `@theme` (`--color-primary`, `--color-primary-light`)
- RTL support: use `dir="auto"` on text inputs for Hebrew content
