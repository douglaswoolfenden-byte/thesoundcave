-- Sound Cave — Clan Data Tracking v2
-- Spec: wiki/spec/clan_data_tracking_v2.md (approved 2026-06-11)
-- Identity registry + daily time-series for Clan/Watching artists, replacing
-- the static data/snapshots/ JSON pipeline. Service-role access only (RLS on,
-- no policies) — users read via /api/tracking/* endpoints. Idempotent.

-- Registry: one row per tracked artist (global union of every user's
-- Clan + Watching). artist_key is the display-name key the frontend uses;
-- soundcloud_user_id is the stable identity all daily fetches use.
create table if not exists public.tracked_artists (
  id uuid primary key default gen_random_uuid(),
  artist_key text not null,
  permalink text,
  permalink_url text,
  soundcloud_user_id bigint,
  display_name text,
  genre text,
  avatar_url text,
  resolve_status text not null default 'pending',  -- pending | ok | failed
  resolve_error text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (artist_key)
);

create unique index if not exists tracked_artists_sc_id_uq
  on public.tracked_artists(soundcloud_user_id)
  where soundcloud_user_id is not null;

-- Run log: one row per collector run (observability + catch-up no-op check).
create table if not exists public.snapshot_runs (
  id uuid primary key default gen_random_uuid(),
  run_date date not null,
  trigger text not null default 'scheduled',  -- scheduled | manual | catchup | backfill
  status text not null default 'running',     -- running | completed | failed
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  artists_total int,
  artists_ok int,
  artists_partial int,
  artists_failed int,
  errors jsonb not null default '[]'::jsonb
);

create index if not exists snapshot_runs_date_idx
  on public.snapshot_runs(run_date, status);

-- Time-series: one row per artist per day per platform per source.
-- INVARIANT: fetch_status='failed' rows carry NULL metrics — "no data" is
-- structurally distinct from "zero plays". 'partial' = pagination truncated
-- (metrics present but undercounted; see pages_fetched / raw).
-- playlist_adds is screenshot-lane only (not exposed by the SoundCloud API).
create table if not exists public.artist_snapshots (
  id bigint generated always as identity primary key,
  artist_id uuid not null references public.tracked_artists(id) on delete cascade,
  snapshot_date date not null,
  platform text not null default 'soundcloud',  -- soundcloud | spotify | instagram | ...
  source text not null default 'api',           -- api | screenshot
  fetch_status text not null default 'ok',      -- ok | partial | failed
  followers int,
  following int,
  track_count int,
  total_plays bigint,
  total_likes bigint,
  total_reposts bigint,
  total_comments bigint,
  playlist_adds int,
  tracks_fetched int,
  pages_fetched int,
  latest_track jsonb,
  top_tracks jsonb,
  raw jsonb not null default '{}'::jsonb,
  run_id uuid references public.snapshot_runs(id),
  created_at timestamptz not null default now(),
  unique (artist_id, snapshot_date, platform, source)
);

create index if not exists artist_snapshots_date_idx
  on public.artist_snapshots(snapshot_date);
create index if not exists artist_snapshots_artist_idx
  on public.artist_snapshots(artist_id, snapshot_date);

alter table public.tracked_artists  enable row level security;
alter table public.snapshot_runs    enable row level security;
alter table public.artist_snapshots enable row level security;
-- No policies on purpose: service-role only; the API applies user scoping.

-- updated_at trigger (idempotent — uses helper if it exists)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at_now') then
    drop trigger if exists tracked_artists_updated_at on public.tracked_artists;
    create trigger tracked_artists_updated_at
      before update on public.tracked_artists
      for each row execute function public.set_updated_at_now();
  end if;
end $$;
