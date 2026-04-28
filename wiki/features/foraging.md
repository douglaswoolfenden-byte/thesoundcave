# Feature: Foraging

> Status: **Partially built.** Live search endpoint exists; SoundCloud OAuth still untested.

## What it does
Three sub-tabs for finding artists outside the weekly scout cycle:
1. **Manual Search** — live SoundCloud API queries via `/api/search` on `content_api.py`
2. **Scheduled Search** — saved search definitions that run on a cron
3. **Running** — currently-running scheduled searches with progress

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
