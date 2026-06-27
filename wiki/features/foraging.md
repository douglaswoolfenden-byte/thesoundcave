# Feature: Foraging

> Status: **Built.** Live search + SoundCloud OAuth verified live 2026-06-09. Two-column rotation/watching layout + brand-orange action icons + typeable genre combobox shipped 2026-05-12. **Real weekly scheduled searches shipped 2026-06-09** (API store + `scheduled_scout.py` runner + GitHub Action + grouped Running tab).

## What it does
Three sub-tabs for finding artists outside the weekly scout cycle:
1. **Manual Search** — live SoundCloud API queries via `/api/search` on `content_api.py`. The **keyword** is sent to SoundCloud as a real full-text `q` search (not a local substring filter), **genre** matches the `genres` tag with a loose `q` fallback when the exact tag returns nothing, and an empty "Max followers" means **no ceiling** (fixed 2026-06-27 — see log; previously a hidden 5k cap + keyword-never-searched silently emptied results). Below the search form, **This Week's Rotation** and **Watching** sit as two columns side-by-side (so the artists user is actively monitoring stay visible at the top of the page). **Previously Discovered / Pending** sits full-width below. Results show the filter summary that produced them.
2. **Scheduled Search** — saved named searches (genre/keyword + follower range) persisted to `data/scheduled_searches.json` via `content_api` `/api/scheduled-searches` (localStorage fallback offline). **Real as of 2026-06-09** — see `wiki/spec/scheduled_searches.md`.
3. **Running** — the latest results of each scheduled search, **grouped per search** (name + filters + last-run), triaged with Clan/Watch/Cut. Searches run weekly via the `scheduled_searches.yml` GitHub Action (`scheduled_scout.py` writes `data/searches/<id>.json`).

## Genre filter (Manual + Scheduled)
Typeable combobox (`<input list="genreSuggestions">`), not a `<select>`. SoundCloud's `/tracks` genre param accepts any free-text string, so locking the user to a static dropdown was artificially restrictive. Seeded with ~75 cross-industry suggestions (electronic, hip-hop, R&B, global, rock, jazz…) plus any genres seen in past scout reports, case-deduped so "Tech House" / "tech house" collapse to one. Empty input = all genres.

## Action icons (Clan / Watch / Cut)
Inline SVGs styled with brand-orange (`--red #ff4500`) fills, labels in default body colour. Cave-line aesthetic matches the wordmark stroke weight:
- **Clan** — three solid dots (pack) over a single arc
- **Watch** — eye with centered iris (same SVG, brand-orange `#ff4500`, also used in the Watching empty-state hint as of 2026-06-09; replaced the old 👁 emoji)
- **Cut** — dagger blade with handle

**Clicking a card (2026-06-09):** opens the artist's detail panel **read-only** — it no longer auto-adds them to the Clan (was a bug). Adding is a deliberate click on the Clan action button or the panel's "+ Add to Clan".

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
