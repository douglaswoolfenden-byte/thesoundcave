# Decision 0009 — Baked-in text is the default; overlay is a constrained, evidence-gated escape hatch

> **Date:** 2026-06-22
> **Status:** Accepted (documents an as-built reality + sets the forward rule). Supersedes nothing; records the fork [forge_ux_principles](../spec/forge_ux_principles.md) declared "closed" and adds the conditions under which the one exception fires.
> **Context:** the Build B carry-over treated baked-vs-overlay as an *open* decision. It is not. The code already settled it. This page records that, and pins down the single escape hatch so it can never grow into a Canva-style text editor.

## The decision

1. **Baked-in text is the default and the shipped reality for Flyers.** The image model renders all event text *into* the scene as one process. No editable text layer for `event_poster`.
2. **Overlay is not dead — it is deliberately scoped *away* from Flyers** (it drives Posts/Carousels and the campaign auto-generator). It exists, it works, and it is therefore available as an *escape hatch* without new infrastructure.
3. **The escape hatch is conditional, constrained, and evidence-gated.** It is *not* designed into Build B. It fires only if a real test proves the current model can't bake a given case — and even then only inside hard limits (below) that keep us out of Canva's lane.

## Why baked-in wins (ranked, strongest first)

1. **Gallery economics.** 20+ Etchings each carry their own font/distress/palette. Baked-in scales at O(1) — the font is a *property of the scene*, read off the reference, matched for free. Overlay is O(N) manual: source + licence + font-match + hand-code a distress filter per style. That contradicts the no-design-team premise.
2. **Prior evidence.** Overlay was already tried for Flyers and pulled back — [forge_ux_principles:44](../spec/forge_ux_principles.md) ("fork closed"), enforced in code: flyers never mount the compositor ([js/firepit.js:730](../../js/firepit.js#L730)).
3. **Overlay was the wrong fix for the real bug.** The actual misses (orange↔red palette inversion, clean-vs-distressed font, flat hierarchy) came from contradictory/underspecified *instructions*, not from text being baked. The prep/verify step fixes the cause; a layer swap wouldn't have touched it.
4. **Integration.** Baked text inherits the scene's grain, perspective and lighting. Overlay sits flat like a sticker on a textured AI background — the failure mode Doug named (2026-06-22): you cannot guarantee font size, placement, colour or consistency when dropping a layer onto arbitrary generated grain.
5. **Font licensing.** Exact condensed grotesques are often paid/licensed per style. Baked-in needs none.
6. **Less manual.** Stated preference for hands-off.

## The governing constraint — we do not build Canva (Doug, 2026-06-22)

The escape hatch must never become "embed any text into any artwork, hand-matched." That *is* Canva, and we don't compete there. Concretely, **if implementing the escape hatch ever requires any of the following, we stop and fall back to regen-on-failure instead:**

- downloading/licensing more than the locked font set (1 mono + 1 grotesk — today the two bundled DM fonts in `brand/fonts/`);
- a manual text-placement / drag-resize editor for Flyers;
- per-generation hand-matching of font/colour/size to the scene.

Overlay text only ever looks integrated when **we control both ends**: the Etching's *own* locked font/palette, dropped into a **flat zone the model was instructed to reserve** (no grain to mismatch). That is O(1) per *style*, defined once when the tile is authored — not O(N) per generation.

## The escape-hatch triggers (only two, both narrow)

- **Aesthetic trigger** — a single locked style needing pixel-perfect, zero-variance, editable text, *or* an Etching whose distressed text won't render even after prep + seed-lock.
- **Content trigger** — a text block crosses a **density/exactness threshold** (e.g. a 12-act lineup with set times, legal small print) that the model garbles. Route *that block only* to overlay; everything else stays baked → **hybrid per-block, never per-style.**

**Both are gated on evidence, not assumed.** See below.

## Why the content trigger is *gated*, not built-in

The "diffusion can't spell a dense lineup" premise is an **empirical claim about FLUX-schnell-era models.** The Flyer path now runs on **`nano-banana-pro/edit`** ([media_gen.py:765](../../media_gen.py#L765)), whose headline strength is accurate multi-line text rendering. So the failure the content trigger guards against *may no longer exist.*

**Therefore: P0 baseline must include a deliberate dense-text stress test** — a real 12-act lineup + set-times grid through the current model.
- **If it bakes clean** → the content trigger is unnecessary. No escape hatch, no overlay machinery, fork stays shut.
- **If it garbles** → only then do we implement the escape hatch, under the Canva-line constraints above (locked font into a model-reserved flat zone). If those constraints can't hold for the case, we accept **regen-on-garble** (OCR-back-check rejects → reroll) rather than build the tool.

## The verification spine (what replaces overlay's job — on the instruction, not the output)

Overlay was meant to guarantee correct text. We get the same guarantee earlier and cheaper via a prep/verify step (parked, spec to be written — see [log 2026-06-22](../log.md)):

- **Extract** font character, distress, palette (orange ≠ red made explicit) and hierarchy from the STYLE reference — a *vision* pass that does not exist today (current prompt-building is text-only).
- **Resolve** contradictory/underspecified instructions into one directive + a locked seed.
- **Verify**: palette check + **OCR-back-check** (re-OCR the output, fuzzy-diff against the intended string, enforced only where exactness matters) — automated; hierarchy + aesthetic stay a **human approve gate** (aesthetic judgment is Doug's).

## As-built evidence (so this page is checkable)

| Claim | Evidence |
|---|---|
| Text baked into the image | `_baked_text_lines` ([media_gen.py:308](../../media_gen.py#L308)) → `build_restyle_prompt` ([:341](../../media_gen.py#L341)) / `build_compose_prompt` ([:408](../../media_gen.py#L408)) |
| Flyers excluded from overlay | [js/firepit.js:730-734](../../js/firepit.js#L730-L734) — `!_posterType` guard, comment "flyers NEVER mount the text-overlay compositor" |
| Overlay exists for other formats | server Pillow [image_composer.py](../../image_composer.py) via campaigns ([campaigns_api.py:394](../../campaigns_api.py#L394)); client Konva [js/compositor.js](../../js/compositor.js) for Posts/Carousels |
| Flyer model = Nano Banana Pro edit | `job_type_for` style-ref path → `JOB_RESTYLE` ([media_gen.py:922](../../media_gen.py#L922)) → `fal-ai/nano-banana-pro/edit` ([:765](../../media_gen.py#L765)) |
| Seed plumbed but not stored | `ctx.get('seed')` → payload ([media_gen.py:827](../../media_gen.py#L827)); no per-style/per-campaign seed store |
| No post-gen verification today | image → JPEG → upload ([content_api.py:987](../../content_api.py#L987)); no OCR/palette/hierarchy check |

## Open follow-ups

- **P0 baseline** (canonical next step, [build_plan](../build_plan.md)): generate a real tech-house Flyer **including a dense lineup/set-times stress test**, name the gap honestly. Needs local server (`./run.sh`) + fal credits. This is the evidence gate above.
- Write the **prep/verify spec** (the vision-extract + contradiction-catch + OCR-back-check spine).
- Decide the **Etchings param store** (Q4): no per-style store exists; closest precedent is `brand_kits` — model as a curated read-only sibling `{style_ref_url, fonts, palette, composition_notes, locked_seed, vision_schema}`.
