# Play tracking accuracy + chart (spec)

> Status: **SHIPPED 2026-06-09** (live-fire verified). Phase 3 of the Cave overhaul (plan: `~/.claude/plans/okay-i-want-okay-bright-cook.md`).
> Date: 2026-06-09
> **Decision (2026-06-09):** chart plots the **true daily series, dips included** (raw API values) — Doug's call, overriding the increase-only/running-max idea. So: no clamp; backend stores truth; chart shows truth.

## Why
Doug: *"The plays tracking is really inaccurate. I only want to track the plays of the artist's **own tracks** — not mixes, not other people's tracks. Devise a system that tracks where plays have increased, daily; only track an increase when there's an improvement; I don't want rows and rows of history — a graphic, with the hard data stored in the back end."*

Today three fetchers cap at the **5 most recent tracks** and sum only those:
- `clan_tracker.py:114` `fetch_user_tracks(limit=5)` → daily snapshot `total_plays` (the source of truth).
- `content_api.py:1275` `sc_fetch_user_tracks(limit=5)` → live `/api/artist` panel `play_count`.
- (`soundcloud_helpers.py:85` `fetch_user_tracks(limit=3)` — used by the events/lineup matcher, **not** play totals; out of scope here.)

So an artist with 40 uploads has 35 of them ignored → wildly low/wrong play counts.

## The fix — accurate own-track plays via the API (no screenshots)
The SoundCloud `/users/{id}/tracks` endpoint returns **only the artist's own uploads** — reposts/mixes of others live on a separate endpoint (`/stream`/reposts) and are naturally excluded. We just need to fetch **all** of them, not the first 5.

- Add `fetch_all_user_tracks(user_id)` paginating via `linked_partitioning=true` + `next_href`, page size 200, hard cap ~500 tracks / 10 pages (safety). Returns the full own-track list.
- `total_plays = sum(playback_count over ALL own tracks)`. Same for likes/reposts. `latest_track` = max by `created_at`.
- Apply in **`clan_tracker.py`** (daily snapshot) and **`content_api.py`** (`/api/artist`) so the live panel matches the snapshot.

## Hard data + true series (no clamp)
- **Backend snapshot is the honest daily record** (`data/snapshots/YYYY-MM-DD.json`) — true `total_plays` each day. This is the hard data Doug wants stored.
- **The chart plots that true series as-is, dips included** (Doug's signed-off call). No running-max clamp. The "only track an increase" intent is satisfied by *accuracy* (own-tracks-only) — Doug prefers to see the real numbers, warts and all, rather than a smoothed line.

## Frontend — graphic, not rows
Replace the artist panel's `<table class="snap-table">` "Performance history" (`js/app.js renderPanel`) with a **plays-over-time chart**:
- Source the series from the backend daily snapshots already loaded in `allSnapshots` (`allSnapshots[*].artists[username].total_plays` by date) — the real timeseries, not the sparse localStorage `a.snapshots`.
- Render with the existing `buildLineChart(datasets, labels)` (`js/app.js:476`) — reuse, don't rebuild. Plot the raw series (no clamp).
- Show the latest hard numbers (plays / followers / likes) as a small readout above the chart; drop the long table.
- Empty states: 0–1 snapshot → "Tracking builds daily — chart appears after a couple of days." (no empty axes).

## Constraints
- Dark palette; chart matches the Footprints `buildLineChart` styling.
- Don't break the daily GitHub Action (`daily_tracker.yml`) — same outputs, just accurate.
- Pagination must be bounded (cap pages) so a prolific artist can't hang the run.

## Verification (live)
- Run `python clan_tracker.py` against the **live SoundCloud API** (creds present in `.env`; OAuth via client_credentials).
- Spot-check one artist: open their SoundCloud `/tracks` page, eyeball the sum of play counts, compare to the snapshot's `total_plays` (should be in the right ballpark vs the old 5-track undercount).
- Screenshot the panel chart replacing the table.

## Files
- `clan_tracker.py` — `fetch_all_user_tracks` + `build_snapshot` (sum all; latest by created_at).
- `content_api.py` — `sc_fetch_all_user_tracks` + `/api/artist` play/like sums.
- `js/app.js` — `renderPanel` history section → chart (reuse `buildLineChart`), raw series.
- `index.html` — swap the `snap-table` block for a chart container.
- `wiki/features/the_cave.md` / `footprints.md`, `wiki/log.md`.

## Build notes (SHIPPED 2026-06-09)
- **Backend:** `clan_tracker.py` `fetch_all_user_tracks()` + `content_api.py` `sc_fetch_all_user_tracks()` paginate `/users/{id}/tracks` via `linked_partitioning` (200/page, capped 500 tracks / 10 pages). `build_snapshot` and `/api/artist` now sum `playback_count` across the full own-track catalogue; `latest_track` = max by `created_at`.
- **Frontend:** `renderPlaysChart()` + `buildArtistPlaySeries()` in `js/app.js` build the series from `allSnapshots` (backend daily) and render via the existing `buildLineChart` (raw series, no clamp). Replaced the `snap-table` in `index.html` with `#playsChart`. The top stats row gains a backend-snapshot fallback (`bkSeries`) so it stays consistent with the chart when the live API hasn't synced. New `.chart-readout` / `.chart-empty` CSS.
- **Live verification (2026-06-09):** ran `clan_tracker.py` against live SoundCloud. Accuracy proven — e.g. **dazegxd: 297 tracks → 6,713,540 plays** (old 5-track cap captured almost none); **81zaki: 25 tracks → 26,281 plays** vs the old 2026-05-12 snapshot's 3,858. Pagination across 297 tracks worked. Chart + consistent stats screenshot-confirmed.
- Known pre-existing issue (not in scope): `fetch_user_by_username` fails to resolve display names with spaces/unicode (8/20 resolved) — a username→permalink resolution gap, unrelated to play accuracy.
