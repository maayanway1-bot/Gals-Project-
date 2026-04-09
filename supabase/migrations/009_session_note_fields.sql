-- Migration 009: Add session-note-specific fields to notes table
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS client_report     TEXT,
  ADD COLUMN IF NOT EXISTS tongue_and_pulse  TEXT,
  ADD COLUMN IF NOT EXISTS homework          TEXT;
