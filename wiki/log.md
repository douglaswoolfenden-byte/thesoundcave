# Sound Cave Wiki — Log

## [2026-04-29] [stream-2] Phase 3 — Tier 2 live verified (Fal LTX)
- First live attempt failed: both LTX and Hunyuan timed out at 120s. Bumped to per-model timeouts (LTX 240s, Hunyuan 420s, Kling/Veo 300s) — Fal queue wait alone was ~140s before a worker started.
- Added `MEDIA_GEN_POLL_VERBOSE=1` env switch — prints each Fal poll status change with queue position + elapsed time. Invaluable for debugging future stalls.
- Live LTX run verified: t+4s IN_QUEUE → t+142s IN_PROGRESS → t+152s COMPLETED. 5.3MB mp4, 5s @ 9:16, with muxed user audio. Cost ~$0.10.
- Lesson: Fal video model latency = queue wait + generation. Queue wait alone routinely exceeds 2 min on standard tier.

## [2026-04-29] [stream-2] Phase 3 — Tier 2 video (Fal LTX/Hunyuan), dry-run gate
- Cost/safety guardrails added: `MAX_VIDEO_DURATION_SECONDS=10`, `MAX_AUDIO_FILE_BYTES=25MB`, `POLL_TIMEOUT_SECONDS=120`. `COST_USD` table per tier surfaces estimates to API responses.
- `MEDIA_GEN_DRY_RUN=1` short-circuits paid video providers (Fal LTX/Hunyuan/Kling, Replicate Veo) to a placeholder mp4. Image gen (~$0.003) is not dry-runned — too cheap.
- `_fal_queue_generate(model_path, payload)`: single submit, single poll loop, no retries.
- `_generate_fal_ltx` / `_generate_fal_hunyuan`: 720p, num_frames = duration*24 (capped 240).
- `_mux_audio_onto_video`: stream-copies video, re-encodes audio at 320k AAC. Bit-perfect on the visual side.
- `generate_video_standard(prompt, audio_path, w, h, duration)`: LTX primary, Hunyuan fallback within Fal; user audio muxed post-gen.
- Smoke test (DRY_RUN=1): 91KB placeholder mp4, both streams present, 10s cap enforced via ValueError.
- **Live Tier 2 call NOT yet made.** Awaiting Doug's go-gate (~$0.10 estimated for one LTX call).

## [2026-04-29] [stream-2] Phase 2 — Tier 1 video (FFmpeg composite)
- `image_gen.py` renamed to `media_gen.py`; `MediaType` enum + `VIDEO_BUCKET` / `AUDIO_BUCKET` constants. Image gen behaviour preserved verbatim.
- `db/0007_audio_tracks.sql` — `audio_tracks` table (private bucket) + clipping-ready columns on `stash_items` (`audio_track_id`, `start_seconds`, `end_seconds`, `duration_seconds`, `media_type`). Idempotent. **Not yet applied to Supabase** — requires Doug to run.
- `generate_video_composite(prompt, audio_path, w, h, duration)`: generates a cover via existing image router, then `_ffmpeg_composite()` muxes user audio at 320kbps AAC under a Ken Burns 1.00→1.15 zoompan + showwaves waveform overlay (12% of video height, semi-transparent white). h264 + yuv420p, `-shortest`. No AI touches user audio.
- `upload_audio_track(file_bytes, filename)`: probes duration via ffprobe, uploads to Supabase `audio_tracks` bucket, inserts `audio_tracks` row. `LOCAL_IMAGE_FALLBACK=1` short-circuits to local-only for offline dev.
- `provider_status()` now nests by tier; flat keys preserved for `/api/health` backward compat. `_ffmpeg_available()` checks PATH.
- `tests/sample_inputs/sample_track.mp3` — 8s sine wave for hermetic smoke testing.
- E2E verified: real Fal flux-schnell cover + sample audio → 1.97MB mp4 (1080x1920, 6s) with both video and audio streams confirmed via ffprobe.

