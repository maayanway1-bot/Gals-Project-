-- Phase 9: Morning (Green Invoice) Integration
-- Creates practitioners table and adds invoice-related columns

-- ── Practitioners table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS practitioners (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  clinic_name text,
  morning_api_key_id text,       -- API key ID (plain text; protected by RLS)
  morning_api_key_secret text,   -- API secret (plain text; protected by RLS — consider Vault encryption for production)
  created_at timestamptz DEFAULT now()
);

ALTER TABLE practitioners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read own practitioner row" ON practitioners;
CREATE POLICY "Users can read own practitioner row"
  ON practitioners FOR SELECT
  USING (id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own practitioner row" ON practitioners;
CREATE POLICY "Users can insert own practitioner row"
  ON practitioners FOR INSERT
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "Users can update own practitioner row" ON practitioners;
CREATE POLICY "Users can update own practitioner row"
  ON practitioners FOR UPDATE
  USING (id = auth.uid());

-- ── Patients: add morning_client_id ─────────────────────────
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS morning_client_id text;

-- ── Sessions: add price, paid, invoice_sent, invoice_id ─────
ALTER TABLE sessions
  ADD COLUMN IF NOT EXISTS price integer,
  ADD COLUMN IF NOT EXISTS paid boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_sent boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS invoice_id text;
