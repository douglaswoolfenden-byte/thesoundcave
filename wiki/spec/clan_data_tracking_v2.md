# Clan Data Tracking v2 — robust artist performance tracking

**Status:** Approved (Doug, 2026-06-11, via plan sign-off)
**Replaces:** the static-JSON pipeline (`clan_tracker.py` → `data/snapshots/` → git → Vercel bundle)
**Closes:** decision [0007](../decisions/0007_backend_live_on_railway.md) follow-up #2 (snapshots-via-API)

## Why

Doug couldn't trust the numbers — to the point of screenshotting SoundCloud pages by hand. Investigation showed the inaccuracy was mostly *our* pipeline, not SoundCloud's API:

- Artist resolution used **display names** → names with spaces/unicode silently failed (12 of 20 scouted artists never tracked) or resolved to the **wrong user** (`Lucki` in old snapshots is actually a user called "val").
- Failed fetches were stored as **zeros** — indistinguishable from real data.
- Track-list pagination failures silently **undercounted** play totals; no retries anywhere.
- The tracker read stale weekly scout reports, never the actual Clan roster.

## What (decided by Doug 2026-06-11)

- **Scope:** Clan + Watching artists (union across users; effectively Doug today, multi-user-safe).
- **Cadence:** daily.
- **Data points (API lane, per artist per day):** followers, following, total plays / likes / reposts / comments across the whole catalogue, track_count, latest_track, top_tracks (top 10 by plays with per-track plays/likes/reposts → per-track trends come free).
- **`playlist_adds` is screenshot-lane only** — the SoundCloud API does not expose it. Other platforms (Spotify etc.) also enter via screenshots, distinguished by `platform`.
- **Screenshot lane (Phase 3):** upload → Claude vision extracts → preview → Confirm/Discard → **image deleted immediately**; 24h sweeper purges orphans. No image hoarding; only extracted numbers + text provenance survive. Numbers are never hand-editable (artist modal v3 no-manual-entry rule stands).
- **Graphics:** one clean line chart + metric toggle (the modal-v3 tile pattern), extended to Footprints. No number/percentage walls.

## How

- **Identity:** `tracked_artists` registry keyed on the frontend's `artist_key`; resolves `artist_url` → permalink → **numeric `soundcloud_user_id`** once; daily fetches hit `/users/{id}` directly — renames/unicode never matter again.
- **Storage:** `artist_snapshots` time-series in Supabase, unique on `(artist_id, snapshot_date, platform, source)`. **Invariant: a failed fetch stores NULL metrics + `fetch_status='failed'` — never zeros.** `partial` = truncated pagination, kept but flagged (`pages_fetched`, `raw`).
- **Collector:** `tracking_collector.py`, run by the existing Railway APScheduler (cron 07:00 UTC + hourly catch-up that no-ops once today's run completed; resume-safe per-artist upserts). Run log in `snapshot_runs`.
- **API:** `tracking_api.py` blueprint — `GET /api/tracking/snapshots` returns the *exact* static-file shape (filtered to the caller's roster∪watching, failed rows omitted) so all four chart consumers cut over via one change in `init()`; plus `/artist/<key>/series`, `POST /run`, `GET /runs`, `POST /artists` (register at add-to-clan time).
- **Migration:** old snapshot JSONs imported with honesty flags (wrong-user rows → `failed`; 2026-05-12 undercounts → `partial`). GH Actions pipeline retired only after a ≥3-day parity window (Phase 4).

## Verification

Calibration spot-check after Phase 1: tiny-catalog artist's plays hand-summed from the public page (exact match required), big catalog within ~1%, followers exact, previously-failing names now resolving; negative test proves failures yield gaps, not zero-dips. Results recorded here.

## Phases

1. Registry + collector + Supabase storage + history migration + calibration ✅ when run log shows `completed` with previously-broken names `ok`
2. Frontend cutover (4 consumers, one switch) + clean toggle chart in Footprints
3. Screenshot-ingest lane
4. Retire GH Actions / static files; decision page 0008
