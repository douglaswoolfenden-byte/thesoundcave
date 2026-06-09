# Spec — Regen Variance Fix (Phase 3 v0.7)

> Status: **Approved — 2026-05-14** by Doug. Build sequence below is live.
> Related: [`brand_aware_image_gen.md`](brand_aware_image_gen.md) (v0.6, shipped), [`features/campaigns.md`](../features/campaigns.md).
> Tracked as Task #30.

## The problem in one paragraph

v0.6 ships brand-aware campaign images, but **each post drifts**. Brand and logo elements change between every image; some outputs are visually wrong. Root cause: single-reference FLUX Redux is inherently unstable — every post is an independent generation with no shared latent anchor, and asking FLUX to *render the logo itself* never works, it always drifts. **Brand consistency across a campaign IS the product** — promoters won't trust output that looks like 10 different designers worked on it.

## The four levers (full picture)

The fix has four levers. This spec scopes **levers 1 and 3** for v0.7 now; **2 and 4** are noted and deferred.

| # | Lever | In this spec? | Why |
|---|---|---|---|
| 1 | **Logo lockup as fixed Pillow overlay** | ✅ v0.7 now | Pure server-side code, zero API risk, kills logo drift instantly |
| 3 | **Deterministic per-campaign seed** | ✅ v0.7 now | One-line param on the Fal call; anchors all posts to adjacent latent space |
| 2 | **Multi-reference IP-Adapter** | ⏸ deferred | Needs research into Fal's current multi-image endpoint; FLUX dev Redux takes one image only |
| 4 | **Post-process palette enforcement** | ⏸ deferred | LAB-space colour clamping — more involved; belt-and-braces, not load-bearing |

## Lever 1 — Logo lockup as fixed Pillow overlay

**Principle:** don't pass the logo to FLUX at all. Composite it server-side from `brand_kits.logo_url` at a fixed position, after the FLUX canvas comes back.

**Behaviour:**
- In `_compose_brand_aware`, after the gradient + before the typography, fetch `brand_kit.logo_url` and paste it.
- Position: **corner preset**, chosen per brand kit. Stored in the existing `brand_kits.defaults` jsonb as `logo_position` — one of `bottom-right` (default), `bottom-left`, `top-right`, `top-left`. Fixed across every post in a campaign → identical placement, identical size.
- Size: logo scaled to a max width of ~180px (preserve aspect ratio), max height ~120px. Inset by `MARGIN` from the chosen corner.
- Collision note: the headline text block sits bottom-left and the post-type label sits top-left. `bottom-right` (default) avoids both. If the promoter picks a left corner, the logo still draws — overlap is their styling call.
- Transparency: if the logo is a PNG with alpha, paste with its alpha mask. If it's opaque (JPG), paste as-is.
- If `logo_url` is missing or the fetch fails: **skip silently** — no logo is better than a broken paste, and the post still ships.
- The Pillow fallback path (`_compose_pillow_fallback`) gets the **same** logo overlay — consistency applies there too.

**UI:** Brand Kits surface gains a small **LOGO POSITION** control (4-corner selector) next to the existing logo field. Writes `defaults.logo_position`. No migration — `defaults` jsonb already exists.

**Prompt change:** add a negative-ish instruction to the FLUX prompt — `"no logos, no text, no wordmarks"` — so FLUX stops trying to invent a logo that we're about to cover anyway.

**Out of scope for lever 1:** drag-to-place logo positioning (live preview canvas, per-post coordinates) — its own v0.8 spec page. v0.7 ships the 4-corner preset only.

## Lever 3 — Deterministic per-campaign seed

**Principle:** every post in a campaign shares a base seed derived from `campaign.id`, with a small deterministic offset per post type. Same seed → adjacent latent space → posts feel like a series.

**Behaviour:**
- New helper: `_campaign_seed(campaign_id, post_type)` → stable int.
  - Base: `int(hashlib.sha256(campaign_id.encode()).hexdigest()[:8], 16)` — deterministic from the campaign UUID.
  - Offset: a fixed small int per `post_type` (e.g. `announcement: 0, headliner_spotlight: 1, ...`) so post types differ slightly but every regen of the *same* campaign is identical.
- `generate_fal_with_reference` gains an optional `seed` param, passed straight through to Fal's `fal-ai/flux/dev/redux` request body (`"seed": <int>`).
- `_compose_brand_aware` computes the seed and passes it. It needs `campaign_id` — currently `compose_post_image` isn't given it, so we thread `campaign_id` through `compose_post_image(...)` from the call site in `campaigns_api.py` (the `camp['id']` is already in scope there).
- If `seed` is `None` (any non-campaign caller, e.g. the master flyer modal), behaviour is unchanged — Fal picks a random seed.

**Why an offset per post type and not per post:** we *want* same-type posts identical-ish and the campaign as a whole coherent. Per-post randomness is the thing we're killing.

## Files touched

| File | Change |
|---|---|
| `media_gen.py` | `generate_fal_with_reference` gains optional `seed` param → Fal request body |
| `image_composer.py` | `compose_post_image` + `_compose_brand_aware` + `_compose_pillow_fallback` gain `campaign_id` param; new `_draw_logo_overlay()` helper (reads `brand_kit.defaults.logo_position`); new `_campaign_seed()` helper; FLUX prompt gains "no logos/text" |
| `campaigns_api.py` | pass `campaign_id=camp['id']` into the `compose_post_image(...)` call |
| Brand Kits UI + API | 4-corner LOGO POSITION selector; persists to `brand_kits.defaults.logo_position` |

No schema migration (`defaults` jsonb already exists). No new API routes. No new dependencies (`hashlib` is stdlib, Pillow already in use).

## Definition of done (v0.7)

- Regenerate the BUCKINGHAM PALACE campaign.
- Every post carries the **same logo, same position, same size** — pixel-identical placement.
- Posts visibly feel like one series, not 10 designers — the seed anchoring is doing visible work.
- Re-running `{REGENERATE}` on the same campaign produces the *same* images (deterministic — by design, no shuffle button in v0.7).
- Changing LOGO POSITION on the brand kit moves the logo on the next regen.
- No Sound Cave branding anywhere (existing hard rule, unchanged).
- Doug confirms visually via screenshot before "done".

## Out of scope (v0.7 — deferred to v0.8)

- Lever 2 — multi-reference IP-Adapter (needs Fal endpoint research).
- Lever 4 — LAB-space palette enforcement.
- Drag-to-place logo positioning (live preview canvas) — own v0.8 spec page.
- "Shuffle seed" re-roll button — add later only if missed.
- Multiple output sizes (story / twitter).

## Sign-off

- [x] Doug — levers 1 + 3 scope approved (2026-05-14)
- [x] Doug — logo: 4-corner preset picker now, drag-to-place deferred to v0.8 (2026-05-14)
- [x] Doug — deterministic-regen approved, no shuffle button in v0.7 (2026-05-14)