## [2026-04-29] [stream-3] Stream 3 closed
- All Trail Map UI v1 work shipped on `main` in commit `ca30c31` (rolled into the Stream 1 Phase A merge after repo extraction). No separate PR opened — direct merge was simpler post-extraction.
- Final checklist box ticked in `wiki/decisions/0004_parallel_execution.md`. Stream 3 is done.
- Backlog handed to Stream 1 Phase G: replace mock store in `js/trail_map.js` (TODO marker at top of file) with `/api/scheduled-posts`; mock-data shape contract documented in `wiki/features/firepit_trail_map.md`.
- Stale worktree at `/Users/douglaswoolfenden/Documents/dwcw-trail-map` (branch `feature/trail-map-ui`) is from the pre-extraction parent repo — orphaned, recommend Doug remove with `git worktree remove dwcw-trail-map` from the parent repo when convenient.

## [2026-04-29] [stream-3] Trail Map calendar UI v1
- New worktree `dwcw-trail-map`, branch `feature/trail-map-ui`. Pure frontend, mock data via `localStorage['sc_scheduled_posts']`.
- UI Change Protocol run with Doug — answers saved to `wiki/spec/firepit_trail_map_ui.md`. Reference: Carjoy dark week-grid dashboard. Constraint: keep cave palette + monochrome, mind-blowingly simple, no info overload, drag-drop is the hero moment.
- Files: `css/trail_map.css` (~280 lines, reuses `:root` tokens from `style.css`), `js/trail_map.js` (~250 lines, no deps beyond `esc()` from `app.js`), Trail Map placeholder in `index.html` replaced with toolbar (◀ period ▶ · Month/Week · Today · Stash drawer toggle), 6-week month grid, 7-col week grid, schedule modal (datetime-local + platform pills + status).
- Stash drawer reads live `getContentLibrary()` from firepit.js (Supabase-backed cache post-Phase-A). No localStorage fork.
- Mock-data shape documented in `wiki/features/firepit_trail_map.md` as the contract Stream 1 Phase G must fulfil at `/api/scheduled-posts`. `// TODO: replace mock store` marker left at the top of `js/trail_map.js`.
- Out of scope for v1: hourly time grid, recurring posts, bulk multi-select drag, real Ayrshare publishing.
- Next: open PR to main; Doug screenshots; iterate.

## [2026-04-29] Stream 1 Phase C — Credits engine
- `db/0005_credits.sql` — `debit_credits(uid, amount, reason, ref?)` and `refund_credits(...)` Postgres functions. Atomic via `SELECT … FOR UPDATE`; debit raises `insufficient_credits` (errcode `P0001`) if balance would go negative. Both write to `credits_ledger` and update `users.credits_balance` in the same transaction.
- `content_api.py` — debit-before / refund-on-error middleware. Pricing placeholder: text gen 1 credit, image gen 5 credits (`CREDIT_COST` dict — tune later). Failed gens auto-refund; `/api/generate` and `/api/generate-image` return `credits_balance` in success response, `402 {error:'insufficient_credits', cost:N}` when out.
- `js/firepit.js` — text + image gen handlers update the account-dropdown credits live from response, surface a clear "Insufficient credits — costs N" inline on 402.
- E2E verified: 100 → text gen → 99 with ledger row `(-1, 'gen:x_post')`. Forced 0 → 402 with `cost: 1`. Refund path exercised by raising an Anthropic error in the smoke (not committed).
- Note: Supabase admin API now restricts `auth.admin.delete_user`. Test users now linger in `auth.users` until cleaned via dashboard. Doesn't affect prod (RLS isolates).

