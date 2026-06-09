-- Sound Cave — Roster account persistence
-- Spec: wiki/spec/roster_account_persistence.md (approved 2026-06-08)
-- Moves the Roster (Clan) off browser localStorage and onto the user's
-- account. `roster` = saved artists (mirrors the sc_favs object); the
-- `roster_prefs` row holds the Foraging watching/dismissed arrays.
-- Each row RLS-scoped to its owner. Idempotent.

create table if not exists public.roster (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  artist_username text not null,
  display_name text,
  genre text,
  avatar_url text,
  artist_url text,
  status text not null default 'active',   -- active | cut
  notes text,
  platforms jsonb not null default '{}'::jsonb,
  playlist_adds int,
  preferred_tracks jsonb not null default '[]'::jsonb,
  snapshots jsonb not null default '[]'::jsonb,
  tracks_seen jsonb not null default '[]'::jsonb,
  added_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, artist_username)        -- one row per artist per user; enables upsert
);

create index if not exists roster_user_idx
  on public.roster(user_id, status);

alter table public.roster enable row level security;

drop policy if exists roster_owner_all on public.roster;
create policy roster_owner_all on public.roster
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Foraging curation state (watch / cut arrays), one row per user.
create table if not exists public.roster_prefs (
  user_id uuid primary key references public.users(id) on delete cascade,
  watching jsonb not null default '[]'::jsonb,
  dismissed jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.roster_prefs enable row level security;

drop policy if exists roster_prefs_owner_all on public.roster_prefs;
create policy roster_prefs_owner_all on public.roster_prefs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at triggers (idempotent — uses helper if it exists)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at_now') then
    drop trigger if exists roster_updated_at on public.roster;
    create trigger roster_updated_at
      before update on public.roster
      for each row execute function public.set_updated_at_now();

    drop trigger if exists roster_prefs_updated_at on public.roster_prefs;
    create trigger roster_prefs_updated_at
      before update on public.roster_prefs
      for each row execute function public.set_updated_at_now();
  end if;
end $$;
