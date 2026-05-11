-- 0008 — extend artists table to cache live SoundCloud stats with TTL.
-- Used by /api/artist/<username> in content_api.py.

alter table public.artists
  add column if not exists play_count    integer,
  add column if not exists like_count    integer,
  add column if not exists track_count   integer,
  add column if not exists avatar_url    text,
  add column if not exists display_name  text,
  add column if not exists username      text,
  add column if not exists updated_at    timestamptz not null default now();

create index if not exists artists_username_idx on public.artists(username);
create index if not exists artists_updated_at_idx on public.artists(updated_at);