## [2026-04-29] Stream 1 Phase B — Auth lockdown
- Doug confirmed first real sign-in works (`douglaswoolfenden@gmail.com`, magic link via `http://localhost:5500`).
- Cleaned up: deleted dev user `00000000-…0001` and one orphan from earlier admin testing; re-added FK `public.users.id → auth.users.id` with `on delete cascade`.
- Hardened `content_api.py`: removed `DEV_USER_ID` fallback in `_resolve_user_id()`; added `_require_user()` helper. All `/api/stash` routes + `/api/generate-image` now 401 without a valid JWT. `/api/config` stays public (it returns the anon key only).
- Verified: unauth requests to protected routes return 401; `/api/config` returns 200.
- Supabase dashboard config (Doug applied): Site URL `http://localhost:5500`; Redirect URLs `http://localhost:5500/**`.

## [2026-04-29] Stream 1 Phase B — Auth landed
- UI Change Protocol run; spec at `wiki/spec/auth_login_ui.md`. Doug accepted recommendations: magic link only, full-page splash gate, minimal account dropdown, "submit email → cave reveal" hero moment.
- Trigger `on_auth_user_created` on `auth.users` creates the matching `public.users` row (`db/0004_auth_sync.sql`). Verified end-to-end: created test user via admin API → public row appeared with `solo` / 100 credits.
- `js/lib/supabase.js` — loads `@supabase/supabase-js@2` from CDN, fetches public config from `/api/config` (URL + anon key, no committed secrets), exposes `window.scAuth` (session/user/token/signInWithEmail/signOut/onChange/authedFetch).
- Splash now gates on session: no session → email field appears in cave mouth; submit calls `signInWithOtp`; `SIGNED_IN` event triggers the existing reveal animation. `index.html` + `js/app.js` + `css/style.css` updated.
- Header gets an account dropdown (email · tier · credits · sign out) hydrated from new `/api/me` endpoint.
- `content_api.py`: added `/api/config`, `/api/me`; `_resolve_user_id()` validates `Authorization: Bearer <jwt>` via Supabase auth, falls back to DEV_USER_ID for legacy callers. `/api/stash` and `/api/generate-image` now use it. Frontend swaps every protected fetch to `scAuth.authedFetch`.
- Verified: real auth user → JWT → `/api/me` returns profile; `/api/stash POST` writes row owned by real `auth.uid()`; `/api/stash GET` reads only that user's rows.
- Held back to end of Phase B (after first real Doug sign-in confirms): delete dev user `00000000-…0001` and re-add `public.users.id → auth.users.id` FK (SQL ready in `db/0004_auth_sync.sql`).
- Files: `db/0004_auth_sync.sql`, `js/lib/supabase.js`, `index.html`, `css/style.css`, `js/app.js`, `js/firepit.js`, `content_api.py`, `wiki/spec/auth_login_ui.md`.

## [2026-04-29] Stream 1 Phase A — Supabase backbone landed
- Schema applied: `users`, `artists`, `stash_items`, `credits_ledger`, `scheduled_posts`, `connected_accounts` (+ `metadata` jsonb on stash). RLS on every table.
- Storage buckets `generated_images` and `generated_videos` created with public read + owner-folder write policies.
- DB connection: pooler at `aws-1-eu-west-2.pooler.supabase.com:6543`. Direct host `db.<ref>.supabase.co` is IPv6-only, doesn't resolve from this machine — use the pooler.
- `image_gen.py`: `save_image()` now uploads to Supabase Storage and returns the public URL. Local-disk write is gated behind `LOCAL_IMAGE_FALLBACK=1`.
- `content_api.py`: removed `/api/images/<filename>` route, added `GET/POST/DELETE/PATCH /api/stash` (service-role proxy) — Phase B will switch to per-user JWT.
- `js/firepit.js`: Stash now backed by `/api/stash` with an in-memory cache. One-shot `migrateLocalStorageStash()` pushes any `sc_content_library` rows on first load, then clears localStorage.
- Until auth: dev rows owned by user `00000000-0000-0000-0000-000000000001` (seeded in `public.users`). FK from `public.users.id` → `auth.users.id` dropped; Phase B will add a sync trigger.
- `requirements.txt`: added `supabase`, `psycopg[binary]`.
- Verified: image upload round-trip OK (69-byte PNG fetched back identical), Stash POST/GET/DELETE roundtrip via local Flask OK.
- Files: `db/0001_init.sql`, `db/0002_rls.sql`, `db/0003_storage.sql`, `db/README.md`, `image_gen.py`, `content_api.py`, `js/firepit.js`, `requirements.txt`.

