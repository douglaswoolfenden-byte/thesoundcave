# Stash thumbnail crop — UI spec

**References:** the existing Stash grid (`.stash-grid`) — this is a refinement, not a new surface. Instagram-style square content grid as the mental model.
**Mood/feel:** clean, even, scannable. The Stash is a *reference shelf* — each tile just says "this is which piece", not a hero render. Locked dark palette, caveman vernacular unchanged.
**Hero moment:** the grid reading as one even wall of equal squares — your eye scans titles, not a jagged ragged-height column.
**Anti-examples:** the pre-fix grid where each card's height = its source image's native ratio (a portrait flyer became a tall tower next to a short landscape still). Looked broken/unfinished.
**Constraints:** desktop + mobile (the grid is `repeat(auto-fill, minmax(220px, 1fr))` — multi-col on desktop, 1-col on phone; unchanged by this work). Dark only. No new dependencies, no JS — pure CSS.

## The problem

Every Forge output format produces a different aspect ratio — Still (1:1), Carousel (4:5), Flyer (9:16), Animation (16:9 video), Poster (2:3). The Stash cover (`.stash-block-cover`) was *meant* to normalise these to `aspect-ratio: 16/10` + `object-fit: cover`, but the cover was a **flexbox** with the `<img>` as a flex child at `height: 100%`. The flex item's `min-height: auto` overrode the container's `aspect-ratio`, so each cover stretched to its image's native height — the grid went ragged (see the live screenshot Doug flagged 2026-06-26).

## Decisions (Doug, 2026-06-26)

1. **Shape: square 1:1, top-anchored crop.** Square > 16:10 landscape because the artwork is mostly *portrait* flyers — a wide landscape crop slices a thin mid-strip and loses the headline. Square keeps the title zone. (`object-position: top center`.)
2. **Click: unchanged — opens the piece in the Forge** (`editStashItem`). "Directed to full artwork" is already satisfied by the Forge output panel showing the full, uncropped render. No lightbox built.

## The fix (`css/style.css`, `.stash-block-cover`)

- `aspect-ratio: 16/10` → `1/1`; `overflow: hidden`; dropped the flex layout.
- Media (`img`/`video`) is now **`position: absolute; inset: 0`** instead of a flex child — it physically cannot stretch the box past 1:1, killing the root cause for good. `object-fit: cover; object-position: top center`.
- `.stash-block-noimg` placeholder re-centres itself (`position:absolute; inset:0; flex-center`) since the parent is no longer a flex container.
- All overlay badges (count, slide ×N, countdown, play ▶) are already `position:absolute` and sit after the media in DOM order, so they still paint on top.

One CSS rule, shared by both tile builders (`_postTileHTML` single items + `_campaignTileHTML` campaign tiles) — fixes the whole grid in one place.

## Verified

Standalone repro (`scratchpad/stash_thumb_repro.html`) linking the real `style.css`, rendering cards with deliberately mismatched source ratios (1:1 / 4:5 / 9:16 / 16:9 / 2:3) + a no-image tile. Playwright @ 1280px: all covers render as identical squares, the top title band survives every crop, placeholder centres. Console clean (favicon 404 only).

## Build notes

- Did NOT touch the grid column rule — responsiveness is unchanged.
- Did NOT change `editStashItem` wiring — click target behaviour preserved.
