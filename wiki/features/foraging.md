# Feature: Foraging

> Status: **Partially built.** Live search endpoint exists; SoundCloud OAuth still untested. Two-column rotation/watching layout shipped 2026-05-12. Brand-orange custom action icons + typeable genre combobox shipped 2026-05-12.

## What it does
Three sub-tabs for finding artists outside the weekly scout cycle:
1. **Manual Search** — live SoundCloud API queries via `/api/search` on `content_api.py`. Below the search form, **This Week's Rotation** and **Watching** sit as two columns side-by-side (so the artists user is actively monitoring stay visible at the top of the page). **Previously Discovered / Pending** sits full-width below.
2. **Scheduled Search** — saved search definitions that run on a cron
3. **Running** — currently-running scheduled searches with progress

## Genre filter (Manual + Scheduled)
Typeable combobox (`<input list="genreSuggestions">`), not a `<select>`. SoundCloud's `/tracks` genre param accepts any free-text string, so locking the user to a static dropdown was artificially restrictive. Seeded with ~75 cross-industry suggestions (electronic, hip-hop, R&B, global, rock, jazz…) plus any genres seen in past scout reports, case-deduped so "Tech House" / "tech house" collapse to one. Empty input = all genres.

## Action icons (Clan / Watch / Cut)
Inline SVGs styled with brand-orange (`--red #ff4500`) fills, labels in default body colour. Cave-line aesthetic matches the wordmark stroke weight:
- **Clan** — three solid dots (pack) over a single arc
- **Watch** — eye with centered iris
- **Cut** — dagger blade with handle

## Why it exists
The weekly scout is broad and automated. Foraging is targeted: a user has a specific genre, region, or vibe in mind and wants results *now* or on their own cadence, not Monday 8am UTC.

## Acceptance criteria
- [x] Manual Search UI with live SoundCloud results
- [ ] SoundCloud OAuth tested end-to-end on `/api/search`
- [ ] Scheduled Search: create/edit/delete saved searches
- [ ] Running: live status of scheduled searches
- [ ] Results promotable to Clan with one click

## Dependencies
- `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET` (or `SOUNDCLOUD_OAUTH_TOKEN`) in workspace `.env`
- `content_api.py` running on port 8000
- `js/foraging.js`

## What's left
- Test SoundCloud OAuth on `/api/search`
- Build Scheduled Search backend (cron + storage)
- Build Running view

## Related
- `wiki/features/the_cave.md` — destination for promoted Foraging results
