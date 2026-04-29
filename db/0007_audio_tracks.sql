-- Sound Cave — Audio tracks + clipping-ready columns on stash_items
-- Stream 2 Phase 2. Idempotent.
--
-- Why audio_tracks is its own table (not just a column on stash_items):
-- one upload feeds many video generations. A label drops a single, generates 30
-- pieces of content from it; we don't want to re-upload 30 times. Phase H
-- ("OpusClips for music") needs this shape.

-- Storage bucket: audio_tracks (private — no public read; service role uploads,
-- owner reads via signed URL when needed). Created via REST in code or by hand;
-- this file just owns the RLS policies on storage.objects.

create table if not exists public.audio_tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  filename text not null,
  bucket_path text not null,           -- '<user_id>/<filename>' inside audio_tracks bucket
  mime_type text not null default 'audio/mpeg',
  duration_seconds numeric,            -- nullable: backfilled after probe
  bytes integer,
  created_at timestamptz not null default now()
);
create index if not exists audio_tracks_user_created_idx
  on public.audio_tracks(user_id, created_at desc);

alter table public.audio_tracks enable row level security;

drop policy if exists "audio_tracks owner all" on public.audio_tracks;
create policy "audio_tracks owner all" on public.audio_tracks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Clipping-ready columns on stash_items.
-- Carries the link from a generated video back to the source audio + which slice.
-- All nullable so existing rows stay valid.
alter table public.stash_items
  add column if not exists audio_track_id uuid references public.audio_tracks(id) on delete set null,
  add column if not exists start_seconds numeric,
  add column if not exists end_seconds numeric,
  add column if not exists duration_seconds numeric,
  add column if not exists media_type text;  -- 'image' | 'video_composite' | 'video_standard' | 'video_premium'

-- Storage bucket policies for audio_tracks (private bucket).
-- Owner-only read/write/update/delete; no public read.
do $$
declare b text := 'audio_tracks';
begin
  execute format($p$drop policy if exists "%1$s owner read" on storage.objects$p$, b);
  execute format($p$create policy "%1$s owner read" on storage.objects for select to authenticated using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b);

  execute format($p$drop policy if exists "%1$s owner write" on storage.objects$p$, b);
  execute format($p$create policy "%1$s owner write" on storage.objects for insert to authenticated with check (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b);

  execute format($p$drop policy if exists "%1$s owner update" on storage.objects$p$, b);
  execute format($p$create policy "%1$s owner update" on storage.objects for update to authenticated using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b);

  execute format($p$drop policy if exists "%1$s owner delete" on storage.objects$p$, b);
  execute format($p$create policy "%1$s owner delete" on storage.objects for delete to authenticated using (bucket_id = %1$L and (storage.foldername(name))[1] = auth.uid()::text)$p$, b);
end $$;
