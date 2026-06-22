# Build Plan — tech-house campaign studio (keep top of mind)

> The staged plan from here. **Canonical sequence** — the specs hold detail, this holds the map + where we are.
> Essence: [decision 0008](decisions/0008_campaign_studio_first.md). Specs: [style_gallery (Etchings)](spec/style_gallery.md) · [forge_ux_principles](spec/forge_ux_principles.md). Baked-vs-overlay: [decision 0009](decisions/0009_baked_vs_overlay.md).

## 📍 WHERE WE ARE
**Stage 0 (P0) — not started.** Everything below is gated on looking at real output first.
> Note (2026-06-22): the studio *went live* (Railway + Vercel) at current quality — but P0 baseline is still **un-fired** (acceptance gate open). Deploy ≠ proven. Next step unchanged: baseline a real flyer first.

## The 3 anchors (don't lose these)
1. **Moat = niche-correct starting points (Etchings)** — *not* the refine loop. The loop is table-stakes; don't race Midjourney.
2. **Prove before scale** — 3 looks proven before 20+. **Look before building** — P0 before everything.
3. **One scene (tech-house), one hero format (Flyer).** Everything else clones the proven pattern later.

## The stages

### Stage 0 — Baseline (P0) ← NOW
- **Goal:** generate a tech-house Flyer on the *current* Forge, put it next to a real reference, name the gap honestly.
- **Done when:** 1–2 flyers generated + an honest gap verdict written.
- **Confirms:** how far the recipe is from the bar, and that the **example-anchored path is mandatory** — blind no-reference generation is unanchored/generic (P0 proved it). Text stays **baked-in** (Doug's firm call).
- **Needs:** local server (`./run.sh`) + fal credits.

### Stage 1 — Prove the recipe (3 looks)
- **Goal:** 3 distinct tech-house looks — **poster · minimal-post · lineup-carousel** — each generating a flyer that passes the bar.
- **The bar:** *"a tech-house promoter would post this without embarrassment."*
- **Done when:** all 3 looks produce undeniable output (eye-tested vs references).
- **Depends on:** P0 verdict · your sourced reference flyers · locked fonts (1 mono + 1 grotesk).
- **Resolves:** baked-text-vs-layer — settled in [decision 0009](decisions/0009_baked_vs_overlay.md) (baked default; overlay = gated escape hatch). P0 adds the dense-text stress test that decides whether the content trigger is even needed. Refine richness sits *post*-generation.

### Stage 2 — Build Etchings (the gallery)
- **Goal:** the "pick a look" gallery UI — pick a tile → injects the STYLE ref into the proven pipeline; upload-your-own stays.
- **Done when:** picking an Etching reliably yields a scene-correct flyer. (Runs the `ui-change-protocol` first.)
- **Depends on:** Stage 1 proven recipe.

### Stage 3 — The refine loop (iterative richness)
- **Goal:** post-generation refine + A/B (your full-iterative-richness call), fast-async feel.
- **Order (by difficulty):** A/B branching (easy — first) → text edit **via regen** (text is baked in) → selective **image** edit (hard — scope, don't over-build).
- **Done when:** the user iterates without scrapping; it feels like working with a designer.

### Stage 4 — Scale to 20+ Etchings
- **Goal:** batch-produce 20+ owned "in-style-of" tiles using the proven recipe.
- **Done when:** rich launch gallery, every tile promoter-tested.

## Parked (after the studio lands)
- Clone the gallery to other genres (garage, DnB, punk…)
- Generation logging → the "learn from users" data flywheel
- Campaign-level style lock (one Etching → a whole night's assets)
- The discovery → studio round-trip (un-park tracking)

## Your standing homework
- Source authentic tech-house reference flyers (private R&D; start with 3 distinct looks → ~20 over time)
- Lock fonts: one mono + one grotesk
