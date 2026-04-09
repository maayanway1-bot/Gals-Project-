-- Migration 006: Add intake fields to notes table
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS note_type       TEXT DEFAULT 'session'
                                           CHECK (note_type IN ('session', 'intake')),
  ADD COLUMN IF NOT EXISTS chief_complaint TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis       TEXT,
  ADD COLUMN IF NOT EXISTS treatment_done  TEXT,
  ADD COLUMN IF NOT EXISTS treatment_plan  TEXT,
  ADD COLUMN IF NOT EXISTS formulas        TEXT[],
  ADD COLUMN IF NOT EXISTS photo_urls      TEXT[];
