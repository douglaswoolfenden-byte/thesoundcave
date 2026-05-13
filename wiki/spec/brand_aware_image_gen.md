# Spec — Brand-Aware Image Generation (Phase 3 v0.6)

> Status: **Proposed 2026-05-13.** Awaiting Doug sign-off before code.
> Supersedes the "Fal FLUX abstract backgrounds" idea sketched in [`phase_2_3_pivot.md`](phase_2_3_pivot.md).
> Related: [`features/campaigns.md`](../features/campaigns.md), [`features/events.md`](../features/events.md).

## Problem

The v0.5 image composer produces a competent but **generic-looking** image per post. There's no consistency across a promoter's catalogue — every event's posts look like they were made by the same tool, not by the same brand.

Real promoters have a **visual identity** that spans dozens of events: a consistent font, palette, photographic treatment, layout language. A field day-style event vs. a basement-techno event should produce visually different posts even from the same promoter, but both should still "look like that promoter."

Generic AI imagery (Fal FLUX with no style reference) won't solve this — it'll just produce *different generic AI looks* per event. We need style transfer / brand-anchored generation.

## What we're building

Promoters build a **reference library** in their brand kit — a collection of past flyers and promotional pieces. When a new event is created, it links to a brand kit, and image generation uses those references to anchor the visual style of every post.

- The brand kit becomes the **visual DNA** of the promoter.
- Each event inherits a kit (with optional per-event override of colours).
- Image generation uses Fal FLUX with style reference (IP-Adapter or equivalent), passing 1–3 reference images alongside the event-specific prompt.

The output: posts that look like **your last 30 flyers**, customised for the new event's details.

## Data model

