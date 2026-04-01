-- Store Google OAuth tokens for Calendar API access
-- Supabase only returns provider_token on initial sign-in,
-- so we persist it for later API calls.
create table public.google_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at bigint not null,
  updated_at timestamptz not null default now()
);

alter table public.google_tokens enable row level security;

create policy "Users can read own tokens"
  on public.google_tokens for select
  using (auth.uid() = user_id);

create policy "Users can upsert own tokens"
  on public.google_tokens for insert
  with check (auth.uid() = user_id);

create policy "Users can update own tokens"
  on public.google_tokens for update
  using (auth.uid() = user_id);
