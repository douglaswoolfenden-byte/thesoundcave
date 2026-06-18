# Style Gallery — "pick a look" for scene-native output

> Status: **Approved 2026-06-17** (all decisions locked, incl. name = "Etchings"). Build not started — P0 baseline first. UX behaviour: [forge_ux_principles](forge_ux_principles.md).
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
6. **Spirit** — render a saved cartoon character/persona into the piece — *optional* (a real-person likeness is a WHO ref, not a Spirit — see glossary)

Steps 3, 5, 6 are **optional but always present** (Doug's call — never excluded, progressively disclosed). The promise is "great flyer in two moves" for the no-designer user; power users expand the rest.

## Vernacular name — **Etchings** (locked 2026-06-17)
The gallery is **Etchings**; a single tile/look is **an Etching** (images carved into the cave wall). "Markings" was ruled out — collides with the existing "Marks" (Brand Kits). Glossary updated. A picked Etching is a **starting anchor, not a cage** — the user deviates from it via WHO/WHERE/WHAT refs + Additional Context (see [forge_ux_principles](forge_ux_principles.md), principle 2).

## The tech-house pack — what Doug sources (the homework)
Taste is Doug's to curate; structure is the machine's. Per look/tile, provide:
1. **STYLE reference image(s)** — the gold-standard flyer/artwork for that look (his wiki already lists which).
2. **Fonts** — one mono + one grotesk, locked (per the Boiler Room note in forge_output_refs).
3. **Palette** — already set by the palette law: `#0a0a0a` / `#e8e8e8` / single `#ff4500`.
4. **One line on the look** — what's authentic, what's cringe.

**Volume:** source **3 distinct looks first** to prove the recipe; the launch gallery scales to **20+ tiles**, so budget ~20 distinct authentic tech-house references over time (private R&D refs only; shipped tiles are our own generated plates, per the IP call).

## Decisions (locked 2026-06-17)
1. **IP handling — LOCKED.** Real flyers are *private R&D reference only* (not committed, not shipped). Every **shipped** tile is an "in-the-style-of" plate **we generate and own.** Learn from real flyers privately; ship only our own art.
2. **Gallery vs upload — LOCKED.** Curated gallery is the default path; **upload-your-own STYLE stays** as an option.
3. **Vernacular name — LOCKED: "Etchings"** (the gallery) / "an Etching" (one tile). "Markings" ruled out (collides with "Marks").
4. **Tile volume — LOCKED.** Launch target **20+ tiles**, reached by *proving the recipe on 3 distinct looks first* (poster · minimal-post · lineup-carousel), eye-tested to the "a promoter would post this" bar, **then** batch-producing to 20+. Never manufacture 20 on an unproven recipe.

## Build outline
The staged build plan (P0 baseline → prove 3 looks → build Etchings → refine loop → scale to 20+) is the **canonical roadmap** at [build_plan](../build_plan.md). This spec holds the *what*; build_plan holds the *sequence + where we are*.
