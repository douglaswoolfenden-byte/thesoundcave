# Forge Iteration Loop — refine, never reroll

> Status: **MVP scope signed off 2026-06-18** (Doug, via picker). DRAFT for the rest.
> Essence: [0008 — Campaign Studio first](../decisions/0008_campaign_studio_first.md) · principles: [forge_ux_principles](forge_ux_principles.md) (§1 iterative control, §5 workflow) · pipeline: [forge_context_pipeline](forge_context_pipeline.md).
> Build on `forge-output-ux`, local — **no live deploy** until quality + loop are there (Doug, 2026-06-18).

## Why
The refine loop is the difference between "moving forward and staying still" (Doug). Today's only control is REGEN — a full reroll that throws away what's right. The studio needs to **feed the last output back in with one instruction and keep everything else** — proven raw in `scratch/raw_nano_test1_v2.png` (fed an output back + one nudge → kept the whole image, fixed only the named thing).

Anchor (don't lose it): the loop is **table-stakes, not the moat** ([forge_ux_principles](forge_ux_principles.md)). Scope to "feels like iterating with a designer," not "beats Midjourney." The moat is niche-correct starting points (Etchings).

## MVP scope (Doug, 2026-06-18)
**Refine + version history.** In:
- Type a natural-language instruction → feed the **currently-selected** output back into `nano-banana-pro/edit` → new version. Never a reroll.
- A **version chain**: every refine is a new version off its parent; step back to any earlier version and branch from it.
- Download / Save-to-Stash any version (existing Stash flow).

**Out (deferred, not MVP):** A/B branching · selective region / inpaint edit · server-side version persistence · async queue ("fast async"). Keep it synchronous like `/api/generate-image` for now.

## UX (frontend — runs `ui-change-protocol` before code)
Below the Forge output card:
- the current image (click → existing zoom lightbox),
- a **Refine** text box + button ("describe one change"),
- a horizontal **version strip** of thumbnails (v1 → v2 → …); the selected one is the base for the next refine; click a thumb to select/branch,
- per-version: Download · Save to Stash.

Reference-as-template ([forge_context_pipeline §5](forge_context_pipeline.md)) rides for free here — the user can say "scatter SMELLY PANTS around the edges like the reference," "make LONDON'S VERY OWN smaller." No new UI for it.

## Backend — `POST /api/refine-image`
Mirrors `/api/generate-image` (auth via `_require_user`, `_debit(uid, 'image', …)`), but takes a **base image + one instruction** instead of building a scene from scratch.

Input: `{ base_image_url, instruction, content_type, size?, seed? }`
Flow:
1. auth + debit (same as generate-image).
2. fetch the base image → data URL (single ref).
3. build a **refine prompt** (see below).
4. `generate_for_job(JOB_EDIT, prompt, image_refs=[base], width, height, seed)` → `nano-banana-pro/edit`.
5. `save_image(...)` → return `{ image_url, model, instruction }`.

Refine prompt shape:
> "Image 1 is the current event flyer. Apply ONLY this change and keep everything else identical — same composition, subject, text, colour palette, grain and typography unless the change requires altering them: «instruction». Re-render as one integrated image, not a paste."

Version chain = **client-side** for MVP (frontend state / localStorage): each version `{ id, image_url, instruction, parent_id }`. No DB migration. Save-to-Stash persists a chosen version through the existing path.

## UI framing (signed off 2026-06-18, via `ui-change-protocol`)
- **References:** the existing Forge output card + the carousel slide-strip (internal precedent) — mirror, don't reinvent.
- **Feel:** identical to Forge today — dark, brutalist, one-accent, functional.
- **Hero moment:** type one change → a new version slides into the strip while everything else holds.
- **Anti-examples:** not a Photoshop panel, not a maze. Pre-generation path untouched; richness lives post-output.
- **Constraints:** reuse existing CSS vars + slide-strip pattern; palette law (#0a0a0a / off-white / single #ff4500); no new fonts; **single-image formats only** (not carousel); desktop-first.
- **Layout decision (Doug):** refine controls live **behind a `✎ REFINE` button** in the action row (column stays minimal; reveal on click) — not always-visible.

## Build phases
1. **Backend** — `/api/refine-image`. ✅ DONE (`87ddc55`) + SSRF-hardened (`a05d133`); smoke-tested at the model level.
2. **Frontend** — `✎ REFINE` toggles a version strip + "describe one change" box in `js/firepit.js` (+ `index.html`, `css/style.css`). ✅ DONE — layout screenshot-confirmed (`scratch/_verify/refine_panel_check.png`). Single-image formats only; XSS-escaped; client-side version chain.
3. **Wire + live-fire** — ⬜ REMAINING: browser end-to-end (restart server + login) → real generate → `✎ REFINE` → confirm the named thing changes, the rest holds. First real test = roughen the font / push the grain on the cowgirl flyer.

## Verification (the test that proves it)
Generate the cowgirl-DJ flyer → refine "roughen the lettering and push the photocopy grain, remove the duplicate date" → the type degrades + grain intensifies + duplicate date gone, **courtyard/pose/hierarchy unchanged**. That single pass closes today's two gaps and proves the loop.
