# Cave aggregate chart — interactive single-metric (UI spec)

> Status: **SHIPPED 2026-06-18** (Playwright-verified: metric switch, auto-scale, tooltip, 9px axis, coverage-tag removal, 0 console errors). Doug-approved via picker.
> Builds on: [cave_drilldown_graphics.md](cave_drilldown_graphics.md) — reuses the same `caveAggregateSeries` + `buildLineChart` grammar the stat-card modals already ship.

## Why (Doug, 2026-06-18, mural screenshot)
The bottom "Weekly stats · clan aggregate" strip looked broken: flat straight lines for Likes/Listens/Pl.Adds, oversized axis numbers, and no way to click through metrics. Three root causes:
1. **Wrong data source** — it read `allReports` (weekly *scout* reports, only ~2 exist → 2 points → straight lines). The clean per-day series lives in `allSnapshots` via `caveAggregateSeries()`.
2. **Four series on one shared axis** — Followers (~72K) crushes Likes/Listens/Pl.Adds flat. Pl.Adds is empty ("coming soon") yet still drawn.
3. **Font-scaling bug** — SVG built at 600px viewBox, stretched to the ~1140px strip via `width:100%`, magnifying 9px axis text to ~18px.

## What we're building
One metric at a time, switchable via a clickable legend — the same grammar as the shipped drill-down modals.

- **Legend chips are buttons.** Followers / Likes / Listens. Click one → chart swaps to that single series. Active chip highlighted. Default = Followers.
- **Single series auto-scales** to its own min/max → never flat, always fills the frame.
- **Clean data** — `caveAggregateSeries(metric)` over daily snapshots (followers / total_likes / total_plays), not weekly reports.
- **Pl. Adds** = disabled chip with a small "soon" tag (parity with the stat card's "coming soon").
- **Hover tooltip** — hover a point → "DATE · VALUE metric" floating above it. This is the "more interactive / easier to interpret" ask.
- **Font fix** — render the SVG at the canvas's real pixel width (`clientWidth`) so 1 unit ≈ 1px and axis text stays ~9px, matching the legend/title.

## Anti-examples
No Bloomberg-terminal multi-line density. No dual axes. No new chart library — vanilla SVG, reuse `buildLineChart`.

## Constraints
Dark Sound Cave palette only; accent ramp `--color-accent`/`--color-accent-hot`. Tokens only (no hardcoded hex in feature CSS beyond series colours, which mirror the existing legend). Vanilla JS/SVG, no deps. Caveman/editorial tone preserved.

## Files
- `js/app.js` — `buildLineChart` gains an optional `opts` arg (`{interactive, unit}`); when interactive it emits transparent `.lc-hit` hover circles carrying `data-d`/`data-v`. Backwards-compatible (existing 3 callers pass nothing).
- `js/cave.js` — `renderCaveChart` rewritten: clickable legend + `drawCaveChart()` (active-metric redraw) + `wireCaveChartHover()` (delegated tooltip). Sources from `caveAggregateSeries`, not `allReports`. **Also: remove the `· X/Y tracked` coverage tag** from the stat-card trend line (`renderStat`) per the same screenshot.
- `css/dashboard.css` — `.strip-chip` (button + active/soon states), `.strip-canvas`, `.chart-tip`, `.cave-chart-strip { position: relative }`.

## Build notes
- `js/app.js` `buildLineChart` — added optional 5th arg `opts={interactive, unit}`. When interactive, emits transparent `r=14` `.lc-hit` circles per point carrying `data-d` (label) + `data-v` (formatted value + unit). The 3 existing callers (artist modal, stat modals) pass nothing → unchanged.
- `js/cave.js` `renderCaveChart` — rewritten. `CAVE_CHART_METRICS` (followers/likes/listens) + `_caveActiveMetric` (default followers). Legend = `<button class="strip-chip">` per metric + a disabled `is-soon` span for Pl. Adds. `drawCaveChart()` redraws only `#caveChartCanvas` for the active metric (single series → `buildLineChart` auto-scales to its own min/max → never flat), sourcing `caveAggregateSeries()` (daily snapshots), **rendered at `canvas.clientWidth`** so the SVG isn't upscaled (that was the oversized-axis bug). `wireCaveChartHover()` = delegated mouseover on the persistent canvas → floating `#caveChartTip`, positioned off each hit circle's `getBoundingClientRect`, **clamped** to the strip width so the rightmost tooltip never overruns.
- `renderCaveStatPanels` — deleted the `· X/Y tracked` `.panel-coverage` span from `renderStat`. Card now reads "▲ +17 this week" only.
- `css/dashboard.css` — `.cave-chart-strip { position:relative }` (tooltip anchor); `.strip-chip` (button + `.is-active` highlight + `.is-soon` disabled "soon" tag, swatch tinted via `--chip`); `.strip-canvas`; `.chart-tip` + `.tip-v`/`.tip-d`.
- **Test note:** seeding the clan via localStorage requires `snapshots:[]` + `tracks_seen:[]` on each fav object, else `syncFavouriteSnapshots` throws at init and snapshots never load. (Real clan objects always carry these.)
- Verified (8 seeded artists, 3 snapshot days, Playwright): Followers default auto-scaled to ~20.6K band; click Likes → white line auto-scaled 621→148.8K; tooltip "148.8K likes · 06-10" clamped inside strip; axis text computed 9px; cards show "▲ over 1 day" with no tracked tag; 0 console errors. Screenshots in `scratch/cave_chart_*.png`.

### [2026-06-26] X-axis date-label thinning (branch `mural`)
- `buildLineChart` (`js/app.js`) now thins printed x-labels so the axis never crowds as days accumulate. Stride chosen from `[1, 2, 7, 14, 30, 60, 90, 180, 365]` days — the smallest `step` with `ceil(n/step) ≤ maxLabels`, where `maxLabels = clamp(floor(cw/70), 4..10)` (cw = inner chart width). Labels render only where `(n-1-i) % step === 0`, i.e. **anchored to the last point** so the most recent date always prints. Snapshots are daily, so the index stride maps straight to a calendar frequency: daily → every 2 days → weekly → fortnightly → monthly. The **line keeps every point** (full fidelity; hover tips unchanged) — only labels thin. Touches all 4 callers (cave strip, stat-modal, artist modal, footprints).
- Verified (18 snapshot days, Playwright): cave strip (wide) → 9 labels every 2 days (06-09…06-25); stat-modal (560px) → weekly (06-11/06-18/06-25). Stride picker spot-checked: 7d→1, 18d/wide→2, 18d/560→7, 60d→7, 120d→14, 400d→60.
