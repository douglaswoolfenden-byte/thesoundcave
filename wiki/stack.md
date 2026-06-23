# Stack & Integrations

Source-of-truth inventory of every tool, API, and service Sound Cave depends on. Pulled from the codebase, not memory — re-verify against the files cited when reviewing.

**Last reviewed:** 2026-06-09 · **COGS verified vs live fal pricing + real usage:** 2026-06-23 (see [§ Verified unit COGS](#-verified-unit-cogs-2026-06-23) + [decision 0010](decisions/0010_media_gen_cogs_verified.md))

> Scope note: only services actually called by Sound Cave code are listed. The workspace `.env` also holds Apollo, EchoTik, Perplexity, Notion and Meta keys — **none are used by this product** and must not be treated as Sound Cave dependencies.

---

## 🧠 Text generation — Anthropic Claude (single provider, two tiers)

| Model | ID | Used for | Where |
|---|---|---|---|
| **Haiku 4.5** | `claude-haiku-4-5-20251001` | Bulk post copy, image-prompt engineering | `campaigns_api.py:30`, `content_api.py:415`, `media_gen.py:167` |
| **Sonnet 4.6** | `claude-sonnet-4-6` | Hero posts (announcement / headliner_spotlight / recap) + flyer **vision** extraction | `campaigns_api.py:31`, `events_api.py:23` |

Tiering rule: **Haiku = volume, Sonnet = quality + vision.** Hero post types are the set `{announcement, headliner_spotlight, recap}` (`campaigns_api.py:32`). All calls via the `anthropic` SDK on `ANTHROPIC_API_KEY`.

---

## 🎨 Image generation — Fal AI primary, Replicate fallback

**Image Gen v2 router** — job-type → model, approved 2026-05-28 (`media_gen.py:340`, spec `spec/image_gen_v2.md`). Swapping a model = swap the slug in `_JOB_REGISTRY` (single-line swap point by design):

| Job | Model | Slug |
|---|---|---|
| `background` | **Seedream v5 Lite** (ByteDance) | `fal-ai/bytedance/seedream/v5/lite/text-to-image` |
| `hero_art` | **FLUX.2 [pro]** | `fal-ai/flux-2-pro` |
| `avatar` / `edit` | **Nano Banana Pro** | `fal-ai/nano-banana-pro/edit` |

Principle: pixels and text are separated — this layer produces art only; text overlay happens client-side in the Composer (Fabric.js). Seedream's endpoint strips seed/negatives/steps (model chooses internally); for deterministic output use FLUX.2.

**Legacy v0.6 paths still in code** (brand-aware style-reference flow):

| Purpose | Provider / model | Slug |
|---|---|---|
| Fast backgrounds | Fal **FLUX schnell** | `fal-ai/flux/schnell` |
| Brand-aware (style ref) | Fal **FLUX dev Redux** | `fal-ai/flux/dev/redux` |
| Fallback | Replicate **FLUX schnell** | `black-forest-labs/flux-schnell` |

---

## 🎬 Video generation — 3 tiers

Defined in `media_gen.py` (`MediaType` enum + tier generators). Per-model poll timeouts because latency profiles differ.

| Tier | Provider / model | Slug |
|---|---|---|
| 1 — composite | **FFmpeg** (local binary, no API) | — |
| 2 — standard | Fal **LTX-Video** (primary) → **Hunyuan** (fallback) | `fal-ai/ltx-video`, `fal-ai/hunyuan-video` |
| 3 — premium | Fal **Kling 1.6** (primary) → Replicate **Veo 3 fast** (fallback) | `fal-ai/kling-video/v1.6/standard/text-to-video`, `google/veo-3-fast` |

Guardrails: `MAX_VIDEO_DURATION_SECONDS = 10`; Veo 3 fast caps at 8s. `DRY_RUN` short-circuits all paid video providers.

**Animation format (the shipped one, separate from the 3 tiers above):** `conjure_gen.py` → **Kling v2.6 Pro i2v** (`fal-ai/kling-video/v2.6/pro/image-to-video`), upload artwork → looping video, audio off, 5s default. This is what Forge's "Animation" option uses; the Kling 1.6 text-to-video tier above is the legacy Firepit video feature.

---

## 💰 Verified unit COGS (2026-06-23)

Pulled from **live fal model pages + Doug's real fal usage dashboard** (not list-price guesses). ≈ £0.79/$. Re-verify on any model/provider change. Reasoning + pricing implications: [decision 0010](decisions/0010_media_gen_cogs_verified.md).

| Model | fal price | ≈ £ |
|---|---|---|
| Kling v2.6 Pro i2v (5s, audio off) | $0.07/s → **$0.35** | £0.28 |
| Kling v2.6 Pro i2v (10s) | **$0.70** | £0.55 |
| nano-banana-pro/edit | **$0.15**/img (1K–2K; 4K = $0.30) | £0.12 |
| flux-2-pro/edit | ~**$0.075** (2K; $0.03 first MP + $0.015/extra) | £0.06 |
| flux/schnell | ~$0.003 | <£0.01 |

**⚠️ The `COST_ESTIMATES` constant in [media_gen.py:65-66](../media_gen.py#L65-L66) is stale** — `video_premium: 2.00` / `..._10s: 4.00` are ~5.7× the real Kling COGS ($0.35 / $0.70). It feeds the in-app `estimated_cost_usd` display and fed the 2026-06-23 credit repricing → the source of the "£1.55–£3 per video" myth. Fix pending (decision 0010).

**Real spend to date** (fal dashboard, Feb–Jun 2026): ~$15.50 total, **image-dominated** — `nano-banana-pro/edit` $8.40 (54%); all-time *video* spend just **$1.75**.

---

## 🎵 Music generation

**None.** No Suno / Udio / audio-gen integration exists. Music in the system is user-uploaded audio only (`/api/...` multipart `audio_file`, 25 MB cap).

---

## 🔌 Supporting infrastructure (non-generative)

| Service | Role | Env key(s) | Status |
|---|---|---|---|
| **Supabase** | Postgres + auth + storage buckets | `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | ✅ Connected |
| **Stripe** | Billing | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | ✅ Connected |
| **Ayrshare** | Social posting / scheduling | `AYRSHARE_API_KEY` | ✅ Connected |
| **SoundCloud** | Artist data / lineup matching | `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET`, `SOUNDCLOUD_OAUTH_TOKEN` | ✅ Connected |

### Python libraries (`requirements.txt`)
`flask` + `flask-cors` (backend) · `anthropic` (text/vision) · `supabase` + `psycopg[binary]` (DB) · `Pillow` (image compositing) · `apscheduler` (scheduled foraging) · `stripe` (billing) · `requests`, `python-dotenv`.

### Client-side
**Fabric.js** — Composer text-overlay layer (per Image Gen v2 spec).

---

## Provider key matrix (generative)

| Provider | Env key | Powers |
|---|---|---|
| Anthropic | `ANTHROPIC_API_KEY` | All text + flyer vision |
| Fal AI | `FAL_KEY` | Primary image + video |
| Replicate | `REPLICATE_API_TOKEN` | Image + video fallback |

---

## Review notes / open questions

- **Two image-gen generations coexist** (v0.6 FLUX-Redux paths + v2 job router). Worth deciding whether v0.6 is fully retired once v2 Phase 3 lands, or kept as a deliberate fallback.
- No music generation — flag if that's a roadmap gap for promoter content.
- Single text provider (Anthropic) — no fallback if the API is down. Acceptable for now; note it as a single point of failure.
