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

**Security note (corrected 2026-06-22):** `bypass.html` is gitignored (`.gitignore:15`) and never entered git history — not exposed via the repo or a git-based deploy. Residual: confirm a local `vercel` CLI deploy doesn't upload the ignored file. (An earlier "committed JWT" flag here was wrong.)

## Build log

**[2026-06-25] Elevation pass — "fit for purpose on a phone" (branch `mobile-ux`).** The app was already *functional* on mobile (the stage-1 shell + ~17 scattered component media queries reflow every screen single-column). This pass takes it from functional → **native-grade**, all additive inside `@media (max-width:720px)` / `560px`, built on `tokens.css` only, palette law intact. Desktop untouched (verified `mobileTabbar` computes `display:none` at 1280px). Files: `css/mobile.css` (full rewrite/expansion), `index.html` (tab-bar markup).

Shipped:
- **Bottom tab bar → icon + label.** Inlined the bespoke `sc-icon` line-art (cave / firepit / person) directly in the markup — the `data-icon` *hydration* path (`icons.js` `DOMParser('image/svg+xml')` + `appendChild`) produces an SVG-namespaced node that CSS sizing (`.sc-icon{width}`) doesn't apply to, so it rendered at 0×0; inline HTML SVG sizes correctly and needs no JS. Active tab = orange icon+label, drop-shadow glow, short top indicator bar. Backdrop-blur, safe-area bottom, 58px targets, tap-scale feedback.
- **Header bug fixed.** The desktop rule `.htab span:not(.count){display:none}` (≤700px) was blanking the sound toggle's label → an empty bordered box. Re-shown as a compact ghost control; brand mark shrunk to a clean 30px logo; header gets `env(safe-area-inset-top)`.
- **Sub-nav → segmented scroll pills** (pill shape, active = accent fill, right-edge fade mask).
- **Touch + type:** inputs/selects/buttons ≥46px, 16px input font (kills iOS focus-zoom), primary `.btn-red` full-width, legibility bump on body copy.
- **Hero (Forge):** the FORGE/ANIMATE CTA is `position:sticky` just above the tab bar — the core action is one thumb-tap away at any scroll depth.
- **Sheets:** artist panel + centred modals → full-screen / bottom-sheet with their own scroll + safe areas; Trail Map drawer full-width.
- **Rhythm:** trimmed the cinematic cave-stage min-height and cavernous section gaps on small glass.

Verified via a headless-Chromium harness at 390×844 (auth mocked, demo data seeded) across login, Mural, Foraging, Clan, Footprints, Forge, Stash, Trail Map, Reflection + the artist-panel sheet (`scratch/mobile_shots.js`, gitignored).

**Not done / follow-ups:** real-device pass (notch/home-bar on physical iOS/Android); live-data screenshots (the harness stubs the backend); consolidating the legacy scattered breakpoints (640/700/900/920) onto the 720/560 convention over time.
