-- Sound Cave — Audio rights gate on audio_tracks (Firepit "Beat")
-- See wiki/features/firepit_beat.md. Idempotent.
--
-- Why: a scheduled/API post embeds its audio into the uploaded MP4, which TikTok
-- and Meta fingerprint and enforce retroactively. Durability comes from using
-- rights-cleared audio + keeping proof on file. This adds the provenance the
-- scheduling gate checks before a Beat-bearing post can go out.
--
-- Categories (encode the platforms' actual rules):
--   POSTABLE (need proof on file):
--     own_master          A — uploader owns the master outright
--     artist_permission   B — lineup artist's own master + written permission
--     royalty_free        C — royalty-free library w/ commercial social licence
--     cc0_public_domain   D — CC0 / public domain
--   BLOCKED (hard-blocked from scheduling — undefendable):
--     commercial_release  E — commercially-released / major-label recording
--     app_sound_or_rip    F — trending app sound / ripped from streaming
--     undocumented        G — third-party track, no documented permission
-- Postable vs blocked is enforced in the app (content_api.py) so the rule set can
-- evolve without a migration; the CHECK here only constrains the allowed values.

alter table public.audio_tracks
  add column if not exists rights_category text,
  add column if not exists rights_proof_url text,        -- licence receipt / permission doc / CC0 deed link
  add column if not exists license_notes text,           -- free-text: licence terms, artist contact, etc.
  add column if not exists source_artist_profile_id uuid references public.artist_profiles(id) on delete set null,
  add column if not exists rights_attested_at timestamptz,
  add column if not exists rights_attested_by uuid references public.users(id) on delete set null;

-- Constrain to the known category codes (nullable so existing rows stay valid).
do $$
begin
  alter table public.audio_tracks drop constraint if exists audio_tracks_rights_category_chk;
  alter table public.audio_tracks add constraint audio_tracks_rights_category_chk
    check (rights_category is null or rights_category in (
      'own_master', 'artist_permission', 'royalty_free', 'cc0_public_domain',
      'commercial_release', 'app_sound_or_rip', 'undocumented'
    ));
end $$;
