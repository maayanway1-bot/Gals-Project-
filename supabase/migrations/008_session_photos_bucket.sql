-- Migration 008: Create session-photos storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('session-photos', 'session-photos', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload session photos"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'session-photos');

CREATE POLICY "Authenticated users can read session photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'session-photos');
