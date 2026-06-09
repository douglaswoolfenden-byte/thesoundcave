# Spec — Image Gen v2 (Forge / MediaGen Rebuild)

> Status: **Approved — 2026-05-28** by Doug. Phase 1 (router) kicks off this session.
> Related: [`brand_aware_image_gen.md`](brand_aware_image_gen.md) (v0.6 — campaign-post path, will continue), [`regen_variance_v0_7.md`](regen_variance_v0_7.md), [`firepit_headline.md`](firepit_headline.md) (Firepit = headline product).

## Core principle

**Separate the pixels from the text.** AI generates artwork — backgrounds, hero illustrations, mascot characters — at full bleed. The app overlays headlines, dates, venue, logos, and QR codes as **editable canvas layers** on top.

Consequences:
- The AI never has to spell anything correctly. Typography is pixel-perfect.
- A date change costs $0, not another generation. Editing is free.
- "Same character on many flyers" becomes tractable via reference passing, not LoRA training (initially).
- The router can pick *cheap-vs-quality* per job instead of always paying premium.

This is a fundamental shift from the current pipeline where Pillow **bakes** typography server-side into an un-editable PNG.

## Architecture

```
User picks a template / style
        │
        ▼
[Backend] ── builds prompt + looks up avatar references
        │
        ▼
[fal.ai router] ── picks model by job type:
   • background  → Seedream v5.0
   • hero art    → FLUX.2 [pro]
   • avatar      → FLUX.2 / Nano Banana Pro (+ reference images)
        │
        ▼
Returns image URL(s) → store in Supabase Storage
        │
        ▼
[Canvas editor — Fabric.js]
   AI image as base layer
   + editable text, logos, QR as overlay layers
        │
        ▼
User edits freely → export final PNG/PDF
```

## Generation layer — model router

Single function in `media_gen.py`: `generate_for_job(job_type, prompt, **opts) → (bytes, provider, model)`. One-line swap point for future model changes.

| Job type | Model | Provider | ~Cost/img | Why |
|---|---|---|---|---|
| `background` | Seedream v5 Lite | fal.ai · `fal-ai/bytedance/seedream/v5/lite/text-to-image` | ~$0.035/img | Value play; backdrops + textured scenes. **No seed support** — model picks internally. |
| `hero_art` | FLUX.2 [pro] | fal.ai · `fal-ai/flux-2-pro` | ~$0.03/MP | Best photoreal + prompt adherence; up to 10 refs via `/edit` variant when needed. |
| `avatar` | Nano Banana Pro (edit) | fal.ai · `fal-ai/nano-banana-pro/edit` | ~$0.15/img | Built-in **character consistency** feature, up to 5 people per scene — beats FLUX.2 for recurring mascots. |
| `edit` | Nano Banana Pro (edit) | fal.ai · `fal-ai/nano-banana-pro/edit` | ~$0.15/img | "Make the car blue" / "remove smoke" / conversational edits with multi-ref. |

**Slugs verified 2026-05-29 against fal.ai docs.**

**`safe_commercial` dropped** — Adobe Firefly is not currently hosted on fal.ai. The partnership runs the other way (fal models inside Adobe Express). Re-evaluate when Firefly opens an API or fal hosts it.

**Ideogram v3 deliberately not used** — its main differentiator is in-image typography, which our text-overlay decision makes irrelevant.

**Model availability:** Doug confirmed all model names are live on fal.ai as of 2026-05. I'll verify endpoint shapes + parameter names against fal docs at implementation time (model API surfaces vary).

## Avatar system

Avatars (mascots, recurring characters, "the M character") need to look consistent across many generations. Two patterns; we ship v1 first.

### v1 — Reference-image pattern (ship now)

