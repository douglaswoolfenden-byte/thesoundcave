# Forge UX principles — how the studio behaves

> Status: **Captured 2026-06-17** from Doug's external chat; principles adopted, **2 tensions with P1.5 flagged below for Doug's call.**
> Scope: the generation UX across Forge (all formats), with the [Etchings style gallery](style_gallery.md) as the entry point. Sits on the [forge_context_pipeline](forge_context_pipeline.md).
> Essence: [0008 — Campaign Studio first](../decisions/0008_campaign_studio_first.md).

## The frame
These five principles describe the *feel* of generation: shrink the gap between what the user pictured and what comes out. They live **after** the fast happy path — the no-designer user still gets a first flyer in two moves ([style_gallery](style_gallery.md)); these govern the *review → refine → approve* loop and multi-asset consistency. They are **optional richness, never added required steps** — that's how we keep both "fast for the buyer" and "iterative control."

## 1. Iterative control — no generation is final
Every output offers a way forward: small, incremental adjustments over big regenerations. Today that's **REGEN**; the principle asks for *finer* control (nudge the type, swap the backdrop, tighten toward the Etching) short of a full reroll.
→ **Tension with P1.5** (see below).

## 2. Examples as guide-rails, not constraints
The **Etching** the user picks is a *starting anchor*, not a cage. They deviate freely via WHO/WHERE/WHAT refs + Additional Context (the binding director's notes). Templates = inspiration anchors, not fixed formats. *(Strong fit — this is exactly the gallery's design.)*

## 3. Style consistency across a series
When a user makes more than one asset, hold the look: palette, type, composition, mood. Already real for **carousels** (Phase B: N slides, one locked style + seed). Extend it to a **campaign-level style lock** — lock an Etching once, generate a whole night's assets (flyer + posts + story) within it. Flag + offer to reconcile when a new request would break the set.

## 4. Closing the vision gap
When inputs are thin/ambiguous, surface assumptions *before* burning a generation; offer A/B options when intent is genuinely split.
→ **Tension with P1.5** (see below).

## 5. The workflow
Start (pick an Etching **or** blank canvas) → Generate → Review → Refine → Approve. If it's a series → **lock style** → keep generating within it.

## Resolution — Full iterative richness (Doug, 2026-06-17)
P1.5 (2026-06-11) had deliberately **stripped** two things:
- *"Variants killed: no 3-angle pick step — straight to copy + image; iterate via REGEN."*
- *"The shorter/longer/tone refine row dies."*

**Doug's call (2026-06-17): full iterative richness — principles 1 & 4 win; those P1.5 strips are reversed.** Finer refine controls + A/B options return as **first-class**, accepting they add steps. (Logged as a reversal in [forge_context_pipeline](forge_context_pipeline.md), P1.5.)

**Placement guardrail (recommended — to keep it from becoming the maze Doug flagged):** put the richness *after* the first output — the first flyer still arrives fast, then review → refine → A/B. Keep the *pre*-generation path minimal. Confirm or override.

## The refine loop — four capabilities (Doug's strategy note, 2026-06-17)
Market leaders (Firefly / Midjourney v7 / ChatGPT image) win on the feedback loop. Target capabilities, **tiered by how achievable they are on our API-orchestration stack** (we orchestrate Fal/Replicate/Nano Banana/FLUX — we don't own the model):

1. **Variation branching (A/B from a point)** — *easy.* Same context, different seeds, N outputs. Re-adds what P1.5 cut; cheap. **Build first.**
2. **Editing text after generation** — text is **baked into the image** (Doug's firm call, see below), so edits happen by **regenerating / iterating**, not by moving a separate text layer.
3. **Natural-language / selective IMAGE editing** (nudge the backdrop, swap one element) — *hard, model-dependent.* Needs inpainting / instruction-edit (Nano Banana / Flux-Kontext-class). Scope carefully; don't over-invest.
4. **Real-time / conversational feel** — *we don't control latency* (third-party API round-trips). Recalibrate to **"fast async"** (progress, streaming, queue), not literal real-time.

### Baked-in text is firm (Doug, 2026-06-17 — fork closed)
Text is **baked into the generation as one process**, not overlaid. Doug's reasoning from real use: the relayed/overlay text never matched the image's format, visibility or colour — it sat separate and disjointed — and couldn't be edited post-input anyway. Baked-in is more effective and integrated. **Not re-open territory.** Consequence for the refine loop: text changes go through **regen / iteration**, not a separate editable layer. (Claude wrongly re-opened this earlier from a creative judgement it isn't qualified to make — corrected.)

### Anchor — don't lose the moat
The refine loop is **table-stakes, not the differentiator.** We can't out-engineer Adobe's inpainting, and chasing it is the model-lab-racing trap [0008](../decisions/0008_campaign_studio_first.md) already rejected. Sound Cave wins on **niche-correct starting points (Etchings)** + a *good-enough* conversational loop. Scope the loop to "feels like iterating with a designer," not "beats Midjourney."
