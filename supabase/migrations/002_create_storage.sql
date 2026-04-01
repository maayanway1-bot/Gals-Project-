-- ============================================
-- Tongue photos storage bucket (private)
-- ============================================
insert into storage.buckets (id, name, public)
values ('tongue-photos', 'tongue-photos', false);

-- Users can upload to their own folder
create policy "Users can upload own photos"
  on storage.objects for insert
  with check (
    bucket_id = 'tongue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can view their own photos
create policy "Users can view own photos"
  on storage.objects for select
  using (
    bucket_id = 'tongue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own photos
create policy "Users can update own photos"
  on storage.objects for update
  using (
    bucket_id = 'tongue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own photos
create policy "Users can delete own photos"
  on storage.objects for delete
  using (
    bucket_id = 'tongue-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
