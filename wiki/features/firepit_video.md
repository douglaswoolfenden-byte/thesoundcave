# Feature: Firepit — Video generation (3 tiers)

> Status: **Code complete; live-verified for Tier 1 (FFmpeg) + Tier 2 (Fal LTX). Tier 3 structurally verified only — Veo billing 402'd, Kling not exercised.** Added 2026-04-29 on `feature/media-gen`.

## What it does
Generates video posts for music industry users from a user-supplied audio track + AI-generated visuals. Three tiers, picked by the user based on quality vs. cost:

| Tier | Backend | What it produces | Cost (approx) | Credits |
|---|---|---|---|---|
| **1 — Composite** | FFmpeg | Static AI image + Ken Burns motion + audio waveform overlay | ~$0.003 (cover image only) | 10 |
| **2 — Standard** | Fal LTX (primary), Hunyuan (fallback) | AI text-to-video, 5s @ 720p, user audio muxed | ~$0.05–0.50 | 20 |
| **3 — Premium** | Fal Kling (primary), Replicate Veo (fallback) | High-quality AI video, 5s, user audio muxed | ~$0.50–2 | 100 |

All three accept an optional/required user audio track and output an mp4 with the user's audio embedded — bit-perfect on slice (FFmpeg `-c:a copy` for slicing) and 320kbps AAC on mux. **No AI ever re-encodes the user's audio.**

## Why it exists
Sound Cave is a coordinator/aggregator — *not* a CapCut competitor. The hero loop is "one track + one artist photo → many platform-ready videos, scheduled to post". Three tiers let users pick the right cost/quality trade-off:
- **Tier 1** — bulk: a label drops a single, churns out 30 reels for £0
- **Tier 2** — daily content: short AI clips for routine posts
- **Tier 3** — hero moments: the launch trailer, the campaign opener

Decision history: `wiki/decisions/0003_saas_architecture.md` (the original three-tier spec) and `wiki/decisions/0004_parallel_execution.md` (Stream 2 scope).

## API surface

`POST /api/generate-media`

**Multipart/form-data** (when audio is supplied):
- `data` — JSON: `{media_type, content_type, duration_seconds, artist_data, ...}`
- `audio_file` — MP3/WAV up to 25MB

**application/json** (image-only or video without audio):
- body matches the multipart `data` field

**Response:**
```json
{
  "media_url": "https://...supabase.../generated_videos/<uid>/<file>.mp4",
  "media_type": "video_composite",
  "provider": "ffmpeg",
  "model": "composite+fal-ai/flux-schnell",
  "dimensions": {"width": 1080, "height": 1920},
  "duration_seconds": 5,
  "audio_track_id": "uuid-or-null",
  "estimated_cost_usd": 0.003,
  "credits_balance": 95
}
```

`GET /api/health` reports per-tier provider readiness:
```json
"media_providers": {
  "image": {"fal": true, "replicate": true},
  "video_composite": {"ffmpeg": true},
  "video_standard": {"fal_ltx": true, "fal_hunyuan": true},
  "video_premium": {"fal_kling": true, "replicate_veo": true},
  "dry_run": false
}
```

## Acceptance criteria
- [x] User can upload an MP3/WAV (up to 25MB) and generate a Tier 1 composite video with their audio + AI cover + Ken Burns + waveform
- [x] User can generate a Tier 2 AI video (Fal LTX) with their audio muxed in
- [ ] User can generate a Tier 3 AI video (Kling/Veo) — code-complete, live verification deferred
- [x] Audio fidelity preserved: stream-copy on slice, single 320kbps AAC re-encode on mux
- [x] Credits debited before generation, refunded on failure
- [x] `MEDIA_GEN_DRY_RUN=1` short-circuits paid providers for offline dev/CI
- [x] Hard caps enforced: `MAX_VIDEO_DURATION_SECONDS=10`, `MAX_AUDIO_FILE_BYTES=25MB`, per-model poll timeouts
- [ ] Frontend (Forge) wired to `/api/generate-media` — Stream 1 work, post-merge

## Out of scope (Phase H or later)
- **OpusClips-style auto-clipping** — beat/drop detection, batch generation of 30 clips from one track. Data model is clipping-ready: `audio_tracks` table is its own entity, and `stash_items` has `audio_track_id` + `start_seconds` + `end_seconds`. Phase H just adds the picker.
- **Tracks library UI** — multi-track upload, dedupe, reuse across campaigns
- **Async / Inngest job queue** — Stream 1 Phase G owns this; Stream 2 stays sync
- **Per-platform aspect ratio batch** — single aspect per call for now (Phase H or platform-batch feature)

## Files
- `media_gen.py` — provider routing, FFmpeg pipeline, audio storage, Tier 1/2/3 generators
- `content_api.py` — `/api/generate-media`, `/api/health`, credit middleware
- `db/0007_audio_tracks.sql` — `audio_tracks` table + clipping-ready columns on `stash_items`
- `tests/sample_inputs/regenerate.sh` — reproduces the hermetic 8s sine sample (.mp3 is gitignored repo-wide)

## Operational notes
- **Before this PR ships:** apply `db/0007_audio_tracks.sql` to Supabase + create the private `audio_tracks` storage bucket.
- **Provider configuration:** `FAL_KEY`, `REPLICATE_API_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY` all in workspace `.env`.
- **Verbose poll debugging:** `MEDIA_GEN_POLL_VERBOSE=1` prints each Fal/Replicate status change with queue position and elapsed time.
- **Fal queue waits routinely 2+ minutes on standard tier** — caching or warm pools come later.
