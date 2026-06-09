# Stack & Integrations

Source-of-truth inventory of every tool, API, and service Sound Cave depends on. Pulled from the codebase, not memory — re-verify against the files cited when reviewing.

**Last reviewed:** 2026-06-09

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
