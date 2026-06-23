# Decision 0010 — Media-gen COGS verified; stay on fal (no Higgsfield subscription)

> **Date:** 2026-06-23
> **Status:** Accepted. Resolves the ⚠️ DRAFT flag on the [2026-06-23 credit-pricing log entry](../log.md) — its two open uncertainties (the nano-banana COGS estimate, and "provider may change → Higgsfield") are now both closed with live fal pricing + Doug's real fal usage dashboard.
> **Context:** While pre-customer and testing, is it cheaper to run a Higgsfield-style subscription than pay-per-gen on fal? And are the COGS behind today's credit repricing actually real, or list-price guesses?

## The decision

1. **Stay on fal pay-as-you-go for the product.** Higgsfield's cheap/unlimited tiers are **web-UI only — explicitly not available via API/MCP/CLI** (their own pricing fine-print: *"Unlimited models … are accessible only via higgsfield.ai and are not accessible on MCP/CLI, Canva or Supercomputer"*). Sound Cave's pipeline is programmatic (Forge → Railway → fal), so a Higgsfield sub **cannot power it**. Non-starter regardless of price.
2. **Make Sound Cave's own promo content through Forge (dogfood) — also on fal.** The same spend buys promo assets *and* product validation, on the exact models customers use. A Higgsfield sub would be hand-made in someone else's UI, off-stack, off-brand.
3. **Revisit a Higgsfield sub only as a separate inspiration/exploration toy** if Doug wants to eyeball frontier models — never as the pipeline.

## Verified unit COGS (live fal pricing, 2026-06-23; ≈ £0.79/$)

| Model | fal price | ≈ £ | Used for |
|---|---|---|---|
| **Kling v2.6 Pro i2v** — 5s, audio **OFF** ([conjure_gen.py:76](../../conjure_gen.py#L76)) | $0.07/s → **$0.35** | **£0.28** | Animation format (the shipped one) |
| same, 10s | **$0.70** | £0.55 | Animation, 10s |
| **nano-banana-pro/edit** | **$0.15**/img (1K–2K; 4K = $0.30) | £0.12 | Flyer restyle/edit/avatar — the #1 cost line |
| **flux-2-pro/edit** | $0.03 first MP + $0.015/extra → ~**$0.075** (2K) | £0.06 | hero/restyle |

Numbers also recorded in [stack.md → Verified unit COGS](../stack.md). Re-verify against fal's live model pages on any provider/model change.

## ⚠️ Pricing implication — animation credits were built on a ~5.7× too-high video COGS

The [2026-06-23 repricing](../log.md) set **`video_premium` 240cr / `video_premium_10s` 480cr** for an 80%-margin floor, assuming **Kling 5s ≈ £1.58 / 10s ≈ £3.16**. Those COGS are **~5.7× too high** — true is **£0.28 / £0.55**.

- At the floor rate (Agency £0.0332/cr): 240cr = £7.97 revenue. True margin is **~96.5%, not 80%.**
- A genuine 80%-floor price at the *real* COGS is **~42cr (5s) / ~83cr (10s)** — not 240 / 480.
- **The image side is correct** — nano-banana $0.15 is verified, so the `image` 18cr stands. Only the **video** COGS was wrong.
- **Doug's call (pricing strategy, not mine):** either keep the fat margin (animations are very profitable) **or** drop animation pricing ~5.7× to make cheap animations an adoption hook. Recommendation, pre-customer: **price animations low** — the COGS supports near-giveaway, and cheap motion is a strong differentiator. His call.

## Code follow-up (wiki-first; NOT yet done)

`COST_ESTIMATES` in [media_gen.py:65-66](../../media_gen.py#L65-L66): `video_premium: 2.00` / `video_premium_10s: 4.00` are stale (~5.7× high). Fix to `0.35` / `0.70`. This constant **drives the in-app `estimated_cost_usd` display AND fed the credit repricing** — it is the root of the "£1.55–£3 per video" myth (the app was showing the stale estimate, not the real fal charge).

## Evidence (so this page is checkable)

| Claim | Evidence |
|---|---|
| All-time video spend = $1.75 | Doug's fal usage dashboard, Feb–Jun 2026: `kling-video/v2.6` $1.40 + `kling-video/v2.5-turbo` $0.35. Total fal spend ~$15.50; cost is **image-dominated** (`nano-banana-pro/edit` $8.40 = 54%). |
| Kling v2.6 Pro = $0.07/s (audio off) | [fal model page](https://fal.ai/models/fal-ai/kling-video/v2.6/pro/image-to-video); Forge sends `generate_audio: False`, 5s default ([conjure_gen.py:72-76](../../conjure_gen.py#L72-L76)). |
| nano-banana $0.15 / flux-2-pro ~$0.075 | fal model pages (2026-06-23). |
| Higgsfield is API-gated | Higgsfield pricing page fine-print (web-UI-only for unlimited/cheap tiers). |
| Stale cost constant | [media_gen.py:65-66](../../media_gen.py#L65-L66) `video_premium: 2.00`. |

## Forward spend (estimate, refinement included)

~25 videos + ~25 images/month with refine loops ≈ **~£35/mo** (range £20 lean → £65 heavy, driven by animation re-rolls + 10s clips). Trivial; stays on fal. Cost levers: draft on flux-2-pro/schnell and finalise on nano-banana; default to 5s audio-off.

## Open follow-ups

- **Doug:** decide animation credit pricing now COGS is known — keep 240/480 (fat margin) vs drop toward ~42/83 (true 80% floor / adoption hook).
- **Code:** fix the stale `COST_ESTIMATES` video constants (above).
- **Optional:** wire the official **fal MCP** (`mcp.fal.ai/mcp`) for in-session model runs + pre-submit cost estimates — generation-only; it exposes **no billing/usage** (that stays dashboard-gated).
