-- ============================================
-- Create notes table (one note per session)
-- ============================================
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  session_id uuid not null unique references public.sessions(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.notes enable row level security;

create policy "Users can read own notes"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "Users can insert own notes"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "Users can update own notes"
  on public.notes for update
  using (auth.uid() = user_id);

create policy "Users can delete own notes"
  on public.notes for delete
  using (auth.uid() = user_id);

create index idx_notes_session_id on public.notes(session_id);
create index idx_notes_user_id on public.notes(user_id);

-- ============================================
-- Migrate existing notes from sessions to notes table
-- ============================================
insert into public.notes (user_id, session_id, content, created_at, updated_at)
select s.user_id, s.id, s.notes, s.created_at, s.created_at
from public.sessions s
where s.notes is not null and s.notes != '';

-- ============================================
-- Update sessions table
-- ============================================
-- Add duration column (in minutes)
alter table public.sessions add column duration int;

-- Make session_number nullable (only set for past sessions)
alter table public.sessions alter column session_number drop not null;

-- Drop notes and tongue_photo_url columns from sessions
alter table public.sessions drop column if exists notes;
alter table public.sessions drop column if exists tongue_photo_url;