## [2026-04-28] two-pillar restructure
- Top-nav reduced from 6 tabs to 3: Home, The Cave, Firepit
- The Cave now contains sub-nav for Dashboard / Foraging / Clan / Footprints
- Firepit remains standalone (will expand into creation + scheduling pillar)
- See `decisions/2026-04-28-two-pillar-restructure.md`
- Files touched: `index.html`, `js/app.js`, `css/style.css`

## [2026-04-28] init | wiki scaffolded
- Adopted wiki-first workflow across workspace
- Seeded `spec/overview.md` from existing memory (`project_soundcave_pivot.md`, `project_soundcave_next.md`) — flagged DRAFT
- Wrote `features/firepit_forge.md` from memory
- Wrote `decisions/0001_pivot_to_content_creation.md` retroactively
- Open: personas, Footprints, image gen decision, full feature catalogue

## [2026-04-28] Stack validated end-to-end (5/5 services)
- Ran `validate_stack.py` against all 5 SaaS services with live API calls
- ✅ Anthropic (Claude Haiku) — text gen working
- ✅ Fal AI (FLUX schnell) — image gen working, returned real image URL
- ✅ Replicate — account `douglaswoolfenden-byte` confirmed
- ✅ Supabase — auth endpoint reachable, 26 providers configured
- ✅ Ayrshare — dev tier active, 20 posts/mo quota confirmed
- Total cost of validation: <£0.05
- Architecture proven real before committing to the build. Cleared to start Streams 1/2/3 per `decisions/0004_parallel_execution.md`
- All API keys rotated mid-session (after they were pasted in chat); only fresh keys are live now
- Validation script deleted (one-shot, not committed)

## [2026-04-28] SaaS architecture approved + parallel execution plan
- Decision 0003 — SaaS stack locked: Supabase (DB+auth+storage), Vercel (FE), Railway (BE), Inngest (jobs), Stripe (billing), Ayrshare (posting), Fal+Replicate (image+video), Claude Haiku (text)
- Three product pillars confirmed: Scout / Create / Distribute
- Pricing model: subscription tiers + credits (Solo £29 / Label £79 / Agency £199 + £10 credit packs)
- Video gen: 3-tier (FFmpeg composite / Fal LTX-Hunyuan / Fal Kling-Veo-Replicate fallback) inside generalised `media_gen.py`
- Decision 0004 — parallel execution: 3 streams across 3 worktrees. Stream 1 backbone (A→B→C→D→G sequential), Stream 2 media engine (E independent), Stream 3 Trail Map UI (F independent)
- Each stream has a copy-paste kick-off prompt + Resume-here checklist so any new terminal can pick up where the last left off
- Deferred: voice profiles, direct platform integrations, PDF/mailto polish

## [2026-04-28] spec lock + feature catalogue
- Doug answered open spec questions: SoundCloud scouting + bulk AI content + multi-platform distribution/scheduling; paid only; hosted SaaS target; hosted web; no alternatives considered for the pivot
- `spec/overview.md` updated and approved (DRAFT removed)
- `decisions/0001` updated with paid-only and "no alternatives — open to pivot" stance
- Added `decisions/0002_architecture.md` (vanilla FE, Flask BE, multi-provider AI, SaaS migration consequences)
- Added feature pages: The Cave, Foraging, Clan, Footprints, Firepit Stash, Firepit Trail Map
- Added persona stubs: Artist, Label, Promoter
- Updated `index.md` with full catalogue
