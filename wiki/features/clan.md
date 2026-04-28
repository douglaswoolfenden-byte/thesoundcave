# Feature: Clan

> Status: **Built (Phase 5 redesign).** Profile panel polish still outstanding.

## What it does
Saved artist roster. Grid of cards with avatars; click into an artist profile with stats, follower/play sparklines, growth metrics, star/cut actions, and platform logos with hover-to-paste links.

`clan_tracker.py` runs daily and snapshots each tracked artist's stats into `data/snapshots/YYYY-MM-DD.json` so the sparklines have data.

## Why it exists
Clan is the user's curated working set. Discovery (The Cave, Foraging) is a firehose; Clan is the shortlist they actually create content about and follow over time.

## Acceptance criteria
- [x] Grid view with avatars and key stats
- [x] Profile panel with sparklines and growth metrics
- [ ] Star action (mark priority artists)
- [ ] Cut action (remove from Clan)
- [ ] Platform logos with hover-to-paste links
- [ ] Suggested tracks panel
- [x] Daily snapshot job (`clan_tracker.py`) running via GitHub Actions

## Dependencies
- `data/snapshots/YYYY-MM-DD.json` (from `clan_tracker.py`)
- `data/clan_artists.json` (optional manually-curated list)
- `js/clan.js`, `js/app.js`

## What's left
- Star / cut actions
- Platform hover-paste
- Suggested tracks

## Related
- `wiki/features/footprints.md` — Clan data feeds the analytics charts
- `wiki/features/firepit_forge.md` — Clan artists are the typical context for content gen