**`brand_kits` (existing — extend):**
- Existing: `id`, `owner_id`, `name`, `logo_url`, `display_font_url`, `body_font_url`, `colors` (jsonb), `templates` (jsonb, caption templates).
- **Add:** `reference_image_urls text[]` — ordered list of past flyer URLs in the brand library. ≤24 entries (we don't need more for style; FLUX uses top-N).
- **Add:** `is_primary boolean default false` — one per owner. Used as the default when an event doesn't specify a kit.

**`events` (existing — extend):**
- **Add:** `brand_kit_id uuid references public.brand_kits(id) on delete set null`.
- Behaviour: nullable. If null at generation time, the system picks the owner's primary brand kit. If still null (no kits exist), falls back to the v0.5 Pillow-only composer.

**Storage:**
- Reuse the `brand_assets` bucket for reference image uploads (it already exists from Phase B). Path convention: `{owner_id}/references/{ts}_{rand}{ext}`.

**Migration:** `db/0015_brand_kit_references.sql`.

## UI

**Brands tab (existing — extend):**
- Each brand kit card gets a **REFERENCE LIBRARY** section underneath the existing logo/fonts/colours.
- Grid of reference image thumbnails with a + tile to add more.
- Drag-and-drop multi-file upload accepted (PNG/JPG/WEBP, ≤10MB each).
- Reorder by drag (the first 1–3 are the strongest style anchors — order matters).
- Delete per-image via hover ✕.

**Event create / edit form:**
- New field: `BRAND KIT` dropdown — populated with the owner's kits + "None" as a fallback. Default to the kit marked `is_primary`.
- Below the dropdown, a tiny preview: kit name, swatch of the primary colour, count of reference images.

**Event detail page:**
- Add a "BRAND KIT" line in the metadata card alongside `status · voice_preset`.

## Generation pipeline (image composer rewrite)

For each post, the composer picks a path based on data availability:

| Path | Trigger | Output |
|---|---|---|
| **Brand-aware (v0.6)** | Event's brand kit has ≥1 reference image | Fal FLUX with style reference + Pillow overlay (typography, post-type label). The FLUX output becomes the background/canvas; Pillow adds typography per existing layout. |
| **Pillow v0.5 fallback** | No brand kit OR kit has no references | Current dark-slab + photo + typography composition. Unchanged. |

**Brand-aware path detail:**
1. Build the FLUX prompt from event data: `"Promotional flyer for {event.name} at {venue}, {date}. Underground music. Photographic style consistent with reference images."` (Tuneable in `config/image_prompts.py`.)
2. Pass the top 3 reference images from `brand_kit.reference_image_urls` as style anchors.
3. FLUX returns a 1080×1350 image — the "branded canvas."
4. Pillow overlays: post_type label (top-left corner), event/artist name (lower third), date/venue (below the name), bottom rule + S0UNDCAV3 mark.
5. Same dimensions, same upload path, same storage bucket as v0.5.

**Cost / latency expectations:**
- FLUX schnell call: ~3-5s per image. Campaign of 10 posts = +30-50s on top of copy gen.
- Fal cost: ~£0.003 per image × 10 posts = ~£0.03 per campaign. Sustainable.
- For v0.6 we keep generation synchronous; if total time crosses ~90s, move to background thread (was already planned).

## API surface (additions only)

| Verb | Path | Purpose |
|---|---|---|
| POST | `/api/brand-kits/<id>/references` | Multipart upload, returns updated `reference_image_urls`. Up to 10 files per request. |
| DELETE | `/api/brand-kits/<id>/references` | Body `{ url }`. Removes one reference. |
| PATCH | `/api/brand-kits/<id>/references/order` | Body `{ urls: [...] }`. Replaces the array (used on drag reorder). |
| PATCH | `/api/events/<id>` | Add `brand_kit_id` to the editable allow-list. |

No new top-level entity routes — references live inside brand kits.

## Order of operations (build sequence)

1. **Spec sign-off** (this page).
2. **Migration `0015`** — `brand_kits.reference_image_urls`, `brand_kits.is_primary`, `events.brand_kit_id`. Backfill: mark each owner's existing kit as primary.
3. **Backend** — three brand-kit reference endpoints + extend events PATCH allow-list.
4. **Frontend (Brands tab)** — reference library grid + multi-upload + reorder/delete.
5. **Frontend (events form/detail)** — brand-kit picker + display line.
6. **Image composer rewrite** — split into `compose_brand_aware()` and the existing `compose_pillow_fallback()`. Selection logic at the call site.
7. **Fal FLUX wiring** — extend `media_gen.py` (or write a sibling `media_gen_style_ref.py`) to call FLUX with `image_input` style refs. Use existing FAL_KEY.
8. **End-to-end test** on BUCKINGHAM PALACE with 3 reference flyers attached.

## Out of scope (v0.7+)

- **Style cloning per genre** — different references per post_type (announcement vs spotlight). v0.7.
- **Reference categorisation** — letting the promoter tag references as "lineup poster" / "story" / "throwback". v0.7.
- **Auto-extracted brand palette from references** — vision call that reads the dominant colours/fonts from uploaded refs to seed the brand kit. v0.8.
- **Field-day-style overlay** (Doug's mental example) — a brand-kit-level optional graphic overlay (e.g. a logo lockup) that gets composited on every output. v0.7.
- **Reference-driven Sonnet prompts** — passing the visual mood to the copy generator. Probably never needed; voice presets already cover this.
- **Image variants** (two per post with seed/layout variance). Currently one per post. v0.7.

## Definition of done (v0.6)

- Doug attaches ≥3 reference flyers to his primary brand kit via the Brands tab.
- BUCKINGHAM PALACE event has `brand_kit_id` set (auto-defaulted from primary).
- Regenerate campaign → 10 composed images, each visibly anchored in the reference style (consistent palette, photographic feel, typography mood) — not generic Fal FLUX abstract.
- Doug says: "this looks like my brand."

## Sign-off

- [ ] Doug — data model approved (`brand_kits` + `events` extensions)
- [ ] Doug — UI approach approved (reference library inside existing Brands tab)
- [ ] Doug — generation pipeline approved (FLUX with style refs + Pillow overlay)

Once ticked, this page becomes the live spec and the build sequence above kicks off.
