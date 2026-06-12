# Footprints clean toggle chart — UI spec

**Status:** Signed off (Doug, 2026-06-11, both questions)
**Parent:** [clan_data_tracking_v2.md](clan_data_tracking_v2.md) Phase 2

**References:** in-app — artist modal v3 (orange sparkline tiles, click-to-switch big chart) + Cave drill-down modals (brand-orange clan line chart, framed empty state). Footprints chart = their sibling.
**Mood/feel:** cave-dark; one brand-orange line on near-black; mono numerals; calm and confident — one number, one line, nothing shouting.
**Hero moment:** clicking a metric tab (FOLLOWERS / PLAYS / LIKES / REPOSTS) and the chart swaps instantly.
**Anti-examples:** Google-Analytics-style dashboards — % badges on every card, ▲▼ WoW arrows, stat walls. (Old Footprints had exactly this.)
**Constraints:** desktop-first, dark S0UNDCAV3 palette locked, existing CSS variables in `css/style.css`, vanilla JS, no libraries.

## Scope (agreed)

- REMOVE: WoW %-change card grid; "Avg Growth %" / "Top Mover +x%" summary cards; "Score" metric (always 0 on daily data).
- ADD: Reposts as 4th toggle metric; latest-value readout next to the chart (one number, mono).
- KEEP: artist sidebar; Report Builder + CSV export; Key Insights — reworded **percentage-free** (🚀 "Growing fastest" / ⚠️ "Declining — worth reviewing", names only).
- Summary row becomes non-% facts: Total Tracked · Days of Data · Last Updated.
- Data source switches to `/api/tracking/snapshots` (accurate Supabase series) when signed in — this is where stale numbers (Blam! 305) get replaced by calibrated ones (807).

## Build notes (iteration 2 — Doug's live review, 2026-06-12)

Doug's direction after using it: **design for the A&R user** (label scout deciding who to sign). Changes:
- **Default = WHOLE CLAN** aggregate chart (artist dropdown first option; flat-fill so joins/gaps don't fake growth); drill into artists from there.
- Quieter type: summary values 18px/600, chart headline value 16px; DAYS OF DATA card dropped (visible from the chart); summary is now TRACKED · CLAN FOLLOWERS · CLAN PLAYS (each with absolute "↑ N in window") · LAST UPDATED.
- Key Insights → **MOVERS leaderboard**: orange bars scaled to followers gained, absolute "+N FOLLOWERS · +N PLAYS", rows clickable → selects that artist's chart.
- Artist view adds A&R context lines: linked name ↗ (opens SoundCloud), "N LIKES PER 1K PLAYS" engagement, "LATEST DROP: title · date".
- Export gains "Followers Gained"/"Plays Gained"/SoundCloud-URL columns.
- **Data honesty in the view layer:** chart/gains use daily-source, non-partial points only (scout-time single-track counts and the 2026-05-12 undercount poisoned baselines — 81zaki read +22.5K plays); API series strip-and-rebuild cached daily points so server-side corrections propagate.
- SKH legacy rows confirmed wrong-user (old name-resolve hit a different "SKH"; roster account mackenziehiggins0000 verified 141 followers on its public page) — marked failed with Doug's approval 2026-06-12.
- Known timing nuance, accepted: snapshots capture once daily (~07:00 UTC); live SoundCloud counts can drift ±1 during the day (James Ray 64 vs 63). The artist modal "Live" badge covers real-time.

## Build notes (iteration 3 — Doug's second live review, 2026-06-12)
- Movers panel gets its own FOLLOWERS/PLAYS toggle; rows rank, scale and label by the active metric only.
- Chart axis text was rendering ~2× (600px SVG stretched to ~1100px card) — now drawn at native 1100×300 so the 9px mono labels match the rest of the type scale.
- Artist header: engagement + LATEST DROP lines removed (Doug's call); genre stays; name is a quiet hyperlink (`.fp-artist-link`, white→orange + underline on hover, no arrow).
- EXPORT REPORT is now a **report builder** popover: scope = WHOLE CLAN / any genre / any artist. Clan & genre scopes export the roster summary CSV; artist scope exports that artist's day-by-day series.
