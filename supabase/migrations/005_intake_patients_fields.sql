-- Migration 005: Add intake fields to patients table
-- phone, email, chief_complaint already exist — only add new columns
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS gender          TEXT CHECK (gender IN ('female', 'male', 'other')),
  ADD COLUMN IF NOT EXISTS age             INTEGER CHECK (age >= 1 AND age <= 90),
  ADD COLUMN IF NOT EXISTS diagnosis       TEXT,
  ADD COLUMN IF NOT EXISTS treatment_plan  TEXT,
  ADD COLUMN IF NOT EXISTS created_from    TEXT DEFAULT 'manual'
                                           CHECK (created_from IN ('manual', 'intake')),
  ADD COLUMN IF NOT EXISTS gcal_event_id   TEXT;
