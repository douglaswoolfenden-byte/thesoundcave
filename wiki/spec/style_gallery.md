# Style Gallery — "pick a look" for scene-native output

> Status: **DRAFT — pending Doug sign-off.** Open decisions flagged at the bottom.
> Essence: [decision 0008 — Campaign Studio first](../decisions/0008_campaign_studio_first.md).
> Builds on the finished input system: [forge_context_pipeline](forge_context_pipeline.md) (role-tagged refs) + [forge_output_refs](../design_references/forge_output_refs.md) (the tech-house reference research already done).
> Branch: `forge-output-ux`.

## The principle
A genre is a **lossy proxy for a look**. The image model doesn't care that a flyer is "tech house" — it cares about the pixels. So we let the user pick the *look directly*, as a picture, instead of translating look → word → look. This also handles the fact that **genres cross over**: the user picks the tile matching their hybrid scene, whatever it's called.

This is the front-end answer to "how does a user choose their scene": **a visual gallery, not a text dropdown.**

## What already exists (don't rebuild)
The STYLE pipeline is built and signed off ([forge_context_pipeline](forge_context_pipeline.md)):
- Reference images carry a **role**: WHO / WHERE / WHAT / **STYLE**.
- **STYLE** = "the flyer/artwork whose look rules the whole output" — the single aesthetic anchor.
- WHO/WHERE/WHAT are *separate channels* (a person to feature, a place, an object), so they never dilute the style. This is the "one strong style ref beats five muddy ones" law — already architected.

Today the STYLE ref is **uploaded by the user.** This spec adds a way to **pick a curated STYLE ref** instead.

## The design
**A curated gallery of tech-house STYLE tiles.** Picking one drops it into the existing STYLE-role slot of the context pipeline — *zero new generation architecture.* Upload-your-own STYLE stays as an option for power users.

- **Tiles organised by *look/theme*** (e.g. brutalist-mono, Boiler-Room-poster, duotone-portrait), with **genre as a tag/filter** — so a tech-house user browses "their" looks but isn't boxed in by a label.
- **The tiles are the moat.** Behind each tile sits the curated pack: the reference image(s) + locked fonts + palette + composition notes. A bare picture can't tell the compositor which font/hex to use; the pack does.
- **Start with one genre's worth of tiles: tech-house.** The catalogue of which references to use already exists in [forge_output_refs](../design_references/forge_output_refs.md) (Boiler Room poster series, UNTZIG, KHIDI, Mord, Possession, THE BRVTALIST…).

## The flow (happy path = 2 required steps)
1. **Pick content type** (Flyer / Post / Carousel) — *required*
2. **Pick a look** from the gallery (or upload your own STYLE ref) — *required*
3. Upload extra refs — WHO / WHERE / WHAT (a person, place, object) — *optional*
4. **Event details** (night, venue, city, date, doors…) — *required for Flyer*
5. **Additional context** — director's notes that weave it together — *optional*
6. **Spirit** — summon a saved character/avatar for face consistency — *optional*

Steps 3, 5, 6 are **optional but always present** (Doug's call — never excluded, progressively disclosed). The promise is "great flyer in two moves" for the no-designer user; power users expand the rest.

## Vernacular name (pending)
Per the caveman-language law, the gallery needs a vernacular UI label. Proposal: **"Cave Paintings"** (the visual styles on the cave walls — on-theme with Sound Cave). Alts: "Markings", "Wall". **Doug's call.**

## The tech-house pack — what Doug sources (the homework)
Taste is Doug's to curate; structure is the machine's. Per look/tile, provide:
1. **STYLE reference image(s)** — the gold-standard flyer/artwork for that look (his wiki already lists which).
2. **Fonts** — one mono + one grotesk, locked (per the Boiler Room note in forge_output_refs).
3. **Palette** — already set by the palette law: `#0a0a0a` / `#e8e8e8` / single `#ff4500`.
4. **One line on the look** — what's authentic, what's cringe.

## Decisions needed (sign-off before build)
1. **IP handling.** Public repo / shippable product. Baking competitors' *actual* flyers in as shipped tiles has IP risk. Options: (a) real flyers as *private* R&D reference only (not committed/shipped); (b) generate/commission "in-the-style-of" tile plates we own; (c) curate only clearly-licensed/own work. **Recommend (b) for shipped tiles, (a) during R&D.**
2. **Gallery vs upload.** Curated gallery as default, keep upload-your-own STYLE as an option? (Recommend yes.)
3. **Vernacular name** (above).
4. **First tile set** — how many tech-house looks at launch? (Recommend 3–5: a poster look, a minimal-post look, a carousel/lineup look.)

## Build outline (after sign-off)
- **P0** — baseline: run the current Flyer flow for a tech-house event, eye-test the output gap. (Needs local stack + fal credits — together step.)
- **P1** — gallery UI: tile grid at the style step; pick → inject as STYLE ref. Upload stays.
- **P2** — wire the tech-house tiles (Doug's sourced content + locked fonts).
- **P3** — generate flyers, run the promoter test, tune (FLUX.2 vs Nano Banana bake-off, teed up in P1.5).
- **Later** — clone the gallery to other genres; generation logging for the future "learn from users" system.