- New `avatars` table — stores reference images + canonical description per character.
- On every generation call that targets an avatar, the router fetches the avatar's reference URLs and passes them to FLUX.2 / Nano Banana Pro as `image_input` (alongside the new prompt — "the M character, now riding a motorbike at night").
- No training step. Works immediately. Good-enough consistency for promoter mascot work.
- This is the **direct fix** for the "uploaded artist photo, got nothing like him" bug — current Redux uses *one* style ref and never targets subject preservation.

### v2 — LoRA pattern (deferred)

If reference-passing drifts too much for a flagship character (e.g. Doug's hero mascot reused across an entire season), train a small LoRA on FLUX with ~10–20 images. Higher fidelity, but adds training cost + per-character pipeline. **Out of scope for v2 spec.**

## Compositing layer — Fabric.js editor

**Locked: Fabric.js** (Doug's pick — free, MIT, full control). ~3–5 days of UI work to ship.

Surface: new Forge sub-screen "Composer" — opens after a generation completes.
- AI image set as the base canvas layer (1080×1350 portrait default, configurable per template).
- Editable layers above:
  - **Text layers** — headline, sub, date, venue. Each is a Fabric `Textbox` with font / size / colour / weight / alignment / stroke.
  - **Logo layer** — drag-positioned brand kit logo (reuses `brand_kit.logo_url`).
  - **QR code layer** — generated client-side from a ticketing URL via the `qrcode` JS lib. Never let the model draw a QR.
  - **Sticker layers** — future: pre-made emojis / arrows / shapes.
- Export: rasterise to PNG (1× and 2×). Optional PDF export later.
- Save: serialise the Fabric JSON (layer state) back to a `composer_state` jsonb field on the post/stash item, so edits are non-destructive and re-openable.

## Storage — **stay on Supabase**

The writeup suggests Cloudflare R2 / S3. We're already on Supabase Storage; switching costs migration work for zero new capability. **Decision: continue using Supabase Storage buckets** (`campaign_images`, `brand_assets`, new `avatar_refs`, new `generated_assets`).

Re-evaluate if egress costs become material at scale (Supabase egress > R2 free egress at high volumes — but that's a post-beta concern).

## Job queue — **Python thread, not BullMQ**

The writeup suggests BullMQ (Node/Redis). We're a Python Flask stack with the queue decision already locked (`project_soundcave_pivot` memory: "Python background thread for async generation; no Inngest"). **Decision: continue with Python `ThreadPoolExecutor` for async dispatch.** Frontend polls a `posts.status` field for completion.

Re-evaluate if (a) we need durable jobs across server restarts, or (b) we hit thread-saturation issues. Then Celery + Redis becomes the upgrade path — still in Python.

## Cost estimate

Per flyer = 1 background + 1 hero/avatar ≈ $0.03 + $0.05–0.15 = **~$0.08–0.18 generation cost**. Edits + re-exports are free (client-side Fabric).

At 10 flyers / promoter / month × 20 promoters at beta = ~$36 / month gen cost. Comfortable.

## Commercial-use flag

Doug's writeup raised this — promoters publish flyers commercially. Action items at implementation time:
- Confirm Seedream's fal.ai terms cover commercial output.
- Confirm FLUX.2 [pro] commercial terms (FLUX has had commercial-licence nuances).
- Add Adobe Firefly as a `safe_commercial` job-type option for clients under legal scrutiny.
- Surface a per-template "Commercial-safe mode" toggle later (out of scope v2).

## Data model

**New table `avatars`:**
```sql
create table public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,              -- canonical text description for prompt injection
  reference_image_urls text[] not null default '{}',
  preview_url text,              -- one canonical preview (e.g. references[0])
  lora_weights_id text,          -- v2 LoRA support, null in v1
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- RLS: user_id = auth.uid()
```

**Storage bucket:** `avatar_refs` — per-avatar reference uploads. Path: `{owner_id}/{avatar_id}/{ts}_{rand}{ext}`.

**Extension to `stash_items` (or new `composer_state` field on posts):** `composer_state jsonb` storing Fabric JSON so edits are non-destructive.

## API surface (additions)

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/avatars` | List user's avatars |
| POST | `/api/avatars` | Create avatar (multipart — name, description, reference uploads) |
| PATCH | `/api/avatars/<id>` | Update name/description, add/remove references |
| DELETE | `/api/avatars/<id>` | Delete avatar + storage refs |
| POST | `/api/generate` | New unified endpoint: `{job_type, prompt, avatar_id?, style_ref_urls?, width, height}` → returns `{image_url, provider, model, generation_id}` |
| PATCH | `/api/composer/<post_id>` | Save Fabric JSON state |
| POST | `/api/composer/<post_id>/export` | Server-side rasterise (if client export insufficient) |

## Build phases (recommended sequence)

Each phase ships independently + is dogfoodable.

**Phase 1 — Router module (1 session)**
- Add `generate_for_job(job_type, ...)` in `media_gen.py` with stubs for each model.
- Wire to fal.ai endpoints (Seedream v5.0, FLUX.2 [pro], Nano Banana Pro) — confirm payload shapes from fal docs.
- Unit test each model from a script. No UI yet.
- **DOD:** I can hit `generate_for_job('background', prompt)` from a Python REPL and get back image bytes.

**Phase 2 — Avatar system (1 session)**
- Migration: `avatars` table + RLS + `avatar_refs` bucket.
- API: avatars CRUD + multipart upload.
- Hook into `generate_for_job` — when `avatar_id` given, fetch references and inject.
- **DOD:** Doug creates an avatar from 3 ref images, calls `/api/generate` with `job_type=avatar, avatar_id=...`, the output character looks like the references.

**Phase 3 — Forge UI for generation (1 session)**
- New Forge surface: job-type picker + prompt input + avatar selector + style-ref upload.
- Render result inline + "Open in Composer" button.
- **DOD:** Doug generates a background / hero / avatar from the Forge UI without writing SQL.

**Phase 4 — Composer (Fabric.js) (1–2 sessions)**
- New Composer surface inside Firepit (or sub-tab of Forge).
- AI image as base layer + draggable text / logo / QR layers.
- Save `composer_state` to backend; re-open is non-destructive.
- Export PNG (1× / 2×).
- **DOD:** Doug opens a generated image in Composer, drags text, changes a date, exports PNG, posts to social.

**Phase 5 — Templates (later)**
- Saved template presets (background type + hero type + layout). Out of scope for v2 spec; sketch in `templates_v1.md`.

**Total:** ~4–5 sessions to a functional v2.

## What this displaces

- **Forge's current `_generate_fal` text-to-image** path → replaced by router with job-type selection.
- **Campaign-post `_compose_brand_aware` Pillow typography baking** → eventually replaced when campaigns also flow through the Composer. **For v2, keep the current campaign-post path intact**; Composer comes to the Summons surface in a later phase. v2 is Forge-first.

## Out of scope (v2)

- LoRA-trained avatars (v3).
- Server-side PDF export.
- Template marketplace / sharing.
- Multi-user collaboration on the Composer canvas.
- Migrating campaign-post generation to the new pipeline (Phase 5+).
- Switching storage to R2 / S3.
- Replacing the Python thread queue with BullMQ / Celery.
- Adobe Firefly integration (added later when a "safe-commercial" toggle is needed).
- Ideogram v3 (deliberately out — text-overlay decision moots it).

## Sign-off

- [x] Doug — architecture approved (pixels-vs-text separation, model router, Fabric.js composer) — 2026-05-28
- [x] Doug — avatar v1 = reference-passing pattern; LoRA deferred — 2026-05-28
- [x] Doug — Supabase Storage (not R2/S3) approved — 2026-05-28
- [x] Doug — Python thread queue (not BullMQ) approved — 2026-05-28
- [x] Doug — Forge-first; campaign-post path stays on current pipeline for v2 — 2026-05-28
- [x] Doug — phase sequence approved (router → avatars → Forge UI → Composer → templates) — 2026-05-28
