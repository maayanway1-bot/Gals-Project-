-- Migration 007: Create formula_presets table with TCM seed data
CREATE TABLE IF NOT EXISTS public.formula_presets (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  is_deleted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.formula_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own presets"
  ON public.formula_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own presets"
  ON public.formula_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
  ON public.formula_presets FOR UPDATE
  USING (auth.uid() = user_id);

-- Seed data will be inserted per-user on first load (from the app)
-- since RLS requires a user context for the default auth.uid()
