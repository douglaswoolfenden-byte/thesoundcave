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

## Build notes
<added during build>
