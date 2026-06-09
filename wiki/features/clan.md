# Feature: Clan

> Status: **Built (Phase 5 redesign).** Profile panel polish still outstanding.
> **Terminology (2026-06-09):** UI label is **CLAN**. It was briefly renamed "Roster" (2026-05) and reverted to Clan. The account persistence layer (table/API) keeps the name `roster`. See [glossary](../glossary.md).

## What it does
Saved artist roster. Grid of cards with avatars; click into an artist profile with stats, follower/play sparklines, growth metrics, star/cut actions, and a platform links section using inline brand SVG marks (mono in `--red` when linked, muted grey when not). Each row shows the linked URL or a `+ ADD LINK` CTA; click expands an inline editor. Platforms: Spotify, YouTube, Instagram, TikTok, Beatport, Bandcamp, Discogs. Source SoundCloud link sits at the top of the panel separately. Redesigned 2026-05-12 (was emoji glyphs in hover-to-paste pairs).

`clan_tracker.py` runs daily and snapshots each tracked artist's stats into `data/snapshots/YYYY-MM-DD.json` so the sparklines have data.

**Storage (2026-06-09): account-backed.** The roster persists to the user's Supabase account (`roster` + `roster_prefs` tables, RLS-scoped), not just the browser. `localStorage` (`sc_favs` / `sc_watching` / `sc_dismissed`) is now a write-through cache: loaded from the account on sign-in, written through on every change, reconciled on each load. It follows the login across browsers/devices and survives a localStorage wipe. See [`../spec/roster_account_persistence.md`](../spec/roster_account_persistence.md). Code: `roster_api.py`, `js/roster_sync.js`. (Previously localStorage-only — which is how a curated roster got lost.)

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
