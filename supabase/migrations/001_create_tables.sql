-- ============================================
-- Patients table
-- ============================================
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  email text not null,
  date_of_birth date,
  chief_complaint text,
  tongue_photo_url text,
  created_at timestamptz not null default now()
);

alter table public.patients enable row level security;

create policy "Users can read own patients"
  on public.patients for select
  using (auth.uid() = user_id);

create policy "Users can insert own patients"
  on public.patients for insert
  with check (auth.uid() = user_id);

create policy "Users can update own patients"
  on public.patients for update
  using (auth.uid() = user_id);

create policy "Users can delete own patients"
  on public.patients for delete
  using (auth.uid() = user_id);

-- ============================================
-- Sessions table
-- ============================================
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  session_number int not null,
  date timestamptz not null default now(),
  notes text,
  tongue_photo_url text,
  google_event_id text,
  created_at timestamptz not null default now()
);

alter table public.sessions enable row level security;

create policy "Users can read own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id);

create policy "Users can delete own sessions"
  on public.sessions for delete
  using (auth.uid() = user_id);

-- ============================================
-- Indexes
-- ============================================
create index idx_patients_user_id on public.patients(user_id);
create index idx_sessions_patient_id on public.sessions(patient_id);
create index idx_sessions_user_id on public.sessions(user_id);
