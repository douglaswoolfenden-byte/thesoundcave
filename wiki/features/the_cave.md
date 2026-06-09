# Feature: The Cave (umbrella) — the Mural dashboard

> Status: **Built.** Redesigned 2026-05-12 — diagonal stack hero.
> **Terminology (2026-06-09):** "The Cave" is the **umbrella section** — the top-nav group containing Mural · Foraging · Clan · Footprints. The dashboard scene described on this page is now labelled **MURAL** (the cave wall where the whole picture lives; was "Dashboard"). See [glossary](../glossary.md). Internal code still uses `tab-cave` / `js/cave.js` / `css/dashboard.css`.

## What it does
The **Mural** is the **dashboard / first-scene** of the Cave. It presents the user's Clan as a diagonal stack of cards flowing bottom-left → top-right. The front-most card is the currently focused artist. Scrolling, arrow keys, or trackpad cycle the focus; hovering lifts a card; clicking opens that artist's profile.

Around the stack, four floating glass panels surface at-a-glance stats:
- **Top-left:** Followers gained (week-over-week diff across Clan)
- **Top-right:** Likes gained (week-over-week diff)
- **Bottom-left:** Genre mix (top 5 genres in the Clan, % bars)
- **Bottom-right:** New track drops (latest tracks from Clan artists)

Below the hero, a chart strip plots weekly aggregate stats (followers / likes / listens / playlist adds) — only renders when there are 2+ weeks of historical data.

## Why it exists
The Cave is the entry point — first impression matters. Old version was a stat grid that felt like an admin console. New version is curatorial and visually distinctive, signalling that this is a *content/discovery* product, not just a dashboard.

Spec: `wiki/spec/cave_dashboard_redesign.md`.

## Acceptance criteria
- [x] Loads Clan from `getFavourites()` localStorage
- [x] Diagonal stack mechanic; front card focused; wheel/arrow keys cycle
- [x] Hover lifts non-focus cards; click opens artist profile
- [x] Four floating glass panels (followers / likes / genre / drops)
- [x] Chart strip hides gracefully when <2 weeks of data
- [x] Dark Sound Cave palette preserved (technique-only ref to Unveil)
- [ ] Mobile diagonal animation polish (defer)
- [ ] Secondary "Index" view for filtering (deferred from this round)

## Dependencies
- `getFavourites()` (Clan localStorage, in `js/app.js`)
- `data/YYYY-MM-DD.json` weekly reports + `data/manifest.json` (for stat aggregations and chart)
- `css/dashboard.css`, `js/cave.js`
- Tokens: `tokens.css` (colors, motion, spacing)

## Related
- `wiki/features/foraging.md` — manual + scheduled search to feed Clan
- `wiki/features/clan.md` — manage the artists shown in the stack
- `wiki/design_references/augen.md`, `kvs_studio.md` — same editorial-minimal family as Unveil ref
