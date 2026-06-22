# Forge Prep Interpreter + regenerate-from-base refine (Build B Phase 2)

> Status: **DRAFT — design agreed in conversation 2026-06-22 (Doug); pending sign-off on the locked decisions below.** No code until signed off.
> Essence: decision [0009 — baked vs overlay](../decisions/0009_baked_vs_overlay.md) (the prep/verify spine) + [0008](../decisions/0008_campaign_studio_first.md). Sits on [forge_context_pipeline](forge_context_pipeline.md); **revises the refine mechanism** in [forge_iteration_loop](forge_iteration_loop.md); honors [forge_ux_principles](forge_ux_principles.md) §1 (iterative control) + §4 (close the vision gap).
> Roadmap slot: [build_plan](../build_plan.md) Stage 1 → **Phase 2**. (Phase 1 = the recipe fix, proven 2026-06-22.)

## Why — three problems, all observed live in the real Forge (2026-06-22)
1. **Raw intent reaches the model unfiltered.** The Additional Context box is parsed *text-only* ([content_api.py:789](../content_api.py#L789) `_parse_additional_context`) — it never reads the reference image and never catches contradictions. A direction like "orange accents" against a red reference reaches the model as a conflict with nothing to resolve it (the documented red→orange inversion).
2. **Refine accumulates unrequested drift.** `/api/refine-image` edits the *last* output ([content_api.py:1073](../content_api.py#L1073)). Every pass re-renders the whole image through a diffusion model — re-renders are never pixel-exact, they drift toward duller/softer. So even a "no-op" refine **degrades what it didn't touch** (Doug: the background dulled, never instructed). The 2026-06-19 structure re-anchor fights *compositional* drift, not colour re-render drift.
3. **The user carries the decomposition burden.** Refine forces "one change at a time"; a bulk paragraph confuses the edit model. The user should not have to pre-split their own intent.

## The design — one architecture solves all three
Two parts: an **interpreter** between plain English and the tools, and **regenerate-from-a-stable-base** refine.

### A. The Interpreter (the prep step) — between intent and the tools
A fast LLM step that translates raw intent into tool-optimal instructions, for **both** generation-direction *and* refine. Extends `_parse_additional_context`.
- **Inputs:** the user's raw text (direction or refine paragraph) + the STYLE reference image + structured event facts + (refine) the current cumulative directive.
- **Jobs:**
  1. **Clean + translate** — natural language → instructions the image model won't misread.
  2. **Read the reference (vision)** — extract its real palette, font character, distress level, hierarchy into a structured style schema.
  3. **Catch contradictions** — text vs image (orange-vs-red) *and* within the text — reconcile or flag per the policy below.
  4. **Decompose (refine)** — accept a bulk paragraph; fold it into the cumulative directive (one pass, or branch into A/B).
- **Output:** one coherent directive (+ the style schema).
- **Constraints:** fast (Haiku, ~1–2s), **invisible/seamless**, and **failure-safe** — on any error, pass the raw text through exactly as today. The interpreter must never block or slow a generation; worst case it's a no-op.

### B. Regenerate-from-stable-base refine
Refine **regenerates from the original inputs** (style ref + event facts) **+ a locked seed + the cumulative directive** — it does NOT edit the last (degrading) output.
- **Kills the drift:** anything not in the directive stays as the original. Honors Doug's law — *"no change assumed unless stated."*
- **Enables bulk paragraphs:** the interpreter folds them into the cumulative directive; one regeneration applies the lot.
- **Version chain:** each version = original base + the directive set *at that point*. Branch = fork the directive set (not the pixels); step-back = drop later directives. (Frontend already holds a client-side version chain — it now carries directives, not just URLs.)
- This makes [forge_iteration_loop.md:48](forge_iteration_loop.md)'s own guidance ("big structural moves → regenerate from refs, not refine a drifted copy") the **default**, not a tip the user must remember.

## Decisions to lock (Doug's call — recommendations given)
1. **Reconciliation policy — ✅ LOCKED 2026-06-22: the user's text always wins.** When the typed text contradicts the reference (orange vs red), the user's instruction is final — the reference is a *starting anchor, not a cage* ([forge_ux_principles §2](forge_ux_principles.md)). The interpreter still **detects** the contradiction and resolves it **decisively toward the text** — so the output is cleanly orange, not a muddy half-and-half (that muddiness *was* the original red→orange bug) — and **notes in the output caption when it overrode the reference** (e.g. "applied 'orange' over the reference's red") so Doug can catch an unintended slip. Text wins, transparently.
2. **Refine base** — **REC: always regenerate from the original** + cumulative directive (this is what kills the drift). Keep true edit-in-place only as a later, explicit "touch-up" mode — never the default.
3. **Refine seed** — **REC: lock the original seed** by default (stable iteration); offer an explicit "reroll" button for variety.
4. **Latency budget** — **REC: interpreter ≤ ~2s** (Haiku); if it can't meet that, skip it for that call rather than make the user wait.

## Implementation sketch (after sign-off)
- **Interpreter fn** (extends `_parse_additional_context`): add a vision pass over the STYLE ref + contradiction-catch → emit a cleaned directive + style schema. Shared by `/api/generate-image` and `/api/refine-image`.
- **`/api/refine-image`:** switch edit-last-output → **regenerate-from-original + locked seed + cumulative directive**. Frontend version chain carries the **directive set**, not just URLs.
- **`build_restyle_prompt`:** consume the interpreter's cleaned directive + style schema (instead of the raw `direction`/`mood`).

## Acceptance bars (the prove step — reproduce each failure on the current build FIRST)
- **Contradiction:** red ref + "orange accents" → interpreter catches it; output coherent, not muddied.
- **Drift:** 3 no-op refines → background colour stays stable (no dulling).
- **Bulk:** one multi-change paragraph → all changes applied; untouched names/colours unchanged.
- **Seamless:** added latency within budget; failure-safe path verified (interpreter errors → generation still succeeds).

## Scope guards (don't over-build)
- **Reproduce each target failure on the current build before building its fix** — the look-before-building rule that's paid off all session (P0 → Phase 1).
- Build the **minimal** interpreter that clears the 3 bars; expand only when a new failure demands it.
- **Out of scope here:** the per-style param store / Etchings pack (open Q4) · true inpaint/region edit · async queue.

## Phasing within Phase 2
- **2a — Regenerate-from-base refine** (smaller; fixes the drift Doug hit today). Reproduce the dulling → switch refine to regenerate-from-original + locked seed → prove the drift bar.
- **2b — The Interpreter** (bigger; vision + contradiction-catch + bulk-decompose). Reproduce the contradiction → build → prove the contradiction + bulk bars.
- **Order: 2a first** (concrete, immediate relief), then 2b.
