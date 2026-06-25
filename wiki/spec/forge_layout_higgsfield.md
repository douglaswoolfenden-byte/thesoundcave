# Forge layout — Higgsfield-style left→right reflow — UI spec

> Status: **APPROVED 2026-06-25 — Option B (tighten left + hero canvas).** Etchings stays the front door; @elements/Spirits `@`-mentions are out of this pass; right run-history/refine rail is a fast-follow. Build on branch `forge-higgsfield-layout`.
> Scope: the **layout/flow** of the Forge studio only. Keeps the [Etchings entry](style_gallery.md) + [UX principles](forge_ux_principles.md). Does NOT build @elements (separate follow-up).

## References
**Higgsfield "Create Video" UI (Kling 3.0)** — screenshot Doug provided 2026-06-25 (not committed to the repo; described here). It's a **3-zone left→right layout**:
1. **Left control rail** (~320px): selected source/model card (with "Change") → optional **Start frame / End frame** slots → prompt textarea ("Add elements using `@`") with `Enhance` + `@ Elements` pills → Model selector row → **one compact row of iconised pills** (`4s` · `9:16` · `720p` = duration · aspect · resolution) → big yellow **Generate ✨6** CTA with the credit cost baked into the button.
2. **Centre canvas** (hero): the big output preview, with floating actions (favourite / copy / download / more) and a play control.
3. **Right history rail**: each run as a card — its prompt (with an inline `@created-person` element chip + avatar), params (`720p · 14.0s · 9:16`), and a **Rerun** button.

The reading order is the point: **set up (left) → see result (centre) → iterate (right).**

## Mood/feel
**Unchanged from Sound Cave's locked identity** — dark, underground, scene-correct, caveman-vernacular. Higgsfield is a **layout/flow reference ONLY**. Do NOT adopt its palette, its blank-prompt entry, or its generic "media tool" feel. (Palette is non-negotiable dark — see `feedback_soundcave_palette`.)

## Hero moment
The **centre output canvas** — pick an Etching, hit FORGE, and the flyer/animation appears **big and central**, not crammed beside a tall form. The left rail gets you there fast; the right rail is where you iterate after the first result.

## Anti-examples
- **Higgsfield's own blank-prompt-first entry** — we keep **Etchings as the anchor** (decision 0008 moat). Steal the *flow*, not the empty canvas.
- Becoming a **generic media-gen tool** with no niche taste.
- Any **light/neutral palette**. Never.
- A **pre-generation maze** — the fast "first asset in 2 moves" path stays minimal; richness lives *after* the first output (UX principle, post-output).

## Constraints
- **Dark palette locked**; theme strictly off `tokens.css` (no hardcoded hex/px in feature CSS).
- **Caveman-vernacular labels** (`feedback_soundcave_caveman_language`). Higgsfield's words must be translated — e.g. "Elements"→Spirits/Totems/Relics, "Generate"→FORGE/CONJURE, "History"→Stash/Trail. **Naming is Doug's creative call** (`feedback_creative_direction_is_dougs`) — Claude proposes, Doug decides.
- **Vanilla HTML/CSS/JS**, no framework. Reuse existing components (`.forge-picker`, `.card`, `.btn-red`, `.forge-image-preview`).
- **Desktop + the existing mobile bottom-tab shell** — left/centre/right must collapse sanely on narrow screens.

## Higgsfield → Sound Cave mapping
| Higgsfield element | Adopt? | Sound Cave equivalent |
|---|---|---|
| 3-zone left→right (controls / canvas / history) | ✅ core of this pass | left control rail · centre canvas · right Stash/iterate rail |
| Source/model card at top of left rail | ✅ (reframed) | the **selected Etching** card (the anchor) — "Change" reopens the Etchings gallery |
| Start frame / End frame slots | ➖ N/A for stills/flyers | only relevant to Animation (artwork upload already exists) |
| Compact iconised pill row (duration·aspect·res) | ✅ | Format + Size as one iconised row (extend existing `.forge-picker`); duration pill shows only for Animation |
| Prompt box "Add elements using @" | ✅ box, ⏸️ @ | keep the **Direction** box prominent; the `@`-mention of Spirits = **follow-up**, not this pass |
| `Enhance` toggle / `@ Elements` pill | ⏸️ later | maps to the prep-interpreter (`forge_prep_interpreter.md`) + Spirits library — future |
| Big CTA with credit cost in the button | ✅ | **FORGE** button showing the live credit cost (e.g. "FORGE · 2") — admins see ∞ |
| Right rail = run history with Rerun | ✅ (scoped) | per-run cards → Refine/Regen (`forge_iteration_loop.md`) + drop to Stash |

## Open decisions for sign-off
1. **Third (history/iterate) rail now, or later?**
   - **(A) Full 3-column now** — left controls · centre canvas · right run-history/refine rail. Closest to Higgsfield; biggest change.
   - **(B) 2-column now, tighten first** — restyle the left into the compact Higgsfield-style control rail + make the centre canvas the hero; fold "history" into the existing **Stash** tab for now; add the right rail as a fast-follow.
   - *Recommendation: **B*** — lands the left→right *feel* fast for you to review, lower risk, doesn't duplicate Stash before we've decided how history/Stash relate.
