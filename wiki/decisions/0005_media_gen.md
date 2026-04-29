# Decision 0005 — Media generation engine (image_gen → media_gen)

> Status: **Approved (in conversation 2026-04-29 with Doug). Implemented on `feature/media-gen`.**
> Companion to `0003_saas_architecture.md` (which sketched the three-tier video system). This doc records the *concrete* choices made during build.

## Problem
`image_gen.py` only made images. The product needs video too — three tiers at different cost/quality points (per `0003`). Decisions needed during the build, captured here for later readers.

## Decisions

### 1. Rename, don't fork
`image_gen.py` → `media_gen.py` via `git mv`. One module owns both image and video generation. No `image_gen.py` shim left behind; `content_api.py` imports updated in the same commit.

**Why:** decision 0003 already specified "image_gen.py → generalises to media_gen.py". Avoids drift between two files. History preserved through the rename.

### 2. Audio uploads at generation time, not a Tracks library yet
Users upload an audio file *with each generation request* (multipart `audio_file`). No dedup, no library UI in v1.

**Why:** the Tracks library is a real feature with its own UX (multi-upload, browse, reuse, picker on every generation form). Worth its own phase. Single-file uploads ship the loop fast.

**Forward-compat:** `audio_tracks` is its own table from day one (not a column on `stash_items`). When the Tracks library lands, no migration. When OpusClips-style auto-clipping (Phase H) lands, it picks `start_seconds`/`end_seconds` against an existing `audio_track_id`.

### 3. Audio fidelity is sacred
- Slicing: FFmpeg `-c:a copy` (bit-perfect, no re-encode)
- Muxing into video: single 320kbps AAC encode (sonically transparent)
- AI providers receive *no* audio input on any tier; they generate visuals only, audio is muxed locally afterwards.

**Why:** users are artists/labels uploading their own catalog. Quality matters. The "AI tarnishing audio" worry is real for naïve pipelines that re-encode multiple times — we don't.

### 4. Sync (blocking) Flask endpoint, not async
`/api/generate-media` blocks until the video comes back. Mirrors the existing `/api/generate-image` pattern.

**Why:** Inngest job queue is Stream 1 Phase G work. Premature to async-ify before the queue exists. Trade-off: slow generations (Tier 2 ~150s, Tier 3 ~3min) tie up a Flask worker. Acceptable at current scale; revisit at Phase G.

### 5. DRY_RUN mode for paid providers
`MEDIA_GEN_DRY_RUN=1` short-circuits all paid video providers (Fal LTX/Hunyuan/Kling, Replicate Veo) to a placeholder mp4. Image generation (~$0.003) is *not* dry-runned — too cheap to bother.

**Why:** lets us write and test pipeline code without burning API credits. Critical for CI and local dev. Default off; opt-in for testing.

### 6. Per-model poll timeouts, not a global one
LTX 240s, Hunyuan 420s, Kling 300s, Veo 300s. First implementation used a global 120s — Tier 2 first live attempt timed out *while still in queue waiting for a worker*. Fal queue wait alone was ~140s.

**Why:** video model latency varies wildly. Per-model timeouts let each provider have realistic headroom without making fast providers slow.

### 7. Single submit, single poll, no retries
On failure of the primary provider, fall through to the fallback once. No retry loops on either.

**Why:** retry-on-timeout multiplies cost and wait. Real bugs surface fast; flaky providers stay flaky and we add caching/queuing later if needed.

### 8. Hunyuan stays in the chain even without verification
Tier 2 fallback chain: LTX → Hunyuan. We verified LTX live; Hunyuan was *not* fired (would have added 4–7 min wait + $0.50 to verify a path with the same shape as LTX).

**Why:** Hunyuan is the same Fal queue API as LTX, just a different model path. Structural shape verified. Spending $0.50 to prove "yes, the same code with a different URL string also works" is poor ROI.

### 9. Tier 3 live verification skipped this PR
Veo: 402'd twice from Replicate (account billing edge case). Kling: never called.

**Why:** Phase C credits engine refunds on failure, so a paying user hitting a real Tier 3 bug doesn't lose credits. Cost of full Tier 3 verification (Veo billing fix + ~$2 Kling call) deferred to a follow-up. Code-complete but flagged in `firepit_video.md` acceptance criteria.

### 10. Cost transparency in API responses
Every successful response includes `estimated_cost_usd`. Frontend can show "this just cost ~£X" inline.

**Why:** matches the credits-engine spirit (Phase C) — users see what they're spending. Numbers are conservative (upper-bound list prices); tune from real invoices later.

## Files this decision touches
- `media_gen.py` (new — successor to `image_gen.py`)
- `content_api.py` (new endpoint, new credit costs, /api/health shape)
- `db/0007_audio_tracks.sql` (new table + clipping-ready columns)
- `wiki/features/firepit_video.md` (feature doc)
- `tests/sample_inputs/regenerate.sh` (hermetic sample)

## Open follow-ups
- Apply `db/0007_audio_tracks.sql` to Supabase + create private `audio_tracks` bucket before merge.
- Resolve Replicate Veo billing on Doug's account (probably needs spend cap raised or Veo 3 access requested separately).
- Stream 1: wire the Forge frontend to `/api/generate-media` post-merge. Until then, `/api/generate-image` alias keeps things working.
- Phase H: auto-clipping + Tracks library + longer-than-30s videos.
