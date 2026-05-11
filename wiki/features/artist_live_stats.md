# Artist live stats

**Status:** shipped 2026-05-11.

## Why this exists

SoundCloud's track search API returns an embedded `user.followers_count` that's frequently wrong — sometimes 0, sometimes a stale or junk number. The scout used to trust this, write it into `data/<date>.json`, and never re-check. Result: artists who shouldn't qualify (signed, established, well over the follower threshold) slipped into Foraging and stayed there forever. Carlos Manaça was stored at 7 followers; reality was 21,793. A backfill audit found 19 of 20 stored counts in a single weekly report were wrong.

This feature ensures: (a) new scout reports contain real numbers, (b) any artist Doug opens shows live current stats, (c) historical bad data can be repaired in place.

## How it works — three taps

### Tap 1 — scout time
`scout.py:is_eligible()` always re-fetches `followers_count` from `/users/{id}` for any track that passes the play/recency gate. The old "suspicious-only" heuristic is gone. ~50 extra API calls per weekly run.

### Tap 2 — on-view refresh
`GET /api/artist/<username>` (in `content_api.py`):
- Checks Supabase `artists` table for a row by `username`
- If `updated_at` < 10 minutes ago → return cached, **zero SC calls**
- Else: hit SoundCloud `/resolve` + `/users/{id}/tracks?limit=5`, upsert row, return fresh
- `?force=1` bypasses cache

Frontend (`js/app.js:refreshArtistLive`) calls this whenever the artist detail panel opens. The panel then renders live values and shows a "● Live · synced Xm ago" pill.

### Tap 3 — daily background (unchanged)
`clan_tracker.py` continues to run 8am UTC via `daily_tracker.yml`. Provides the historical timeline for sparkline charts. On-demand fetching only knows "now" — it can't build a graph, so the daily sweep stays.

## Why not poll continuously

100 clan artists × 2 calls × 24 hours = 4,800 calls/day. On-demand with 10-minute TTL on actual user attention = roughly 40–100 calls/day. Same "feels live" outcome at 2% of the cost.

If we ever want alerts ("Carlos just hit 22k"), that's a future Tap 4 — periodic poll just for clan, plus a delta-detector. Not built.

## Files

| File | Role |
|------|------|
| `scout.py` | Tap 1 — always re-fetch real followers at scout time |
| `content_api.py` | Tap 2 — `/api/artist/<username>` route + helpers |
| `db/0008_artist_stats.sql` | Migration adding cache columns to `artists` |
| `js/app.js` | `refreshArtistLive()` + live-aware panel render |
| `scripts/refresh_clan_stats.py` | One-shot backfill for existing weekly JSONs |

## Tuning knobs

- `ARTIST_TTL_SECONDS` in `content_api.py` — default 600. Drop to 60 for hair more freshness, or raise to 3600 if SC traffic ever becomes a concern.
- `clan_tracker.py` cadence is set in `.github/workflows/daily_tracker.yml`.

## Known limitation

This feature only fixes **follower-count accuracy**. It does NOT detect "signed to a label" — the scout still has no way to know Carlos's bio mentions Magna Recordings. That's a separate plan: parse `description` field on the profile, look for label-affiliation signals + "Radio Show" / "Promo" track-title tells.

## Verification

```bash
# 1. Scout: confirm any artist over MAX_FOLLOWERS is excluded
python scout.py

# 2. Endpoint
curl http://localhost:8000/api/artist/djcarlosmanaca | jq
# → follower_count: ~21793, cached: false
curl http://localhost:8000/api/artist/djcarlosmanaca | jq
# → cached: true, no SoundCloud call (check logs)

# 3. Backfill
python scripts/refresh_clan_stats.py --dry 2026-03-25  # preview
python scripts/refresh_clan_stats.py 2026-03-25        # rewrite
```
