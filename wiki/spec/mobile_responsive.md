# Mobile responsive — UI spec

> Status: **APPROVED — Doug signed off 2026-06-22** ("go"). Scope: **whole app**. Nav: **bottom tab bar**. References: retrofit inheriting existing look (confirmed). Hero: Forge → flyer on a phone (confirmed). Build on branch `mobile-responsive` (off trunk `forge-output-ux`).

**References:** ⬅️ *proposed* — no external redesign refs needed; this is a **retrofit**, not a reskin. It inherits the existing dark CRT/caveman aesthetic and follows standard native bottom-tab-bar conventions (iOS/Android). Doug to add any specific app whose mobile layout he wants to echo.

**Mood/feel:** The same app shrunk to a thumb — *not* a different skin. Dark CRT/caveman aesthetic intact, palette stays locked-dark (non-negotiable per the palette law). It should feel like S0UNDCAV3 on a phone, calm and legible, never cramped.

**Hero moment:** ⬅️ *proposed* — a promoter on their phone runs the **Forge and gets a flyer** they can post straight to Instagram. That single flow must feel great on mobile; everything else serves it.

**Anti-examples:** Not a pinch-zoom desktop page squeezed onto glass. Not generic Bootstrap/Material default chrome. Not a horizontal-scroll nav you have to hunt through.

**Constraints:** Vanilla CSS, no build step, no new dependencies. Portrait phones ~390px the primary target (down to ~360px). Build on `tokens.css` variables — no hardcoded hex/px. `S0UNDCAV3` wordmark. Nav pattern = **bottom tab bar** (thumb zone), sub-navs become a pill row under the header.

## Build notes

**Approach:** one new `css/mobile.css` layer + a single breakpoint convention (`max-width: 720px` primary, `560px` secondary for the tightest reflows), replacing the current 17 scattered ad-hoc media queries over time. Mobile rules are additive overrides — desktop layout untouched above the breakpoint.

**Per-screen punch-list (whole-app scope):**

| Screen | Breakage | Fix |
|---|---|---|
| App shell / nav | top nav + `cave-subnav` / `firepit-subnav` / `corner-nav` assume a wide bar | **bottom tab bar** (fixed, thumb-reachable); sub-navs → horizontal pill row under header |
| The Cave | `.two-col` (`1fr 1fr`), summary cards | stack single-column; `.artist-grid` already auto-fills ✓ |
| Foraging | `.filter-grid` (`2fr 1fr 1fr 1fr`) | stack filters vertically |
| Clan | `.clan-row-info` (**6 cols** `1fr auto×5`) — worst offender | reflow each row → stacked card |
| Footprints | `.fp-layout` (`220px 1fr`); fixed-width SVG charts | sidebar collapses above charts; charts `width:100%` / scroll |
| Firepit / Forge | `.forge-grid` (`1fr 1fr`) | stack input ↑ / output ↓ |
| Artist detail panel | fixed `760px` modal, `.detail-grid` (`1fr 1fr`) | full-screen sheet; `640px` query partial ✓ |
| Billing | already collapses at 720px ✓ | leave |

**Global:** touch targets ≥44px; base font bump for legibility; eliminate horizontal scroll; full-screen sheets for modals.

**Sequence (build screen-by-screen, screenshot-confirm each):** (1) bottom tab bar + shell, (2) Forge/Firepit [the hero], (3) Cave, (4) Clan, (5) Foraging, (6) Footprints, (7) artist panel + modals. Each ships and gets a mobile screenshot before moving on.

**Security note (separate, flagged 2026-06-22):** `bypass.html` commits a hardcoded Supabase JWT + refresh token (expired). Needs handling per `secret-handling` before this repo is public — tracked outside this spec.
