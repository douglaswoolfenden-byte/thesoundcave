# Cave Dashboard Redesign — UI spec

> Status: **DRAFT** — awaiting Doug sign-off before code.
> Date: 2026-05-12

The Cave dashboard is the first scene most users land on. It must feel *slick* — a visually pleasing centerpiece, not a stats table.

## References

- **Primary technique:** Unveil Projects — diagonal stacked image cards flowing bottom-left → top-right, scroll-cycled, with overlapping translucent layers. (3 screenshots in chat 2026-05-12; save to `wiki/design_references/unveil_assets/` during build.)
- Related saved refs: `wiki/design_references/augen.md`, `wiki/design_references/kvs_studio.md` (same editorial-minimal family — technique only).

## Mood / feel

Underground, after-hours, gallery-of-rare-records. Editorial breathing room. Curatorial, not data-terminal. **Palette stays Sound Cave dark/underground** — the Unveil reference is technique-only, never a colour source. (See standing rule: `feedback_soundcave_palette` memory.)

## Hero moment

A diagonal stack of Clan artists flowing bottom-left → top-right across the canvas. The **front-most card is the currently focused artist** — biggest, sharpest, brightest. Scroll cycles which artist sits at the front (back-of-stack rotates forward, front rotates off). Hover raises a card slightly out of the stack with a soft lift; click opens that artist's full profile panel.

## Anti-examples

- **No Spotify-style tiled card grids** — kills the editorial feel.
- **No Bloomberg-terminal density** — stats are decorative satellites, not the main event. Whitespace > stat-stuffing.

## Constraints

- Desktop-first (this is the marquee scene; mobile gets a simpler stacked layout later).
- Dark Sound Cave palette only (see standing rule).
- Vanilla HTML/CSS/JS, no framework.
- Reuses Clan data already loaded by `js/clan.js` (no new backend).
- Charts only render when historical snapshot data is available — otherwise hide gracefully (no empty axes).

## Layout — "Hero-width stack, floating panels"

```
┌────────────────────────────────────────────────────────────────────┐
│                                                                    │
│  ┌─────────────┐                              ┌──────────────┐     │
│  │ FOLLOWERS   │      ╱ ╱ ╱ ╱ ╱ ╱             │ LIKES GAINED │     │
│  │ GAINED      │     ╱ ╱ ╱ ╱ ╱                │ (this week)  │     │
│  │ +1,284      │    ╱ ╱ ╱ [front card]        │ +9,402       │     │
│  └─────────────┘   ╱ ╱ ╱  ARTIST NAME         └──────────────┘     │
│                   ╱ ╱ ╱                                            │
│  ┌─────────────┐ ╱ ╱                          ┌──────────────┐     │
│  │ GENRE MIX   │╱                             │ NEW DROPS    │     │
│  │ techno 42%  │                              │ • Track A    │     │
│  │ ambient 18% │                              │ • Track B    │     │
│  │ ...         │                              │ • Track C    │     │
│  └─────────────┘                              └──────────────┘     │
│                                                                    │
│  ─────────────────────────────────────────────────────────────     │
│            FOLLOWERS-OVER-TIME CHART (full width)                  │
│            (only renders when snapshot history exists)             │
└────────────────────────────────────────────────────────────────────┘
```

- The diagonal stack is the visual hero, hero-width.
- Side panels are **floating glass cards** layered over the canvas edges — they don't fight the stack for centrality; they orbit it.
- Charts sit below, full-width, only when data exists.

## Interaction

- **Default state:** stack auto-introduces with a slow drift (first 1.5s on load), then settles.
- **Scroll (mouse wheel / trackpad over the dashboard):** cycles which clan artist is front-most. Back card slides forward into focus, previous front rotates off to the back of the stack. Smooth, springy, never abrupt.
- **Hover a card:** lifts ~12px out of the stack with a soft shadow + slight tilt correction. Cursor becomes pointer.
- **Click a card:** opens that artist's existing profile panel (reuse current `artist-detail-panel` logic from `js/cave.js` / `js/app.js`).
- **No filter bar on this view.** Filtering moves to a secondary "Index" view (out of scope this round, but plan for it).

## Build notes

(populated during implementation)

- Tokens: extend `tokens.css` if new dark-glass surface tokens are needed (`--surface-glass`, `--surface-glass-hover`).
- Stack mechanic: pure CSS 3D transforms (`translate3d` + `rotate3d`) on a stack of `<article class="stack-card">`. JS only manages which index is "front" and applies a data attribute; CSS handles all easing.
- Card images: use each artist's SoundCloud avatar (already in clan data). High-res preferred; fallback gradient if missing.
- Performance budget: stack capped at ~12 visible cards (rest are off-screen / unrendered). 60fps on a 5-year-old laptop.

## Out of scope (this round)

- Mobile diagonal stack (defer; mobile gets vertical card list).
- Filter / Index secondary view.
- Multi-image carousel per artist (just avatar for now).

## Update 2026-06-10 — rails layout (overlap fix)

Doug: the floating corner panels overlapped the artist thumbnails; wanted it tidier, bigger, no overlap, scrolling OK. Also: the hover *dropdown* (top-movers tooltip) annoyed him — keep the orange ring + lift on hover, but show detail only on **click**.

- **Overlay → 3-column grid.** `.cave-hero` is now `grid-template-columns: rail | stage | rail`. The six panels sit in a **left rail** (Followers, Listens, Genre Mix) and **right rail** (Likes, Playlist, New Drops); the cinematic stack lives in the centre `.cave-stage`. Overlap is now impossible by construction. The CRT/vignette/warm-bg texture moved from `.cave-hero` to `.cave-stage`; `.cave-stage { overflow:hidden }` clips the fanned back-cards in the gutter so nothing ever reaches a panel.
- **Bigger:** stage `min-height: 800px`, cards 320→340px, diagonal tightened (92/68 → 70/56) so the fan stays in the centre lane. Page scrolls.
- **Hover dropdown removed:** deleted `showCaveTooltip`/`hideCaveTooltip`, the `#caveStatTooltip` element and its CSS. Hover is now pure-CSS ring+lift; click opens the modal. Wheel-cycle rebound from the whole hero to `.cave-stage` only (scrolling over a rail scrolls the page).
- Right-rail stat panels right-align (facing inward); New Drops list stays left-aligned. Responsive: 2-narrower-rails < 1200px, single column (stage on top) < 920px.
- Verified via Playwright (6 seeded artists): grid `250 / 585 / 250`, stage clips, 0 cards drawn over rails, click opens modal, wheel still cycles, 0 console errors.
