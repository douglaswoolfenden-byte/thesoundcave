# Feature: The Cave

> Status: **Built.** Filter bar + export added in Phase 3 redesign.

## What it does
Dashboard overview of all discovered artists across weekly scout reports. Filter by genre, date, name, follower count. Export selected artists to PDF (`window.print()`) or email (`mailto:`).

## Why it exists
The Cave is the entry point — users land here to see what scout has found across all weeks, then drill into individual artists or add them to Clan.

## Acceptance criteria
- [x] Loads all weekly reports via `data/manifest.json`
- [x] Filters: genre, date range, artist name, follower threshold
- [x] PDF export via print stylesheet _(stylesheet still TODO per memory)_
- [x] Email export via `mailto:`
- [ ] Print stylesheet polish

## Dependencies
- `data/YYYY-MM-DD.json` weekly reports (produced by `scout.py`)
- `data/manifest.json` (produced by `update_manifest.py`)
- `js/cave.js`, `js/app.js`

## Related
- `wiki/features/foraging.md` — manual + scheduled search to feed The Cave
- `wiki/features/clan.md` — promote Cave artists into Clan
