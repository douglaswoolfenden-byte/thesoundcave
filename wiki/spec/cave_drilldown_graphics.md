# Cave drill-downs — graphic-first modals (UI spec)

> Status: **SHIPPED 2026-06-10** (Playwright-verified: chart modal, donut, baseline placeholder, hover hint)
> Date: 2026-06-10
> Builds on: [clan_tracking_dashboard.md](clan_tracking_dashboard.md) Phase 2 (hover tooltip + click modal, shipped) and the visual-stats rule from [artist_modal_v3_visual_stats.md](artist_modal_v3_visual_stats.md).

## Why (Doug, 2026-06-10, mural screenshot)
*"Where it says Followers gained — I know the data is empty, but make sure you can click on that and a more detailed high-level graphic pops up. Same with Genre mix — hover, then click, then a more detailed one pops up."*

What exists: all five mural widgets are already click-wired to `.stat-modal` with hover states. What's wrong: the metric modals show a **numbers table** (violates the visual-first rule), the genre modal repeats the same small bars, and an empty baseline shows a dead "No tracking data yet."

## Changes
1. **Followers / Likes / Listens modal** — graphic first: full-width orange line chart of the **clan aggregate over every snapshot day** (`buildLineChart`, same grammar as the artist modal), with the ranked top-movers table *below* it as supporting detail.
2. **Genre mix modal** — an SVG **donut chart** (brand-orange shade ramp, count in the centre) + legend rows with per-genre bars and counts. More detail than the widget: shows *all* genres, not top 5.
3. **Empty / baseline state** — clicking always pops the modal; instead of dead text it shows the framed chart area with "Baseline set today — the chart draws as daily snapshots land", so the interaction is discoverable before data exists.
4. **Hover affordance** — keep existing hover lift + tooltip; add a small "↗ details" hint to the widget hover state so click-ability is obvious.

## Constraints
Same dark palette, `--red` accent ramp only, vanilla JS/SVG, reuse `.stat-modal` shell unchanged. No new deps.

## Build notes
- `js/cave.js`: `caveAggregateSeries(metric)` sums each metric over clan members per backend snapshot day (skips days where no clan member appears — no fake zero dips). `caveStatModalBody` now leads with `buildLineChart` for followers/likes/listens and falls back to a `.chart-empty` placeholder when < 2 days exist; movers table renders below only when spanDays > 0. Genre modal = new `buildGenreDonut` (stroke-dasharray segments, `GENRE_RAMP` orange shades, artist count centred) + swatched legend of *all* genres.
- `css/style.css`: `.stat-modal-chart`, `.stat-modal-genre-wrap` (donut left, legend right; stacks under 700px), `.genre-donut`, `.smg-swatch`.
- `css/dashboard.css`: `.cave-hero-panel.drillable::after` = "↗ details" hint, visible on hover; class added in `wireCaveStatInteractions` so only wired widgets get it (Playlist adds doesn't).
- Verified via Playwright with 4 seeded clan artists: followers modal (chart + 4 movers over 28 days), genre donut (4 × 25%), simulated single-snapshot baseline → placeholder copy, hover hint computed style confirmed, 0 console errors.
