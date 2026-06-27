-- Sound Cave — per-user SoundCloud OAuth connections
-- Spec: wiki/spec/soundcloud_user_oauth.md (approved 2026-06-26)
-- Apply in Supabase SQL editor after 0021_invite_codes.sql

create table if not exists public.user_soundcloud_connections (
  id            uuid        primary key default gen_random_uuid(),
  user_id       uuid        not null references public.users(id) on delete cascade,
  sc_user_id    text        not null,
  sc_username   text        not null,
  access_token  text        not null,
  refresh_token text,
  scope         text,
  connected_at  timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id)
);

-- Only the service role (backend) should read/write tokens.
-- RLS on so anon key can never read raw tokens from the client.
alter table public.user_soundcloud_connections enable row level security;

-- No client-side policies: backend always uses service key which bypasses RLS.
-- This table intentionally has zero permissive policies for anon/authenticated roles.
