# Spec: Conjure — generative Forge format (was "Motion"/"Embers")

> ## ⭐⭐ DIRECTION PIVOT 2026-06-22 (Doug, locked): GENERATIVE ORCHESTRATION — image AND video
> The code-effects palette (fall/spin/holo…) is **shelved**: it required hand-building every effect (a never-ending task) and couldn't do free-form requests. Doug's call + SoundCave's essence = **don't build models, orchestrate the best ones behind our taste.** Engine = **frontier generative models via fal** (no per-effect code — any instruction works):
> - **Image edit** → `fal-ai/nano-banana-pro/edit` (text swaps, object/material changes). PROVEN on the lips/ice image: "change AUGUST→SEPTEMBER on the ice" pixel-matched the engraving in 31s.
> - **Video** → `fal-ai/kling-video/v2.6/pro/image-to-video` (melt, drift, anything). PROVEN: ice-melt in 56s.
> - **UI name + placement (Doug, 2026-06-22, locked):** **Animation** — a **format in the Forge FORMAT dropdown** (Still / Carousel / Flyer / **Animation**), NOT a top-nav sub-tab. Renamed from "Conjure" and the standalone CONJURE sub-tab was removed. Selecting Animation swaps the standard input stack for a generative sub-form: **Artwork (upload) → Motion (plain-words instruction) → Length (5/10s) → ANIMATE → looping `<video>` → SAVE TO STASH.** Output size follows the source artwork (Size picker hides).
> - **Scope call (Doug's "different output format = animation"):** the Forge UI exposes **animate→video only**. The generative **image-edit** path (nano-banana text/material swaps) stays live in the `/api/conjure` backend (`action=edit`) and can be surfaced later as a "tweak the still first" pre-step or its own thing — not dropped, just not in the v1 Animation UI.
> - **UI spec (ui-change-protocol):** References = the existing Forge input/output cards (this is a restructure, not a new look). Mood = SoundCave dark, caveman-adjacent, terse. Hero moment = pick "Animation" in the dropdown → the form cleanly morphs to upload+motion → one looping video. Anti = the bespoke inline-styled panel the prototype used (replaced with native `.card`/`.forge-stack-label`/`.forge-label`/`.input`/`.btn-red`/`.btn-outline`/`.forge-image-preview`). Constraints = dark non-negotiable, match Forge exactly, reuse credits/auth/Stash infra.
> - **Build status (2026-06-22):** prototype `scratch/embers_local/gen_studio.py`(:8078) ✓ · backend `conjure_gen.py` + `POST /api/conjure` (credits+storage) ✓ · **Forge UI as the Animation format ✓ built + syntax-clean on `firepit-embers`** (`index.html` dropdown option + `#forgeAnimationStack`; `js/firepit.js` `generateAnimation`/`forgeAnimPreview`/`saveAnimationToStash` + `updateForgeFields` stack-toggle + `editStashItem` video reopen; `js/stash.js` video thumbnail). **NEXT = Doug's live UX review → merge→deploy.**
> - Tradeoffs: animate=100 credits (~video_premium), quality variance (far better on photographic art + frontier models than the earlier halftone/LTX failure). Leverage > build.
> - The **code engine** (`animation_gen.py`) stays as a cheap bounded fallback, not the main path. Higgsfield MCP = a later option (not connected; setup step).

## (historical) Motion / Embers — code-effects R&D below
# Spec: Motion — animate a finished artwork (a distinct Firepit format) — working name "Embers"

> **Reframe 2026-06-22 (Doug):** this is its OWN Firepit **format**, NOT a "Flyer" variant. Input = any finished static artwork (a Forge Flyer, cover art, poster, or an upload); output = an animated version. It's a **transform** format (takes a finished asset → animates it), distinct from the generate-from-brief formats (Post/Carousel/Short/Flyer/Bio/Press). Sits as a new entry in the Forge format list.
>
> **Status:** Stage B (layer separation) proven. Stage C (i2v) is *technically* viable (Kling holds, LTX melts) **but the spike output did NOT clear Doug's bar** — quality is UNPROVEN. **Build order: prove ONE animation Doug would post, THEN plumb the format.** Do not build format plumbing around rejected output.

> **⭐ DIRECTION LOCKED 2026-06-22 (Doug) — pivot away from AI/i2v.** i2v on stylised flyer art produced "bugs" (the halftone texture crawls; the human barely moves). Decision: **the effect is SIMPLE, LOOPING, HOLOGRAPHIC, built in CODE (ffmpeg/PIL/numpy) — no generative video.** Think iridescent holo-foil sheen / prism shimmer / hologram-scan that sweeps across a finished flyer on a seamless loop. **v1 deliverable: a LOCAL test tool** so Doug iterates the look and gives feedback before it's wired into Forge as a format. i2v/Stage C is shelved (revisit only for photographic sources, later).
>
> **⭐ KEY UX (Doug, 2026-06-22): per-region, instruction-driven.** Every flyer animates differently, so the user **circles the specific item** (brush mask on a canvas) + **types what it should do**; only that region animates, the rest stays byte-identical. **Text maps to a code-motion palette, not arbitrary AI motion** (free-text→any-motion needs the i2v that bugs). Palette: `holo/shimmer · prism · glow/pulse · flicker · sweep/glint · sparkle · ripple/sway · scan`. No selection = whole poster.
>
> **v1 LOCAL TOOL — BUILT & VERIFIED 2026-06-22** at `scratch/embers_local/` (gitignored prototype; `app.py` Flask :8077 + `motion.py` engine + `index.html` brush-canvas UI; needs `numpy`). Proven: region-only animation (motion inside circled region 2.80 vs outside 0.07 = rest untouched), text→motion keyword mapping, seamless loop. Run: `cd scratch/embers_local && source ../../venv.nosync/bin/activate && python app.py`.

> **⭐ LIVE INTEGRATION STARTED 2026-06-22 — branch `firepit-embers`** (Doug's call to build it into the app now; deploy gated on look-lock). Architecture:
> - **Engine (DONE):** `animation_gen.py` (project root, tracked) — proven engine ported from the prototype. Public entry `animate(image_bytes, instruction, motion, mask_bytes, intensity, speed, duration) -> (mp4_bytes, meta)`. Instruction-driven (no dropdown): free text → effect via `parse_instruction`. Effects: holo/prism/glow/flicker/sweep/sparkle/ripple/scan + `fall` (subject cut via birefnet → drop top→bottom → FLUX-Fill the vacated hole, original art kept). Deps: `numpy` (added to requirements), Pillow, ffmpeg (already on Railway for video tier), FAL_KEY (birefnet + FLUX Fill). Verified standalone (450×800, 72f, fall).
> - **Endpoint (TODO):** `POST /api/animate` in `content_api.py` — multipart artwork + instruction(+params) → `_debit` credits → `animation_gen.animate` → `media_gen.save_video` → URL (refund on failure). Mirror `/api/generate-media` (`content_api.py:673`).
> - **Frontend (TODO):** new **Motion** format in Forge (`js/firepit.js` + `index.html`) — upload finished artwork → instruction box → animate → looping `<video>` → save to Stash. Runs `ui-change-protocol` (refs/mood already gathered: holographic/chrome aesthetic, dark palette, ref videos in `scratch/embers_local/refs`).
> - **Deploy (GATED):** Railway (backend, manual `railway up`) + Vercel (frontend, auto on `main`). Only after the look is locked + endpoint/UI done. Build/verify on `firepit-embers` first.
>
> **Open quality item:** the FLUX-Fill hole-fill is the best automated result but can leave a faint trace on hard cases (big central subject between conflicting colours) — Adobe Generative Fill on the still + upload remains the hero-shot escape hatch. **Fall look "MUCH better" per Doug; not formally locked.**

## Phase 0 result (2026-06-22) — Stage B is viable

Spiked Stage B on a real baked-text techno flyer (`scratch/phaseA_direction_test.png`). **Key unlock: `fal-ai/image-editing/text-removal`** (dedicated) reconstructs a **clean text-free plate** in one ~10s call — `evf-sam` (coarse blob) and general `object-removal` (hallucinated smear) both failed. Text mask derived from `diff(source, plate)` at a high threshold + despeckle + dilate. Recomposite is visually identical to source; **byte-identity in mask region = max diff 0**. Spike: `scratch/embers_p0_spike_v2.py`; artifacts: `scratch/embers_p0_v2/`.

**Two caveats carried into Phase 1:**
1. **Mask precision** — diff-mask over-captures graphics/halftone. Over-freezing is *safe* (never warps text) and arguably desired (freeze all designed marks). Tighten with OCR-box masks only if we want to animate *around* graphics.
2. **i2v payoff is style-dependent** — rich on photographic/atmospheric backgrounds; marginal on flat graphic-design flyers (Ken Burns already covers those). Pick atmospheric-style flyers to showcase Embers.

### i2v value test (2026-06-22) — Stage C also viable, model choice MATTERS

Ran the full chain (plate → i2v → frozen-text overlay) on an atmospheric flyer (`cowgirl_dj_v2.png`):
- ❌ **LTX i2v** (`fal-ai/ltx-video/image-to-video`, ~$0.02): **melted** the scene into bright mush in 5s + force-cropped to landscape. Unusable. (Cheap-tier i2v is NOT viable.)
- ✅ **Kling v2.5-turbo i2v** (~$0.35/5s): coherent subtle motion — the DJ actually mixes, atmosphere breathes, no warp, **portrait preserved**, frozen text crisp on top. A usable animated flyer.
- vs **Ken Burns** (Phase D): mechanical zoom on the flat still; nothing in the scene moves. Kling is clearly more alive on a photographic source.

Conclusion: **build Phase 1 with a Kling-class i2v as primary; never LTX.** Cost ≈ video_premium tier. Minor Kling artefacts to watch in Phase 1: slight reframe/zoom of the plate + small duotone colour shift (handle alignment + colour-lock). Clips: `scratch/embers_i2v/embers_kling_overlay.mp4` (good), `embers_i2v_overlay.mp4` (LTX, bad), `embers_kenburns.mp4` (baseline).

This updates §5 (Stage B approach): use the dedicated text-removal model, not SAM+separate-inpaint. And §4 (`i2v_models`): Kling primary, LTX banned.

## 1. Why this exists (and why it's NOT just Phase D)

We already ship a "make THIS flyer move" path: **Phase D** (`generate_video_composite(base_image_bytes=…)`, [media_gen.py:1029](../../media_gen.py#L1029)) animates the *whole* flat flyer with an **FFmpeg Ken Burns** 2D transform (slow push-in / parallax) + audio. Text never warps because nothing is regenerated — it's a geometric move.

**Embers is the harder thing Ken Burns can't do:** *generative* motion inside the artwork — smoke curling, light leaks drifting, particles, real parallax depth — while the text and logos stay **pixel-frozen**. To get generative motion we must run an image-to-video (i2v) model on the art, and i2v *will* warp any text it sees. So the whole feature is one idea: **separate the text/logo, animate only the background, paste the text back untouched.**

This is the **carbon-copy law** (glossary, 2026-06-12) extended from people (WHO refs) to text + logos. Same principle, same reason: diffusion mangles glyphs (FRIDAY → FREIDY) and never reproduces a real logo.

**Non-negotiable:** text + logo regions are byte-identical to the source in every exported frame. No glyph warp, no flicker on text.

## 2. The make-or-break (read before estimating anything)

The entire feature's quality rests on **Stage B — layer separation on a flat, baked-text flyer.** Our flyers have text *baked in* (decision 0008, Doug's firm call), so there is **no layered source to fall back on** — we must mask the text/logo and *reconstruct a clean background plate behind them* by inpainting. If the plate is dirty (ghost letters, smeared logo), the i2v animates garbage where the text used to be, and even a perfect re-overlay sits on a broken background.

Therefore **Phase 0 is a spike on Stage B alone** — prove we can get a clean plate + a byte-identical text re-overlay on ONE real flyer, *before* any video or queue work. This mirrors your own "look before building" P0 rule.

## 3. Pipeline — mapped to existing code (reuse first)

| Stage | What | Build status |
|---|---|---|
| **A. Ingest** | Accept approved flyer (flat PNG; layered source if ever available). Persist source + metadata. | **Reuse** Supabase Storage + `save_image` ([media_gen.py:1418](../../media_gen.py#L1418)); reuse `stash_items` lineage. |
| **B. Layer separation** | Flat → mask text+logo regions → inpaint a clean `background_plate` → store `text_logo_layer` (transparent PNG) + `masks`. | **NEW.** `remove_background` (birefnet, [:534](../../media_gen.py#L534)) does *subjects*, not text — not reusable here. Needs a text-region segmenter + an inpainter (§5). |
| **C. Animate background** | `background_plate` → i2v model, **low** motion, 5–10s. | **NEW model class.** Current video is *text*-to-video (LTX/Hunyuan/Kling/Veo, [:1137+](../../media_gen.py#L1137)). Reuse the queue+poll harness `_fal_queue_generate` ([:1095](../../media_gen.py#L1095)); add i2v endpoints (§4). |
| **D. Recomposite** | Overlay untouched `text_logo_layer` on the animated background, frame-accurate. Optional text reveal (fade/slide) done **here**, never generatively. | **NEW but small.** ffmpeg `overlay` filter (static PNG over video). Pattern mirrors `composite_who` PIL paste ([:557](../../media_gen.py#L557)) but per-frame. |
| **E. Export** | Per-aspect encodes (9:16 / 4:5 / 1:1) from one source, seamless loop, optional beat-sync timing. | **Reuse** `_mux_audio_onto_video` ([:1165](../../media_gen.py#L1165)), `save_video` ([:1448](../../media_gen.py#L1448)), Beat rights gate (`firepit_beat`). Loop + aspect logic NEW. |

## 4. Config map (model selection lives here, not inline — per brief)

A single Python dict in a new `media_config.py`. Verify live IDs against our Fal/Replicate accounts as the first build step (candidates below are unverified).

```python
EMBERS_CONFIG = {
    "i2v_models": {                     # ordered: primary -> fallbacks
        # SPIKED 2026-06-22: Kling held coherence (no warp), LTX MELTED (unusable).
        "primary":  "fal-ai/kling-video/v2.5-turbo/pro/image-to-video",  # ~$0.35/5s, portrait-safe
        "fallback": ["fal-ai/minimax/hailuo-2.3/standard/image-to-video"],  # VERIFY
        # DO NOT use fal-ai/ltx-video/image-to-video — degenerates to mush in 5s (spike proof)
    },
    "inpaint_model": "fal-ai/lama",     # or flux/sdxl inpaint — bake-off in Phase 0
    "text_segmenter": "craft|paddle-ocr|sam2",  # decide in Phase 0 spike
    "motion": {                         # HARD caps — intensity stays LOW
        "preset": "slow_push",          # slow_push|parallax|light_leak|particles|grain
        "max_intensity": 0.35,          # 0..1, clamp every preset to this ceiling
        "duration_seconds": {"default": 6, "min": 5, "max": 10},
        "fps": 24,
    },
    "aspects": {                        # one source -> all three
        "9:16": [1080, 1920], "4:5": [1080, 1350], "1:1": [1080, 1080],
    },
    "loop": {"mode": "boomerang|crossfade", "crossfade_frames": 8},
}
```

## 5. Stage B detail (the risky part) — approach + candidates

1. **Detect text regions:** OCR/text-detector (CRAFT or PaddleOCR) → boxes. Logos are harder — start with: (a) brand-kit logo template-match where a kit exists, else (b) a user-drawn mask in the approve UI. **Open question — see §9.**
2. **Refine to pixel masks:** SAM/SAM2 seeded by the boxes → tight alpha masks (avoids halos).
3. **Lift the text/logo layer:** `text_logo_layer` = source × mask, saved as transparent PNG (the *exact* source pixels — this is what guarantees byte-identity on re-overlay).
4. **Inpaint the plate:** masks → inpainter → `background_plate` with no ghost glyphs. Bake-off LaMa vs FLUX-inpaint vs SDXL-inpaint on a real flyer in Phase 0.

## 6. Postgres

- **Output + lineage:** reuse `stash_items` (already clipping-ready: `audio_track_id`/`start`/`end`). Store the three aspect URLs in `context` JSON (no migration), same pattern as carousel `slideUrls`.
- **Intermediate artifacts:** new **private** bucket `flyer_layers` — `plate.png`, `text_logo.png`, `mask.png` per source (provenance + lets us re-run animate without re-segmenting).
- **Async job table — Phase 3 only** (`db/00XX_media_jobs.sql`): `media_jobs(id, user_id, source_url, idempotency_key UNIQUE, status, provider, model, request_id, plate_url, text_layer_url, output_urls jsonb, error, created_at, updated_at)`. Idempotency key = hash(source_url + config) so re-submits return the existing job. **Not built in v1** — see §7.

## 7. Sync v1, async later (grug call)

The brief asks for idempotent jobs + webhook resume. The platform today is **fully synchronous** — it already holds requests 2+ min polling Fal ([firepit_video.md](../features/firepit_video.md)). The *risky* part of Embers is creative (Stage B quality), **not** the queue. So:

- **v1 = synchronous**, reusing `_fal_queue_generate`'s in-request poll. Ship it, prove the output is good.
- **Phase 3 = async** (`media_jobs` + Fal webhooks + resume) — add only when the full chain's wall-time (matting + inpaint + i2v + 3× encode ≈ several min) makes sync requests flaky in practice. Function boundaries in v1 are drawn so the job table slots in without a rewrite.

## 8. UI (defer visual build; runs `ui-change-protocol` when we get there)

- Entry point: Forge output, on a finished single-still **Flyer**, alongside the existing **+ ADD A BEAT** — a **"BRING TO LIFE"** action (label = Doug's call; caveman-law).
- **Human preview + approve gate** before final export (brief requirement): show the animated preview (one aspect) → approve → encode all three.
- Motion preset picker + intensity slider (clamped to `max_intensity`).

## 9. Open questions (need Doug before/while building)

1. **Logo masking when no brand kit exists** — auto-detect, or user draws the mask in the approve UI? (Recommend: user-assisted mask in v1; auto later.)
2. **Name** — "Embers"? (Firepit family: a still that flickers to life.) Your call — creative direction is yours.
3. **i2v cost tier** — Kling-class i2v is ~$0.50–2/clip. Same credit model as video_premium (debit-before/refund-on-fail)?

## 10. Acceptance criteria

- [ ] Text/logo regions **byte-identical** to source in every frame — diff over the mask region == 0 (the harness asserts this).
- [ ] No glyph warping, no flicker on text.
- [ ] Motion subtle (≤ `max_intensity`) and seamlessly loopable.
- [ ] All three aspect ratios produced from **one** source.
- [ ] Credits debited before, refunded on failure (reuse existing middleware).
- [ ] `MEDIA_GEN_DRY_RUN=1` short-circuits paid providers (reuse existing flag).

## 11. Deliverables

- `media_config.py` — the config map (§4).
- Pipeline module (extend `media_gen.py`): Stage B (segment + inpaint + lift), Stage C (i2v), Stage D (per-frame overlay), Stage E (multi-aspect + loop).
- `tests/` harness: one sample flyer → full pipeline (dry-run where possible) → **assert text-identity** (masked region pixel-diff == 0 on every exported frame).
- Phase 3 only: `db/00XX_media_jobs.sql` + webhook handler.

## 12. Phasing (smallest de-risking step first)

- **Phase 0 — Stage B spike:** ✅ **DONE 2026-06-22 → GO.** Clean plate via `text-removal`; byte-identity proven. See "Phase 0 result" above.
- **Phase 1 — animate + recomposite (sync, 1 aspect):** plate → i2v (low motion) → per-frame overlay → export 9:16. Preview+approve gate. Credits.
- **Phase 2 — multi-aspect + loop + presets + beat-sync hook.**
- **Phase 3 — async/idempotent/webhook** (`media_jobs`) — only if sync latency forces it.

## Related

- [firepit_video.md](../features/firepit_video.md) — the 3-tier video infra we reuse (queue+poll, mux, credits, dry-run).
- [brand_overlay_compositor.md](brand_overlay_compositor.md) — the draft two-layer (AI bg + code text) model for *stills*; Embers is its motion sibling.
- [decisions/0008_campaign_studio_first.md](../decisions/0008_campaign_studio_first.md) — baked-in text rationale (why there's no layered source).
- `composite_who` ([media_gen.py:557](../../media_gen.py#L557)) — the carbon-copy paste pattern Stage D mirrors per-frame.
