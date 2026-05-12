# Feature: Footprints

> Status: **Built.** Analytics tab on tracked Clan artists. Report Builder lives here (moved from Clan 2026-05-12) — see `wiki/spec/footprints_reports.md`.

## What it does
Analytics and charts view over the daily snapshots produced by `clan_tracker.py`. Growth-over-time charts, sparklines, comparisons across Clan artists.

## Why it exists
Clan tells you *who* you're tracking. Footprints tells you *how they're doing* — which artists are accelerating, which are flat, which are worth promoting up to Star status. It also feeds editorial decisions in Firepit (e.g., generate content about the artist who just spiked).

## Acceptance criteria
- [x] Reads daily snapshot history
- [x] Per-artist growth charts (followers, plays)
- [x] Cross-artist comparison
- [ ] Empty state with white footsteps icon (recently shipped — verify)

## Dependencies
- `data/snapshots/*.json` (from `clan_tracker.py`)
- `js/footprints.js`, `js/app.js` SVG chart builders

## Related
- `wiki/features/clan.md` — source of tracked artists
- `wiki/features/firepit_forge.md` — Footprints insights inform what content to generate