2. **Etchings entry** — keep as the front door (recommended, protects 0008) ✓ assumed unless you say otherwise.
3. **@elements / Spirits `@`-mentions** — confirmed **out of this pass** (separate build) ✓ assumed.

## Build notes
**Built 2026-06-25 (branch `forge-higgsfield-layout`) — pass 1, CSS-led, low-risk:**
- **Asymmetric grid** — `.forge-grid` went `1fr 1fr` → `minmax(300px, 340px) 1fr`. Measured live: **340px control rail | 788px hero canvas** at 1440w. This is the left→right read.
- **Compact, sticky control rail** — left `.card` tagged `.forge-controls`: `position: sticky` (stays put while you study the canvas), tighter stack-label/input-group spacing (off `--space-*` tokens) so the numbered stack reads as a panel not a long form.
- **Hero canvas** — right `.card` tagged `.forge-canvas`: `min-height: 440px`, empty-state stage `min-height: 360px`, image area centred.
- **CTA** — `GENERATE CONTENT` → **FORGE** (+ `ANIMATE` for the Animation format), both tagged `.forge-go`. Uses the standard `.btn-red` style (transparent + red border, fills on hover) — consistent with the app; *not* made solid (aesthetic call left to Doug).
- **Responsive** — reused the existing `@media (max-width:900px)` collapse to single column; added `.forge-controls{position:static}` there so the rail doesn't stick when stacked. Verified at 430w: single column, rail above canvas, non-sticky.
- **No JS touched** — all IDs/handlers intact; div balance 284/284; only console error is a pre-existing `favicon.ico` 404.
- **Verified on localhost** (admin login, Playwright): `scratch/forge_higgsfield_reflow.png`.

**Pass 2 (2026-06-25, same branch) — iconised pickers + reference drop-block (Doug's follow-up):**
- **Format & Size → iconised pill pickers** (Higgsfield's iconised aspect ratio). Reused the existing `.forge-picker` component; each pill has an inline SVG that follows the pill's state via `currentColor` (muted idle → accent active). The native `<select id="forgeContentType"|"forgeSize">`s are **kept but `hidden`** as the source-of-truth — pills drive them through `forgePick()` (sets value + dispatches `change`) and `syncForgePills()` (mirrors active pill; called inside `updateForgeFields()` so init + `editStashItem`'s programmatic set both stay in step). Verified: Format pills swap the stacks correctly (Animation→sub-form+size hidden, Flyer→event fields, Still→standard), Size pills drive `forgeSize`.
- **Reference upload → `+` drop-block** (`.forge-dropzone`): replaced the native "Choose files" input with a dashed block (orange `+` and "ADD REFERENCE", accent border on hover) that clicks the now-`hidden` `#forgeRefImages` input. `handleRefImagesChange` + the thumb previews are unchanged. SoundCave dark grading off tokens.
- No regressions: `node --check` clean, div balance 286/286, single IDs preserved, only the pre-existing favicon 404 + local-only CORS warnings (graceful static fallback) in console. Shots: `scratch/forge_pickers_top.png`, `forge_pickers_dropzone.png`.

**Pass 3 (2026-06-25, same branch) — input tidy-up (Doug's batch):**
- **Format + Size → compact dropdowns on one row** (reverted the pass-2 pills, per Doug). Native `<select>`s, visible again.
- **Size shows for ALL formats incl. Animation** (`updateForgeFields` no longer hides `#forgeSizeWrap`). ⚠️ Honest caveat: the i2v backend (`animate_video`) takes no aspect — animation output still follows the *source artwork's* ratio; the picker is there for consistency. Wiring aspect→Kling is a flagged follow-up.
- **Removed Brand kit + Voice Profile** from the input. Both JS-safe (`populateBrandSelect`/`_selectedBrandKit`/init listeners already null-guard; `gatherForgeContext` defaults `voice` to `underground`). Voice will be *inferred from Direction* once the interpreter lands.
- **Event details restructured:** Night/event name → Venue|City → **Date (`type=date` calendar) | Ticket price** → **Doors open | Close (`type=time`, one row)**. `gatherForgeContext` formats ISO date → `FRI 12 DEC` and 24h → `10PM` (`formatFlyerDate`/`formatClock`) so the baked flyer text stays human.
- **Animation length → snap-slider** (`range min5 max10 step5`, live `5s`/`10s` label) per Doug's "slider, snaps to supported lengths" call.
- **Condensed** the References / Direction / Artwork / Motion helper + placeholder text.
- Native date/time pickers themed dark (`color-scheme: dark`). No JS readers broken; `node --check` clean, div 281/281, no new console errors. Shots: `scratch/forge_pass3_flyer.png`, `forge_pass3_animation.png`.

**Fast-follows (still not done):** **history rail** (Higgsfield-style right panel, client-side v1 — Doug's next pass); **direction interpreter** (Claude rewrites direction for clarity + infers the voice — specced, not built); live credit cost on the FORGE button (needs `CREDIT_COST` via `/api/config`; ∞ for admins); wire aspect→Kling for animation; optional drag-and-drop on the drop-block; make the animation Artwork upload a drop-block too (consistency).

**Open for Doug's review:** (1) is the rail width right (340px)? (2) want the FORGE CTA *louder* (solid fill, Higgsfield-style) or keep the consistent outline? (3) `FORGE` rename OK, or keep `GENERATE CONTENT`?
