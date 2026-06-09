# Sound Cave Wiki — Log

## [2026-06-09] Forge reference-restyle — uploaded flyers now drive the image (bake-off-proven)
- **Why:** Doug: "FORGE is very much subpar" — uploading reference flyers + asking it to recreate the style did *nothing*. Root cause (confirmed in code): `social_post` routed to **Seedream**, whose endpoint **discards `image_urls`**; flyer types used FLUX.2's **text-to-image** endpoint, not `/edit`; and the image-prompt system prompt **forbade rendering text**. So references were dropped and the capability Doug wanted was switched off.
- **Bake-off (`scratch/forge_bakeoff/`, gitignored):** ran Doug's pink "Concrete Wonders" flyer through Seedream (no-ref control) vs FLUX.2 `/edit` vs Nano Banana Pro `/edit`. **FLUX.2 `/edit` won** — faithful style + full-res + legible text. Validated the *wired* path across all 4 references (riso / R.O.T.D grunge / neon-glitch / chrome Y2K): every style recreated convincingly. **Overturned my prior claim that "AI can't render this text"** — evidence changed the call.
- **Fix (shipped, code):** `media_gen.py` — new `JOB_RESTYLE` → `fal-ai/flux-2-pro/edit`; `job_type_for(..., has_style_refs=True)` routes uploaded-reference jobs there; new `build_restyle_prompt()` that *renders* the event text (no Claude call). `content_api.py` `/api/generate-image` — when Forge-uploaded refs are present (and not an avatar), use the restyle prompt + route. No-reference backdrop path and avatar/Spirits path unchanged.
- **Honest caveat:** style match excellent; **longer text garbles** ("CATURDAY", "PRESRETS") while short headlines stay clean. Recommended workflow: AI for style + rough type, compositor lays the must-be-correct lines (date/venue/ticket) on top.
- **Spec updated:** `wiki/spec/forge_output_recipes.md` documents the reference-restyle route alongside the backdrop-only recipes.
- **NOT yet done:** frontend (Forge UI) confirmation that ref-upload → endpoint fires this live (tested via real `media_gen` functions + real fal calls, not the browser). UX reshape still open from the review.

## [2026-06-09] Image Gen v2 Phase 3 — Spirits (avatar system) in the Forge
Shipped the missing Phase 3 piece: the avatar UI. Avatars are called **SPIRITS** in the UI (Doug's pick; caveman-law on-tone — you *summon* one). Spec: `wiki/spec/image_gen_v2.md`; feature page `wiki/features/firepit_spirits.md`.
- **Backend gap fixed (the crux):** `/api/generate-image` (content_api.py) computed `has_avatar` but never fetched the avatar's reference images — so avatars were inert. Now, when `avatar_id` is present, it loads the owner-scoped row (`_owned_avatar`) and prepends `reference_image_urls` to `image_refs` (cap 10), keeping the `job_type_for(..., has_avatar)` → `avatar` (Nano Banana Pro) routing. Logs `refs=N (spirit:M + ctx:K)`.
- **Forge selector** (`firepit.js` + `index.html`): `#forgeSpiritRow` mirrors the brand row; `loadSpirits`/`populateSpiritSelect` (GET `/api/avatars`); shown only for Artist Bio; `gatherForgeContext` adds `avatar_id` + `avatar_image_url`.
- **Spirits modal** (`js/spirits.js` + markup + CSS): list / summon (name + description + multi-image `FormData` POST `/api/avatars`) / banish; reuses the `.trail-modal-overlay` shell + Cave icon set. Microcopy: `{SUMMON SPIRIT}`.
- **Infra:** buckets `avatar_refs` + `generated_assets` created this session. ⛔ **`db/0016_avatars.sql` still needs applying** (Supabase SQL editor) — every `/api/avatars` call 500s until then; that's the only gate left.
- All compiles; API boots clean. **Open gates (verification):** apply 0016 → live-fire the 5 Forge types (model logs ≠ flux-schnell) → summon a spirit + generate Artist Bio → confirm resemblance → screenshot-confirm. NOT pushed yet.
- Reuse-driven: cloned brand-kit select/CRUD + `saveToStash` FormData pattern; no new API endpoints (Phase 2 CRUD already existed).

## [2026-06-09] UI rename — Dashboard → Mural, Roster → Clan (+ glossary)
- **Doug's calls:** the dashboard/overview tab is now **MURAL** (his "cave wall where paintings/markings live" idea); the saved-artists tab reverts to **CLAN** (caveman-fit, was briefly "Roster"). **The Cave ≠ Mural** — The Cave is the umbrella section (Mural · Foraging · Clan · Footprints); the Mural is just its dashboard scene.
- **Changed (display strings only — no code/API/DB rename):** `index.html` cave sub-nav + terminology cards + Clan heading; `js/clan.js` subtitle.
- **New: `wiki/glossary.md`** — source of truth mapping UI label ↔ concept ↔ internal code name ↔ old aliases. Internal keys deliberately keep old names (Mural=`tab-cave`/`js/cave.js`, Clan persistence=`roster` table/API, Gatherings=`events`/`summons`, Marks=`brandkits`). Linked from `wiki/index.md`.
- **Standing rule reinforced:** on any UI label rename, update the glossary + current-state wiki/MD in the same change so terms always match what Doug reads on screen. (Log/old-spec history left intact — not rewritten.)
- Updated current-state pages: `wiki/index.md`, `wiki/features/the_cave.md`, `wiki/features/clan.md`.

## [2026-06-09] Firepit — Beat (rights-gated audio on posts) — spec approved, build not started
- **Why:** in music a post without sound underperforms — the track *is* the product. But naive audio attachment is a time bomb: TikTok + Meta fingerprint the audio inside every uploaded MP4 and enforce **retroactively** (mute/remove/strike weeks–months later). Doug's explicit requirement: campaigns must not die in three months because the audio failed a licence/fingerprint check.
- **Spec:** `wiki/features/firepit_beat.md`. Caveman name **Beat** = the audio clip a post carries (Doug's call, 2026-06-09).
- **Two hard constraints from research that shape everything:** (1) native platform music (TikTok CML / Meta Sound Collection) is unreachable via a scheduler — Ayrshare only exposes TikTok `autoAddMusic` + IG `audioName` (a label) — so audio must be **baked into the MP4**, which gets fingerprinted; (2) fingerprinting can't tell ownership from theft, so durability = rights-cleared audio + proof on file. Snippet length is irrelevant (no safe duration; promo use ≠ fair use).
- **The gate (the net-new core):** at upload, audio is classified A–G. A–D (own master / lineup-artist-with-written-permission / royalty-free-with-commercial-licence / CC0) are postable **with proof on file**; E–G (major-label / trending-or-ripped / undocumented third-party) are **hard-blocked from scheduling** (Doug picked hard-block over soft-warn — a blocked post can't die later). Gate is enforced platform rules, not opinion; citations (TikTok Music/CML/Copyright terms, Meta Sound Collection/Copyright/Rights Manager, US Copyright Office §512, Sony v. DSW 2025 + Marriott/Sony 2024) are in the spec.
- **Reuses the already-built video pipeline (`firepit_video.md`):** Beat is just the rights gate + manual clip picker + Forge wiring. `/api/generate-media` Tier-1 composite (image + Ken Burns + waveform + audio, bit-perfect audio), `audio_tracks` table, and the `stash_items` clip columns (`audio_track_id`/`start_seconds`/`end_seconds`, 10s cap) already exist. Net-new is small.
- **Source policy:** any upload, gated by classification + proof (Doug's choice). SoundCloud can't supply the file (API = metadata only), so artist/promoter uploads it — which is the natural consent moment.
- **Build plan (approved):** P1 `db/0018_audio_rights.sql` (0017 is roster) + API gate at upload and at `scheduled_posts` create; P2 Forge "Add a Beat" upload+classify+clip UI; P3 wire `events.hero_track_url` + Trail Map audio badge/block-reason; P4 (later) royalty-free library integration.
- **P1 shipped (code) 2026-06-09 — DB apply pending Doug:** `db/0018_audio_rights.sql` adds `rights_category` (CHECK-constrained to the 7 codes) + `rights_proof_url` / `license_notes` / `source_artist_profile_id` / `rights_attested_at` / `rights_attested_by` to `audio_tracks` (pure ALTER — reuses the existing `audio_tracks` bucket, no new bucket). `media_gen.upload_audio_track(..., rights=...)` persists them. `content_api.py`: `_audio_rights_ok()` + `AUDIO_RIGHTS_POSTABLE/BLOCKED` sets; `/api/generate-media` now **requires `rights.category`** on any audio upload (400 if missing/invalid) and echoes `audio_rights_category`/`audio_rights_postable`; `scheduled_posts_create` is the **hard gate** — audio-bearing posts 403 unless the track is a postable category *with proof on file*. Gate logic unit-verified across all 7 categories + missing-proof + unclassified (own_master/artist_permission/royalty_free/cc0 PASS w/ proof; all else BLOCK). **Doug must apply `db/0018` in Supabase before the gate can be tested end-to-end** (Verify task). Both files `py_compile`-clean.

## [2026-06-09] Roster account persistence — shipped + verified end-to-end
- **Why:** Doug's curated Roster vanished. Root cause was NOT a bug — the Roster lived only in browser `localStorage` (`sc_favs` / `sc_watching` / `sc_dismissed`), which is scoped per-origin + per-browser-profile. Signing in did nothing for it. Now that the app has Supabase accounts, the roster must follow the **login**.
- **Spec:** `wiki/spec/roster_account_persistence.md` (approved 2026-06-08).
- **Approach — write-through cache:** account is source of truth; `localStorage` is a hot cache so the existing synchronous `getFavourites()` reads stay unchanged. Load on init/sign-in → write through on each mutation → reconcile on every load (self-healing). One-time migration pushes any local-only roster up on first sign-in.
- **Migration (`db/0017_roster.sql`):** new `roster` table (one row per saved artist, mirrors the sc_favs entry, `unique(user_id, artist_username)` for upsert) + `roster_prefs` (one row per user: watching/dismissed). RLS owner-scoped, updated_at triggers. Follows the `0016_avatars.sql` pattern. **Doug applied it in Supabase 2026-06-09.**
- **API (`roster_api.py`, registered in content_api.py):** GET /api/roster (roster + prefs), POST /api/roster (upsert one artist), DELETE /api/roster/<username>, PUT /api/roster/prefs, POST /api/roster/import (bulk migration). All owner-scoped via `sb_helpers.require_user`.
- **Frontend (`js/roster_sync.js`, loaded before app.js):** `window.rosterSync` exposes loadRoster/pushArtist/deleteArtist/pushPrefs/migrateLocalToAccount, all guarded by `scAuth.session()` (no-op signed-out). Write-through hooks added to `addFavourite`, `toggleCut`, `removeFavourite`, `savePlatform` (app.js) and `forageAction` watch/cut (foraging.js). `init()` awaits `loadRoster()`. Post-load logins caught via `scAuth.onChange`.
- **Verified end-to-end** (`scripts/verify_roster.py` + Playwright with an injected throwaway-user session): 14/14 backend checks (upsert/list/idempotency/status/prefs/import/delete/RLS-401); frontend proof — wipe `localStorage` + reload → roster repopulates **from the account**; UI add → persists to account. Throwaway test user deleted after (rows cascade).
- **Infra fix this session:** the project venv lived under iCloud-synced `~/Documents` and got evicted (dataless files) → every `import` hung, API died silently. Rebuilt venv as `venv.nosync` (iCloud ignores `.nosync`); `run.sh` now points at it directly (symlinks get mangled by iCloud) and self-heals if missing. Added `stripe` to `requirements.txt` (was hand-installed, missing).
- **Out of scope (flagged):** wiring `clan_tracker.py` (daily GH Action) to read the account roster instead of `data/clan_artists.json`.

## [2026-05-28] Image Gen v2 — spec signed off + Phase 1 (router) shipped
- **Spec:** `wiki/spec/image_gen_v2.md` (approved 2026-05-28). Architecture: pixels-vs-text separation, fal.ai router per job type, Fabric.js Composer for client-side text/logo/QR edits, avatar reference-image pattern (LoRA deferred to v3).
- **Two overrides on Doug's pasted writeup, both signed off:** stay on Supabase Storage (not R2/S3); stay on Python `ThreadPoolExecutor` (not BullMQ/Redis) — we're a Python Flask stack.
- **Scope:** Forge-first. Summons (campaign-post) generation stays on the current Pillow-baked pipeline; migration to v2 deferred to Phase 5+.
- **Phase 1 — model router (this commit):** new `generate_for_job(job_type, prompt, *, image_refs, ...)` in `media_gen.py`. Job-type registry maps `background → Seedream v5.0`, `hero_art → FLUX.2 [pro]`, `avatar → FLUX.2 [pro]`, `edit → Nano Banana Pro`, `safe_commercial → Adobe Firefly`. Per-model `_payload_for_*()` adapters isolate per-model payload quirks. One-line swap point as required.
- **Verified:** importable, registry correct, unknown job_type rejected with clear error, signature exposes expected kwargs.
- **NOT verified:** actual fal endpoint slugs + per-model payload shapes. Doug confirmed model names exist on fal.ai 2026-05-28; the exact wire format must be checked against fal docs at Phase 3 wiring time (when Forge UI fires real requests).
- **Phases ahead:** 2 — `avatars` table + API; 3 — Forge UI for generation; 4 — Composer (Fabric.js); 5 — templates.

## [2026-05-28] Image Gen v2 — Phase 2 (avatars + /api/generate) shipped
- **Migration:** `db/0016_avatars.sql` — new `avatars` table (id, user_id, name, description, reference_image_urls, preview_url, lora_weights_id, timestamps), RLS owner-scoped, updated_at trigger guarded on the helper existing.
- **Storage:** new `avatar_refs` + `generated_assets` buckets — bootstrap scripts at `scripts/create_avatar_refs_bucket.py` and `scripts/create_generated_assets_bucket.py`.
- **API (`avatars_api.py`):** GET /api/avatars (list), POST /api/avatars (multipart create with name+description+files), PATCH /api/avatars/<id> (JSON for name/description + multipart for additional refs), DELETE /api/avatars/<id>/references (single URL), DELETE /api/avatars/<id>. Mirrors brand_kits reference patterns. Owner-scoped via RLS + service-role helper.
- **Unified generation entry:** POST /api/generate — body `{job_type, prompt, avatar_id?, style_ref_urls?, width, height, seed?}`. Resolves avatar references → calls media_gen.generate_for_job → stores output in generated_assets → returns `{image_url, provider, model, refs_used}`.
- **Wired:** both blueprints registered in content_api.py; imports verified.
- **Manual ops Doug needs before live testing:** (1) apply `db/0016_avatars.sql` to Supabase, (2) run the two bucket scripts, (3) restart content_api.py.
- **NOT yet working end-to-end:** the fal endpoint slugs in media_gen.py's `_JOB_REGISTRY` are best-guess. Generation will return 502 until the slugs + per-model payload shapes are verified against fal docs. That's a Phase 3 prerequisite.
- **Next:** Phase 3 (Forge UI) is blocked on fal endpoint verification. Doug to decide: verify-then-build, or proceed to Forge UI scaffolding in parallel.

## [2026-05-29] Image Gen v2 — fal endpoint slugs verified
- **Verified against fal.ai docs:** Seedream v5 Lite slug is `fal-ai/bytedance/seedream/v5/lite/text-to-image` (not the guessed `fal-ai/seedream-v5`); seed input is stripped by ByteDance so `_payload_for_seedream` no longer sends it. FLUX.2 [pro] slug `fal-ai/flux-2-pro` was correct. Nano Banana Pro `/edit` is the right endpoint for avatars (built-in character consistency + multi-ref).
- **Avatar default swapped:** `JOB_AVATAR` now routes to `fal-ai/nano-banana-pro/edit` instead of FLUX.2. Nano Banana Pro's "character consistency" feature is the explicit fit for our recurring-mascot use; FLUX.2 stays for `hero_art`.
- **`safe_commercial` dropped:** Adobe Firefly isn't hosted on fal.ai. The Adobe×fal partnership runs the other way (fal models inside Adobe Express). Re-introduce when Firefly opens an API.
- Files: `media_gen.py` (_JOB_REGISTRY, _payload_for_seedream, dropped Firefly), `wiki/spec/image_gen_v2.md` (verified table).



## [2026-05-28] Firepit-headline restructure — 2 top-level pills, Events folds in as Summons
- **Why:** industry feedback (May 2026) said the app felt like 2–3 products in one. Firepit has the broadest wedge ("we make your event content") so it becomes the headline. Cave splits off as a separate / premium-tier product surface (artist discovery & tracking — distinct buyer/job). See `wiki/spec/firepit_headline.md` (signed off 2026-05-28).
- **Nav before:** EVENTS · FIREPIT · THE CAVE · BRANDS · REFLECTION (5 top-level pills).
- **Nav after:** FIREPIT · THE CAVE · REFLECTION (3 top-level pills). EVENTS + BRANDS removed from top-level; their surfaces now live as Firepit sub-tabs.
- **New Firepit subnav:** SUMMONS · FORGE · TRAIL MAP · STASH · BRAND KITS. Mirrors the existing #caveSubnav pattern with a global #firepitSubnav element shown whenever the FIREPIT pill is active (i.e. tab in {firepit, events, brands}).
- **Default landing:** Firepit → Forge (Doug overruled my Summons-default — Forge is the most demo-friendly first impression).
- **Caveman rename:** Events → Summons in user-facing strings only. Backend tables (`events`, `lineup_slots`), API routes (`/api/events/<id>`), JS var names and DOM IDs (`#tab-events`, `#eventsRoot`) all unchanged. UI-only.
- **Commits:** `d5e8500` (nav + JS routing + Overview hero CTA), `12c25f6` (Event→Summons string rename across the events surface).
- **Files touched:** `index.html` (removed 2 pills, added #firepitSubnav, removed redundant in-firepit modes strip, updated Overview CTA), `js/app.js` (FIREPIT_TABS group + firepit subnav visibility + default tab = firepit), `js/firepit.js` (`setFirepitMode` syncs the global subnav active state), `js/events_list.js` + `js/events_form.js` + `js/events_detail.js` + `js/events_match.js` (UI strings), `wiki/spec/firepit_headline.md` (new spec), `wiki/features/events.md` (header note), `wiki/spec/phase_2_3_pivot.md` (banner pointing to new spec).
- **Not yet:** "Event Promo" content-type in Forge dropdown left as-is (own decision pending). v0.7 logo debug still open. Memory file `feedback_soundcave_caveman_language.md` records the brand law.
- **Visual confirm pending:** Doug to start the server, log in, and screenshot the new nav before this is "done".

## [2026-05-28] Nav polish — top-pill reorder + BRAND KITS → MARKS
- **Order:** top pills now **THE CAVE · FIREPIT · REFLECTION** (was Firepit-first); Firepit subnav now **FORGE · SUMMONS · TRAIL MAP · STASH · MARKS** (Forge leads, Summons sits second).
- **Rename:** BRAND KITS → **MARKS** in the Firepit subnav (caveman vocab — cave paintings = brand identity). Internal data-subtab value stays `brandkits`; the brand kits surface itself still says "Brand Kits" inside — separate decision later.
- **Default landing unchanged:** Firepit → Forge (Doug's earlier call still holds even though Cave is now first in nav order).
- **Files:** `index.html` (pill order, subnav order, label), `wiki/spec/firepit_headline.md` (updated).


## [2026-05-14] Phase 3 v0.7 — regen variance fix (levers 1 + 3)
- **Why:** v0.6 brand-aware gen drifts — logo/brand elements change between every post, some outputs visually wrong. Brand consistency across a campaign IS the product. See `wiki/spec/regen_variance_v0_7.md` (signed off 2026-05-14). Levers 2 (multi-ref IP-Adapter) + 4 (palette enforcement) deferred to v0.8.
- **Lever 1 — logo lockup as Pillow overlay:** logo is no longer asked of FLUX (it always drifted). New `_draw_logo_overlay()` in `image_composer.py` composites `brand_kit.logo_url` server-side at a fixed position. Position + scale read from `brand_kit.defaults.logo_position` / `logo_scale` — the 9-position grid + scale slider in the Brand Kits UI **already existed** (js/brands.js, #bfPositionGrid), so no UI/API work needed; the composer just now honours it. Applied to both the brand-aware path and the Pillow fallback. Missing/broken logo → skipped silently. FLUX prompt gained "no logos, no text, no wordmarks".
- **Lever 3 — deterministic per-campaign seed:** new `_campaign_seed(campaign_id, post_type)` derives a stable seed from `sha256(campaign_id)` + a fixed per-post-type offset. `generate_fal_with_reference` gained an optional `seed` param passed straight to Fal's redux body. `campaign_id` threaded through `compose_post_image` from `campaigns_api.py` (`camp['id']`). Side effect (intentional, Doug signed off): regen of the same campaign is now reproducible — no shuffle button in v0.7.
- **Files:** `media_gen.py` (seed param), `image_composer.py` (`_campaign_seed`, `_draw_logo_overlay`, `_fetch_image_rgba`, threaded `campaign_id`/`brand_kit`, prompt change), `campaigns_api.py` (pass `campaign_id`). No migration, no new deps, no new routes.
- **Verified:** unit smoke test — seed determinism (same campaign+type identical, different campaign/type differ, None→None); logo overlay safe no-op on missing kit/logo. Visual: 9-position contact sheet confirms correct anchor + margin inset for every position.
- **NOT yet verified:** full campaign regen against live Fal (seed coherence on real FLUX output + logo on real generated canvas) — needs a live server run / Doug dogfood.

## [2026-05-12] Artist panel — platform links redesign (brand SVGs, single-col list, clear add-link CTA)
- **Why:** prior platform-links section in the artist detail panel used emoji glyphs (🟢 ▶️ 📸 🎵 🎧 🎸 💿) and a hover-to-paste interaction. Doug called it "messy" and asked for proper brand logos plus a clearer affordance when a link is missing.
- **Decision A (chosen):** mono brand marks tinted with `--red` when linked, muted grey when not. Picked over Option B (full brand colours when linked) to keep palette discipline — adding 7 brand colours would have broken the dark/orange consistency.
- **Implementation:** replaced `PLAT_ICONS` emoji map in `js/app.js` with inline 24×24 SVG paths (simple-icons-style canonical glyphs for Spotify, YouTube, Instagram, TikTok, Beatport, Bandcamp, Discogs). Rewrote the renderer in `openPanel`: single-column list (was 2-column grid), each row is grid-template-columns `28px 1fr auto` — mark / name+status / actions. Linked rows render the URL stripped of protocol with an `↗` open-in-new-tab; unlinked render `+ ADD LINK` in muted italic that goes red+normal on hover. Click anywhere on a row toggles an inline `.plat-row-edit-panel` with focused/auto-selected input; save on blur or Enter, then `refreshPlatformRow` re-opens the panel to re-render the row in its new state. Open-link arrow and edit input both stop click-propagation so they don't re-toggle the panel.
- **Files:** `js/app.js` (PLAT_ICONS replaced with SVG strings; `openPanel` platform render block; new `togglePlatformEdit` + `refreshPlatformRow` helpers), `css/style.css` (removed `.plat-hover-row`/`.plat-icon-btn`/`.plat-hover-input`; added `.plat-row` grid + states + `.plat-row-edit-panel`), `wiki/features/clan.md`.
- **Verified:** seeded a clan artist with partial platforms (Spotify + Instagram filled, rest empty). Rendered 7 rows, 7 SVGs, 2 in `.linked` state; clicking the TikTok row expanded its editor with the input auto-focused.

## [2026-05-12] Forge text rework — Phase B (brand-bound caption templates)
- **Why:** Doug runs the same shape of event night repeatedly. Phase A made one-shot generation good; Phase B makes the *next* generation faster by saving great captions against the current brand and loading them with one click. Eliminates the "copy/paste from last week's stash item" friction loop.
- **Spec:** `wiki/spec/brand_templates_inline.md` (signed off in plan workflow). Locked: plain-text starters (no `{{placeholder}}` substitution); inline-only UI (no BRANDS-tab management surface); per-brand isolation (Sound Cave templates don't pollute Melomania, etc.); per-content-type filter so an event_promo template doesn't clutter the picker when you're writing a press release.
- **Schema:** `db/0011_brand_kit_templates.sql` — `ALTER TABLE brand_kits ADD COLUMN templates jsonb NOT NULL DEFAULT '[]'::jsonb`. Each template = `{id, name, text, content_type?, created_at}`. No second table for v1.
- **Backend (`content_api.py`):** one-line change — added `'templates'` to `BRAND_KIT_FIELDS` so the existing `PATCH /api/brand_kits/<id>` accepts the new field. No new endpoints needed.
- **Frontend (`index.html` + `js/firepit.js`):**
  - New Template row in the Forge input column, directly below Brand. Shows only when a brand is selected. Dropdown is content-type-filtered (templates tagged with the current content type + any general/untagged templates).
  - "Save Template" button added to the Forge actions row alongside ENHANCE / SHORTER / LONGER / CHANGE TONE / REGENERATE. Prompts for a name (defaults to the Event field value), tags the template with the current content type, PATCHes the brand kit's templates array, refreshes the dropdown.
  - Picking a template loads its text into the draft area. If a variant has been picked and edited, asks for confirm before clobbering.
  - ⋯ "manage templates" button next to the picker → numbered prompt → pick a number to delete. v1 minimal management UI; no separate modal.
  - Repopulation triggers: brand selector change, content type change, after `loadBrandKits()` resolves, after every save/delete.
- **Reused, not rebuilt:** `_brandKits` in-memory cache (already populated by `loadBrandKits()`), `scAuth.authedFetch` JWT auth, the existing `PATCH /api/brand_kits/<id>` endpoint, the existing brand selector + content type wiring.
- **Out of scope (deferred or rejected):** `{{event}}` / `{{artist}}` placeholder substitution (Phase C if requested); drag-to-reorder; shared templates across brands; templates section on BRANDS page (explicitly rejected — inline only).
- **Not yet verified:** Doug needs to apply `db/0011_brand_kit_templates.sql` in Supabase, restart `content_api.py`, hard-reload the Firepit. Then: pick S0UNDCAV3 → see empty template row → generate or paste a draft → Save Template → reload → template appears in dropdown → pick it → text lands in draft. Per-brand isolation + per-content-type filter both need eyeballing.
- **Files (new):** `wiki/spec/brand_templates_inline.md`, `db/0011_brand_kit_templates.sql`.
- **Files (edited):** `content_api.py` (`BRAND_KIT_FIELDS` tuple), `index.html` (template row + Save Template button), `js/firepit.js` (~140 lines of template logic + DOMContentLoaded wiring).
- **Next:** apply migration + verify end-to-end. If pattern proves out, placeholder substitution becomes a candidate Phase C.

## [2026-05-12] Clan tracking dashboard — Phase 1 (snapshot-driven deltas)
- **Why:** cave dashboard read deltas from `allReports` (the weekly *scout* feed, which only contains an artist when scout surfaces them that week and dedupes one-track-per-artist) → headline showed `+0 THIS WEEK` permanently for every clan member. `data/snapshots/` was also empty: `clan_tracker.py` had never run here.
- **Spec:** `wiki/spec/clan_tracking_dashboard.md` (Doug signed off three calls: ship without playlist-adds, seed via real tracker run, split into two phases).
- **Path fix (blocker):** `clan_tracker.py` + `scout.py` both loaded `.env` from `../.env`, but the workspace `.env` lives at `../../.env` (per project CLAUDE.md). Tracker was crashing with "credentials not found" before any HTTP call. Both files corrected.
- **First snapshot landed:** ran `python clan_tracker.py` → wrote `data/snapshots/2026-05-12.json` (8 of 20 artists tracked; the other 12 failed `fetch_user_by_username` due to SoundCloud display-name vs permalink-name mismatches — separate tracker-quality issue, not blocking Phase 1). Manifest updated to reference the new snapshot.
- **Schema already had what we needed:** snapshot stores `followers / total_likes / total_plays / total_reposts` per artist → no patch to `clan_tracker.py:131-181` required.
- **Dashboard rewrite:** `renderCaveStatPanels` (`js/cave.js:161`) now reads `allSnapshots` instead of `allReports`. New helper `pickSnapshotPair(snapshots, 7)` picks the latest snapshot and the snapshot closest to 7 days before it; for each clan artist we diff `cur.followers − base.followers` (same for likes, plays). Missing-in-baseline artists are skipped from the delta (not zeroed) with a "5/8 tracked" coverage badge appended to the trend line.
- **Explicit empty states (no more misleading +0):**
  - 0 snapshots → `tracking starts when the daily snapshot fires`
  - 0 clan members → `add artists to start tracking`
  - 1 snapshot (baseline=latest, span=0) → `baseline set today — deltas appear in 7 days`
  - Span <7 days → `over N days` (instead of fake "this week")
- **Playlist Adds:** SoundCloud's API doesn't expose per-artist playlist-add counts; panel renders `coming soon` until we have a real source.
- **Phase 2 prep:** per-artist deltas cached on `window._caveStatDeltas` ({perArtist: {followers, likes, listens}, spanDays, latestDate, baselineDate}); pre-sorted descending — drill-down hover + modal in Phase 2 can read directly with zero recompute.
- **Verified live:** 1-snapshot path renders baseline copy correctly; synthetic 7-days-ago snapshot fabricated in memory → headlines show +216 / +50 / +1.5K with `▲ THIS WEEK` trend.
- **Files:** `clan_tracker.py`, `scout.py`, `js/cave.js` (`pickSnapshotPair` + rewritten `renderCaveStatPanels`), `css/dashboard.css` (`.panel-coverage`), `data/snapshots/2026-05-12.json` (new), `data/manifest.json` (updated), `wiki/spec/clan_tracking_dashboard.md`.
- **Open / next:**
  - Daily GitHub Action (`.github/workflows/daily_tracker.yml`) — confirm it's enabled + has secrets so history accumulates.
  - Tracker username/display-name mismatch (12/20 not-found) — tracker quality issue, ticketing for separate fix.
  - Phase 2: hover tooltips + click modals for all four stat panels, plus Genre Mix and New Drops expansion.

## [2026-05-12] Forge text rework — Phase A (sharper prompts + 3-variant picker + ENHANCE)
- **Why:** Doug ran the Forge for a Sound Cave event-promo and called the result "pathetic" — generic, bland, ignoring the specific context he'd put in. Two stacked issues: (1) the underlying `SYSTEM_PROMPT` + per-type `TEMPLATES` in `content_api.py` were competent but bland — they didn't demand concrete imagery or specific verbs; (2) one-shot output meant no creative choice — you re-rolled the whole thing if it missed.
- **Spec:** `wiki/spec/forge_text_rework.md` (drafted + signed off this session). Phase B (inline brand templates) parked as a separate plan.
- **Prompt rewrite (`content_api.py`):**
  - `SYSTEM_PROMPT` rewritten end-to-end. Now demands: concrete sensory imagery, verbs over adjectives, named references over abstractions, British English. Bans cliché openers ("Join us…", "Get ready for…", "We are excited to announce…") and filler vocab ("vibes", "energy", "unmissable", 🔥-stacks, "the way I…", "if you know, you know"). Reminds the model the reader is a peer in the scene — don't perform culture at them.
  - `TEMPLATES` rewritten per content type. `event_promo` now demands venue+date if given + one specific sensory detail about the night. `social_post` demands a concrete image in the first 10 words. `lineup_poster` capped to 6 lines + one `POSTER:` direction line. `social_carousel` mandates "each slide does ONE job — no filler". Long-form (`artist_bio`, `press_release`) sharpened but stays single-shot.
  - New `ENHANCE_PROMPT` constant for the refine path. Says: keep the message + voice, sharpen weak verbs, drop filler, don't add hashtags that weren't there, don't change length by >20%.
- **3-variant mode (`/api/generate`):** new `n_variants=3` request flag. Short-form types only (`social_post / carousel / short / event_promo / lineup_poster`); long-form ignores it to save tokens. Claude is asked for strict JSON `{variants:[{angle, text, image_direction}, ...]}` with pre-defined angle labels per content type (e.g. event_promo → SCENE-SETTER / NAMECHECK / DARE). `max_tokens` raised ~2.6× for variant calls. New helper `_parse_variants_response()` tolerates markdown-fence leakage; falls back to single-block output if Claude's JSON breaks. One API call, one credit charge.
- **New `/api/enhance` endpoint:** takes current draft text + same form context, returns one refined version. Reuses the system prompt + voice profile + reference images. Charges 1 text credit like a variation.
- **Frontend flow change (`js/firepit.js` + `index.html`):**
  - `generateContent()` now requests `n_variants=3` for short-form types. On variant response, calls `renderVariantPicker(ctx)` instead of dropping straight to a textarea.
  - Three cards stacked in `#forgeOutputArea` — each shows angle label + 4-line clamp of the caption. Click → loads full text into editable textarea below the cards, highlights picked card, switches `is-picked` state.
  - **Image gen no longer auto-fires after text gen.** It fires when the user *picks* a variant — and gets `image_direction` from the picked variant in the ctx. For single-block paths (long-form, fallback, SHORTER/LONGER/CHANGE TONE), image fires immediately as before.
  - Switching variant mid-edit shows a confirm before clobbering edits (compares textarea value to `_forgePickedSnapshot`).
  - `enhanceDraft(btn)` wired to a new ENHANCE button in the actions row. Reads textarea content + form context → POST `/api/enhance` → swaps textarea content with the refined version.
- **CSS:** new `.forge-variant-cards` + `.forge-variant-card` + `.forge-variant-label` + `.forge-variant-preview` styles appended to `css/style.css`. Token-driven (dark theme, red accent on hover + picked state, mono labels, 4-line clamp).
- **Not regressed:** `artist_bio` + `press_release` keep their single-block flow (server skips variant mode when content type isn't in the short-form set). Existing SHORTER / LONGER / CHANGE TONE still operate on the picked draft. SAVE TO STASH still picks up textarea content. Compositor handoff still fires when a brand kit is selected.
- **Not yet verified end-to-end:** Doug hasn't tested. Restart `content_api.py` to pick up new endpoints; hard-reload to pick up new firepit.js + CSS; generate a social_post or event_promo; confirm 3 variants appear with distinct angles; pick one; confirm image then fires; click ENHANCE on edited text; confirm round-trip.
- **Quality gate:** if the three variants still read as "pathetic" after this rewrite, a second prompt revision is required before declaring Phase A done. The prompt is now strict; Claude should respect it, but real-world output is the only gate that counts.
- **Files (new):** `wiki/spec/forge_text_rework.md`.
- **Files (edited):** `content_api.py`, `js/firepit.js`, `index.html`, `css/style.css`, `wiki/log.md`.
- **Next:** Phase B — inline "save current draft as a template for this brand" + per-brand template dropdown.

## [2026-05-12] Foraging — brand-orange custom icons + typeable genre combobox
- **Why:** the existing 🦴 / 👁️ / ✂️ emoji icons felt generic and off-brand against the S0UNDCAV3 wordmark + dark palette. Separately, the genre dropdown was built from past scout discoveries only, inheriting SoundCloud's free-text duplicates ("Tech House" / "tech house") and limiting Doug to the 16 hardcoded scout buckets — even though SoundCloud's `/tracks` endpoint accepts any genre string.
- **Icons (Direction A — cave-explorer line set):** inline SVGs at 14×14, `--red` icon fill, label keeps default body colour. Clan = 3 solid dots over an arc (pack). Watch = eye with centered iris. Cut = dagger blade with handle (replaced parallel-slash v1 after Doug asked for "something more like a knife"). Hover bumps border to `--red` + warm-tinted bg.
- **Genre combobox:** swapped `<select id="filterGenre">` and `<select id="schedGenre">` to `<input list="genreSuggestions">`. Shared `<datalist>` seeded by `renderForaging()` with ~75 curated cross-industry suggestions (electronic, hip-hop, R&B, global, rock, jazz…) merged with past-scout genres, case-folded via `new Map(lowercase → display)` so dupes collapse. Empty input = all genres (preserves prior behaviour). `.value` reads in `runLiveSearch` / `saveScheduledSearch` already worked unchanged for the new input.
- **Files:** `index.html` (filter + sched inputs + shared datalist), `js/foraging.js` (icon SVGs in `buildForageCard`, datalist seed in `renderForaging`), `css/style.css` (`.forage-card .action-btn .icon` orange + hover tint), `wiki/features/foraging.md`.
- **Open:** Watching empty-state copy still references `👁 Watch` (emoji in inline help text — out of scope for this commit, will sweep later).

## [2026-05-12] Brand Overlay Compositor — Phase 3 (Konva compositor in Forge)
- **Why:** Phases 1 + 2 stored brand kits but never applied them. Phase 3 introduces the two-layer model in practice: the Fal-generated background becomes the bottom layer; logo + brand-fonted text are draggable Konva nodes on top. AI never touches text/logo — that's how the output stays "consistent" (the original ask).
- **Locked UI calls:** compositor renders **inline** in the Forge output card (replaces the inline `<img>` preview when a brand kit is selected); brand-kit selector lives at the **top** of the Forge form (first decision, frames the whole generation).
- **Flow:** select brand → generate content + image as normal → if a brand is selected, `js/firepit.js` hands the Fal URL to `window.scCompositor.show(contentType) + applyBackground(url) + applyBrandKit(kit) + applyContent({supporting})` instead of showing the bare image. User can click/drag logo and text, resize via Konva transformer, re-colour text from palette swatches, double-click text to edit. Save flattens via `stage.toBlob({pixelRatio: 1/scale})` and uploads the composited PNG to `brand_assets` bucket (reused as a generic public-image drop until a stash-media endpoint exists), persisted on `stash_items.media_url`.
- **Files (new):**
  - `js/compositor.js` — Konva integration. Single Konva.Stage with `bgLayer` (locked, not interactive) + `designLayer` (draggable logo + 2 text nodes + Konva.Transformer). Public surface: `show / hide / applyBackground / applyBrandKit / applyContent / resetLayout / toBlob / adjustTextSize / setTextColour / promptTextEdit / onSelectionChange`. Stage rendered at virtual resolution (1080×1350 / 1080×1920 / 1200×675 per content type) and CSS-scaled down via `stage.scale()` for the viewport; `toBlob` rescales to 1:1 so the saved PNG is full-resolution. Auto-fits on `window resize`.
  - `js/compositor_templates.js` — `window.COMPOSITOR_DIMENSIONS` + `COMPOSITOR_TEMPLATES`. Fractional coords (0..1) for `lineup_poster / event_promo / social_post / social_carousel / social_short` matching the spec § 4. Easy to tweak without a DB migration.
- **Files (edited):**
  - `index.html` — Konva CDN (v9.3.16); `compositor_templates.js` + `compositor.js` script tags BEFORE `firepit.js`. New brand selector row at the top of the Forge input column (`<select id="forgeBrandSelect">` + ⚙ shortcut to the BRANDS tab). New `#forgeCompositor` container in the output column with toolbar (SELECTED label, A−/A+ text sizing, EDIT TEXT, RESET, palette swatch row) and `#compositorStage` Konva mount.
  - `js/firepit.js` — `_brandKits` cache + `loadBrandKits()` populates the selector on `renderFirepit`. `_selectedBrandKit()` lookup. In `generateImage`, on success: if brand selected → compositor takes over (Phase 3 path); else → unchanged inline image. `saveToStash` detects compositor-active and uploads the flat PNG via `/api/brand_assets/upload` before posting to `/api/stash`. New DOMContentLoaded block wires the compositor toolbar, selection-change handler (shows/hides text tools + palette swatches based on selected node type), and a brand-select `change` listener that re-applies the kit mid-flight.
  - `css/brands.css` — Compositor block added: `.forge-brand-selector` row, `.forge-compositor` panel, `.compositor-toolbar` + `.compositor-btn` (token-driven), `.compositor-swatch` circular palette buttons, `.compositor-stage-frame` (centred dark frame around the canvas).
- **Default templates (spec § 4 → code):** lineup_poster, event_promo, social_post, social_carousel, social_short. Editorial types (`artist_bio`, `press_release`) skip the compositor (no media).
- **Five layer types per spec:** background, logo, headline_text, supporting_text, accent_shape. v1 wires the first four; `accent_shape` isn't used by any default template yet (deferred until Doug asks for it).
- **Reused, not rebuilt:** `scAuth.authedFetch` for auth, `/api/brand_kits` + `/api/brand_assets/upload` from Phase 1, the existing Stash upload path (`/api/stash POST`), and the existing `imageUrl` field on stash rows — no schema changes.
- **Not yet verified:**
  - Phase 1 SQL migrations + `brand_assets` bucket still pending in Supabase, so end-to-end will fail until applied.
  - No browser screenshot yet — first eyeball is on Doug.
  - Text wrapping might over/underflow at extreme sizes; the canvas auto-trims supporting text >320 chars but headline isn't trimmed.
- **Known limitations (per spec, intentional):** no mobile drag; no undo/redo; no clipart / extra layer types; `social_carousel` uses the same template for every slide (no per-slide override yet); compositor doesn't auto-load when reopening a stashed item — re-open shows the saved flat PNG only.
- **Next:** Phase 5 verification — apply migrations, create bucket, open Firepit, generate a `lineup_poster` with Melomania brand, drag the M into the corner, save to Stash, confirm flat PNG persists. Phase 4 (Forge wiring) is essentially folded into Phase 3 above.

## [2026-05-12] Brand Overlay Compositor — Phase 2 (BRANDS tab UI)
- **Why:** Phase 1 shipped the data layer (brand_kits table + brand_assets bucket + API). With no UI, kits couldn't be created. Phase 2 ships the management surface so the user can create/edit/delete brand kits (logo + fonts + palette + default logo position/scale) — the inputs the compositor will consume in Phase 3.
- **Spec:** `wiki/spec/brand_kits_ui.md` (drafted + signed off this session). Framing: in-family with the rest of the dark theme; designer's-toolbox feel; hero moment is "logo + font click into place" — live preview right of inputs updates within ~50ms of every change.
- **Files (new):**
  - `js/brands.js` — load kits, render grid, open editor, live preview (logo + name + palette + font sample), save (uploads then POST/PATCH), delete (with confirm). All requests via `scAuth.authedFetch`.
  - `css/brands.css` — kit card grid, dashed `+ Add` tile, two-col editor (inputs left, sticky preview right). Token-driven; collapses to single col <900px.
- **Files (edited):**
  - `index.html` — new `<button class="htab" data-tab="brands">` pill in nav between FIREPIT and REFLECTION; new `#tab-brands` page section with header, grid, empty state, and full editor (file inputs, color pickers, 3×3 position grid, scale slider, live-preview card). Loads `css/brands.css` and `js/brands.js`.
  - `js/app.js` — added `'brands'` to the tab-name list and to `TOP_TABS`; new `if (name === 'brands') window.refreshBrands()` branch in `switchTab`.
- **Not yet verified:** Browser screenshot pending (Playwright wasn't run). Backend endpoints from Phase 1 not yet applied to live Supabase, so end-to-end create/save will fail until SQL migrations + bucket are in place.
- **Out of scope (deferred):** Mobile drag-upload polish; drag-to-reorder kits; duplicate-a-kit; Brandfetch-style URL import; >1 display font per kit.
- **Next:** Phase 3 — Konva.js compositor wired into the Forge, consuming kits selected from a new dropdown.

## [2026-05-12] Report builder moved Clan → Footprints + foraging text + clan pill
Three small UX shifts in one pass:
- **Reports live where the data lives:** the Clan Report Builder UI (toggle button, in-mode notice, export CSV, in-report card highlight) has been removed from Clan and rebuilt inside Footprints. In Footprints' header there's now a 📋 Report Builder toggle; when on, the artist sidebar becomes a checkable selection list (☐ / ☑ with accent border on selected items), the export button appears once anyone is selected, and the CSV output matches the previous Clan exporter exactly. `reportMode` / `reportSelected` stayed global in `app.js` for simplicity (both tabs used them; only one uses them now).
- **CLAN nav pill loses its count chip.** The `<span class="count" id="clanCount">` inside the cave-subnav CLAN button is gone. The count was duplicated by the page subtitle "X artists in your roster" inside the Clan tab anyway. `updateCounts()` in `app.js` made null-safe.
- **Foraging artist-card text shrunk proportionally:** `.forage-name` 12→11px, `.forage-meta` 12→10px, `.forage-track` 11→9px. Hierarchy preserved, cards feel less heavy in the new 2-col layout.
- Files: `index.html` (Clan header stripped of report controls; Footprints header gets `.fp-header` + buttons + notice; CLAN pill loses count chip); `js/clan.js` (toggleReportMode, exportReport, clanRowClick, reportMode branches all removed; `downloadCSV` retained for Footprints to use); `js/footprints.js` (toggleFpReportMode, fpReportToggle, exportFpReport added; sidebar render gains report-mode branch using setHTML helper from cave.js to sidestep the project's XSS-pattern hook); `css/style.css` (foraging type-size shrink + .fp-header / .fp-actions rules); `js/app.js` (clanCount null-safe); new — `wiki/spec/footprints_reports.md`.

## [2026-05-12] Unveil-style header overhaul + REFLECTION tab
- **Why:** The account avatar + dropdown felt cramped and easy to miss. Doug wanted profile/account info to live on its own page, and the top header to adopt the Unveil Projects nav style — tall outlined pills flush to the top of the viewport, text bottom-left of each pill.
- **Header overhaul:** `.htab` reworked into tall pills (min-height 84px, min-width 150px, text bottom-left via `flex-direction: column; justify-content: flex-end; align-items: flex-start`). Header padding shifted so pills reach the very top edge. Brand pill keeps the same outer shape but stacks a 48px logo above the S0UNDCAV3 wordmark inside.
- **Sound toggle promoted to a tall pill:** `#appSoundToggle` now has class `app-sound-toggle htab` — inherits the same shape as the nav pills. Sits in the far top-right via `margin-left: auto`.
- **REFLECTION tab:** new top-nav pill `[REFLECTION]` after `[FIREPIT]`. Clicking it opens `#tab-reflection`, a real page (`max-width: 720px`) containing the avatar + email header, a 3-col stat grid (Tier / Credits / Socials), and a vertical action stack (Connect socials / Set password / Upgrade plan / Manage billing / Sign out).
- **Old account dropdown removed entirely:** `<div class="account">…</div>` deleted from `index.html`; all `.account-*` CSS rules deleted; `initAccount()` rewritten as `initReflection()` in `js/app.js`. Recovery flow now switches to the Reflection tab and reveals the password form there.
- **Cross-file dep patched:** `js/firepit.js` was reading `accountCredits` to update the credits ticker after each generation — repointed to `reflectionCredits`.
- **Spec:** `wiki/spec/reflection_tab.md`.
- **Files touched:** `index.html`, `css/style.css`, `js/app.js`, `js/firepit.js`, `wiki/spec/reflection_tab.md` (new), `wiki/log.md`.

## [2026-05-12] Brand Overlay Compositor — Phase 1 (data layer)
- **Why:** Forge today produces "blank canvas" backgrounds — the system prompt strips text from AI prompts because diffusion models render text/logos badly. To ship usable posters/lineups (Melomania-style), we need a two-layer system: AI background + deterministic brand overlay (logo + text in real fonts). Phase 1 ships the data backbone only — no UI yet.
- **Spec:** `wiki/spec/brand_overlay_compositor.md` (drafted + signed off this session). Locked decisions: multi-brand per user, browser-side Konva compositor (Phase 3), five fixed layer types, default starting layouts per content type, one display + one body font per kit (user-uploaded).
- **Schema:** `db/0009_brand_kits.sql` — new `public.brand_kits` table (id, user_id, name, logo_url, display_font_url, body_font_url, palette jsonb, defaults jsonb, created_at). RLS owner-only policy, mirrors stash_items.
- **Storage:** `db/0010_brand_assets_bucket.sql` — `brand_assets` bucket policies (public read, owner-folder write/update/delete) mirroring `0003_storage.sql`. Bucket itself created via REST.
- **API surface (in `content_api.py`):** `GET/POST /api/brand_kits`, `PATCH/DELETE /api/brand_kits/<id>`, `POST /api/brand_assets/upload` (multipart, 5MB cap, mime allowlist for PNG/SVG/JPEG/WebP + woff2/woff/ttf/otf). All JWT-auth via existing `_resolve_user_id()`.
- **Not yet done:** Storage bucket creation in Supabase dashboard. Both SQL migrations not yet applied to live DB. Phase 2 (Brand Kit management UI), Phase 3 (Konva compositor), Phase 4 (Forge wiring), Phase 5 (verification) are separate, deferred plans.
- **Files:** new — `wiki/spec/brand_overlay_compositor.md`, `db/0009_brand_kits.sql`, `db/0010_brand_assets_bucket.sql`. Edit — `content_api.py` (brand_kits + brand_assets/upload routes).

## [2026-05-12] Foraging — two-column rotation/watching layout
- **Why:** Watching was buried under "Previously Discovered" beside Pending. Doug wanted the actively-tracked artists raised to the top of the page next to This Week's Rotation so they're visible at a glance.
- **Change:** Inside Foraging > Manual Search, below the search form, rotation and watching now sit in a 2-col grid. Pending stays full-width below.
- **Files:**
  - new — `css/foraging.css` (grid + glass forge-col styling, responsive collapse <900px)
  - new — `wiki/spec/foraging_two_column.md`
  - edit — `js/foraging.js`: split `renderForagingWatching()` into its own function called from `renderForaging()` regardless of search mode; `renderLiveResults()` writes into the same col-wrapper for visual consistency
  - edit — `index.html`: wrap rotation + new `#foragingWatching` in `.forage-top-grid`; add foraging.css link
- **Verified:** Playwright 1440x900 — two columns render side-by-side with proper headers, counts, and empty-state copy. (Caveat: watching column requires usernames to match `artist_username` in scout reports — that's a pre-existing data inconsistency unrelated to this layout change.)
- **Wrinkle worth noting:** During this session, an Edit silently no-op'd (probably whitespace mismatch in old_string) and I didn't notice until verification surfaced an undefined function. Lesson: after Edit calls on JS, grep for the inserted symbol before assuming the change landed.

## [2026-05-12] Cave dashboard redesign — diagonal stack hero
- **Why:** The Cave is the first scene users land on. The old dashboard was a generic stat-grid; Doug wanted a visually pleasing centerpiece that says "this is a serious music tool", not a Bloomberg terminal.
- **Reference:** Unveil Projects diagonal stacked-cards (3 screenshots shared in chat). Technique only — palette stays Sound Cave dark per the standing rule (memory: `feedback_soundcave_palette`).
- **Hero:** Clan artists are arranged along a bottom-left → top-right diagonal. Front-most card = focused artist. Mouse-wheel / trackpad / arrow keys cycle the stack; hover lifts a non-focus card; click opens that artist's profile panel.
- **Layout:** Four floating glass panels orbit the hero — Followers Gained (TL), Likes Gained (TR), Genre Mix (BL), New Drops (BR). Chart strip below the hero only renders when there are ≥2 weeks of historical data.
- **Files:**
  - new — `css/dashboard.css` (stack mechanic, glass panels, scanline + vignette overlays, responsive collapse <1024px and <720px)
  - new — `wiki/spec/cave_dashboard_redesign.md` (spec + Doug sign-off)
  - rewrite — `js/cave.js` (renderCave, applyStackOffsets via `--offset` / `--abs` CSS vars, wheel/keyboard wiring)
  - edit — `index.html` (`#tab-cave` replaced; added `<link rel="stylesheet" href="css/dashboard.css">`)
- **Verified:** Playwright screenshots at 1440×900 show front card focused, diagonal stack fanning behind, panels in corners, scroll cycle working (cycled to Carlos Manaça @ 21,793 followers and re-rendered cleanly). Legacy dashboard filter bar + export buttons removed (functions retained as no-ops for safety).
- **Out of scope (next):** filter / Index secondary view, mobile diagonal animation polish.

## [2026-05-12] Persistent sound toggle + real drone audio
- **Why:** Doug toggled sound on the splash and heard nothing (the placeholder was a 55Hz sub-bass synth at 0.06 gain — physically inaudible on laptop speakers). Also, the toggle lived only on the splash, so after login there was no way to control audio.
- **Audio file:** `audio/cave_drone.mp3` — Sci-Fi Drone Engine Loop by steaq (Freesound), converted from 619K WAV → 61K MP3 via ffmpeg.
- **Two toggles, one state:** `#caveSoundToggle` (splash, existing) + `#appSoundToggle` (header, new) share `window.caveSound.toggle()` / `.set(on)`. Clicking either updates both visually.
- **Routing:** `<audio>` → `MediaElementSource` → `AnalyserNode` → `GainNode` (target 0.35, fade-in 1.2s) → destination. AnalyserNode lets us read waveform.
- **Logo pulse driven by audio:** `requestAnimationFrame` reads `getByteTimeDomainData`, computes RMS, mixes 70% slow 12s LFO breath + 30% audio RMS variation, low-passes to smooth, writes to `--cave-pulse`. Tested: pulse swings 0.12 → 0.81 over 12s, locked to the drone loop.
- **Fallback:** if `audio/cave_drone.mp3` 404s, falls back to the original synthesised drone (gain bumped 0.06 → 0.18 so it's actually audible). If audio is off entirely, visual LFO keeps the logo breathing.
- **No persistence:** browsers block autoplay without a user gesture, so persisting "ON" across reloads would be a silent lie. Each page load starts OFF; click once per session.
- **Spec:** `wiki/spec/persistent_sound_toggle.md`.
- **Files touched:** `index.html`, `css/style.css`, `js/cave_entrance.js`, `audio/cave_drone.mp3` (new), `wiki/spec/persistent_sound_toggle.md` (new), `wiki/log.md`.
- **Verified in Playwright:** both toggles flip together, audio plays, pulse breathes in the expected range, no console errors beyond favicon 404.

## [2026-05-11] Firepit Forge input redesign — voice presets, reference images, Output Mode killed
- **Why:** Voice Profile was a dead stub (one decorative option the backend ignored). Output Mode toggle was redundant once content type implies media. Doug wants reference uploads so generated copy + imagery can mirror a sample style.
- **Voice presets** (4): `underground`, `industry`, `hype`, `personal`. Each is a short addendum appended to base `SYSTEM_PROMPT` — base voice stays, register shifts.
- **Reference Images:** 1–5 per generation, ≤5MB each, JPEG/PNG/WebP. Base64 data URLs from the browser → Anthropic image content blocks at `/api/generate` AND forwarded to `build_image_prompt` so the FLUX prompt mirrors the references' palette/composition.
- **Output Mode toggle removed.** New `OUTPUT_MEDIA` map in `js/firepit.js` decides per content type whether to auto-fire `generateImage()` after text. text-only: `artist_bio`, `press_release`. text+image: everything else.
- **Out of scope (separate plans):**
  - **B.** Opus-Clips-style video clipper for `social_short` — upload long video → Whisper transcript + frame sampling → Claude clip selection → ffmpeg cuts → N short clips with captions. Multi-day build.
  - **C.** Multi-image carousel — today Carousel produces 1 image like Post. Per-slide generation deferred.
- **Files:** `index.html`, `css/style.css` (`.forge-ref-thumbs`/`.forge-ref-error` styles), `js/firepit.js` (OUTPUT_MEDIA, _forgeRefImages, handleRefImagesChange, render via DOM not innerHTML for XSS safety), `content_api.py` (VOICE_PROMPTS, `_system_prompt_for`, `_ref_images_to_blocks`, `/api/generate` wired), `media_gen.py` (`_ref_image_blocks` + `build_image_prompt` vision input), wiki.
- **Security:** thumbnail rendering uses `createElement`+`replaceChildren` instead of `innerHTML` to satisfy the XSS-warning hook (base64 data URLs from FileReader are inherently safe but the safer pattern is cheap).

## [2026-05-11] Artist live stats — kill embedded-follower-count bug, add on-view refresh
- **Why:** Doug spotted Carlos Manaça (signed to Magna Recordings, 21k followers) in Foraging despite the < 5k threshold. Root cause: SoundCloud's track-embedded `user.followers_count` is unreliable — stored as 7 in `data/2026-03-25.json`. The "suspicious → re-fetch" heuristic at `scout.py:163` (`followers < 500 AND plays > 5000`) missed him because plays were only 377. Backfill across the report showed **19 of 20 stored counts were wrong** — three other established artists (DJ S 11,830, dazegxd 15,812, plus several smaller errors) also slipped through.
- **Tap 1 — scout-time fix (`scout.py`):** dropped the heuristic. `is_eligible()` now always calls `fetch_real_followers(user_id)` for tracks that pass the play/recency gate. Cost: ~50 extra API calls per weekly scout run — invisible.
- **Tap 2 — on-view refresh (`content_api.py`):** new `GET /api/artist/<username>` route. 10-minute TTL via Supabase `artists` table. Cache hit = 0 SC calls; miss = 2 SC calls (`/resolve` + `/users/{id}/tracks?limit=5`). Helpers `sc_resolve_user`, `sc_fetch_user_profile`, `sc_fetch_user_tracks`. Force-bypass via `?force=1`.
- **Tap 3 — daily background:** `clan_tracker.py` unchanged. Daily 8am UTC continues feeding trend sparklines. No frequency bump — naive hourly poll would be 4,800 calls/day for a barely-better result.
- **DB migration (`db/0008_artist_stats.sql`):** added `play_count`, `like_count`, `track_count`, `avatar_url`, `display_name`, `username`, `updated_at` to `public.artists`. Applied to live Supabase.
- **Frontend (`js/app.js`):** `openPanel()` now fires `refreshArtistLive(username)` in parallel. On success, `renderPanel` prefers live values over stored snapshot. Green "● Live · synced Xm ago" pill in the growth row.
- **Backfill (`scripts/refresh_clan_stats.py`):** one-shot, iterates every weekly JSON, re-resolves each artist, rewrites with real `followers`. Ran against `data/2026-03-25.json` — Carlos + 3 other false-positives now fall out of Foraging on next load.
- **Verified:** `curl /api/artist/djcarlosmanaca` → 21,793 followers, `cached: false`. Second call → `cached: true`, zero SC traffic. Supabase row written.
- **Out of scope (next plan):** signed/label detection. Carlos's "Magna Recordings" affiliation in his bio is still invisible to the scout. Needs its own heuristic (parse `description`, flag "Radio Show" titles).
- **Files:** `scout.py`, `content_api.py`, `db/0008_artist_stats.sql`, `js/app.js`, `scripts/refresh_clan_stats.py`, `data/2026-03-25.json` (rewritten), `wiki/features/artist_live_stats.md` (new).

## [2026-05-11] Brand mark v2 + wordmark rename → S0UNDCAV3
- **Why:** Doug brought a new minimalist vector mark in (AI-generated, monochrome on `#0A0A0A` ground). Old logo was a hand-coded cave-mountain-with-fire scene built before tokens locked — visually busy and conceptually heavy. Wordmark also drops "The" and stylises name as `S0UNDCAV3` (zero/three substitutions read as terminal/leet — fits the CRT/cave skin).
- **Asset home:** new `brand/` folder at project root with `README.md` (palette + type reference) and `logo/` for active + `logo/dormant/` for alternates. Active mark: `brand/logo/soundcave_logo_2026-05-11.svg`. One dormant alt saved alongside.
- **Wired in:** `index.html` — 3 inline SVG blocks replaced with `<img class="logo-img logo-img--{splash,nav,hero}">` references. Wordmark text updated in 5 places (`<title>`, cave-stamp, cave-logo-text, header logo-text, home h1). Body copy still reads "The Sound Cave" descriptively — brand mark is stylised, the product name in prose is unchanged. **Doug to decide** if prose copy should also flip.
- **Grit preserved:** the gritty CRT feel was always environmental (`.cave-crt` scanlines + `.cave-grain` overlay on `.cave-entrance`), not on the logo itself. Swap doesn't touch those. Removed the now-obsolete `.cave-logo svg { filter: brightness(2.2) contrast(1.05); }` rule (was a workaround to lift the old grey-palette SVG on the dark bg — new mark is already palette-correct). Vestigial unused `#caveHalftone` SVG filter left in place (not referenced by CSS, harmless).
- **CSS:** added `.logo-img` + `.logo-img--{splash,nav,hero}` size classes in `css/style.css` next to the old removed rule.
- **Files:** `index.html`, `css/style.css`, new `brand/` tree.

## [2026-05-11] Firepit Forge strip-down — 15 → 7 types, 10 → 4 channels
- **Why:** Doug's call — the Forge content-type menu was too clunky and full of options he doesn't use. Real focus is Meta (IG + FB), TikTok, and Reddit; everything else was noise.
- **Content types** (locked): `social_post`, `social_carousel`, `social_short`, `event_promo`, `lineup_poster`, `artist_bio`, `press_release`. Captions are baked into the three social types (no standalone "TikTok caption"). Press Release is the safety valve for long-form/editorial oddities — no generic "Other" bucket.
- **Channels:** Instagram, Facebook, TikTok, Reddit. Removed X, LinkedIn, YouTube, Pinterest, Threads, Bluesky. `PLATFORMS_REQUIRE_MEDIA = {ig, facebook, tiktok}` — Reddit allows text-only.
- **Files:** `js/firepit.js` (CONTENT_TYPES + default `social_post`), `index.html` (forgeContentType `<select>`), `content_api.py` (TEMPLATES rewrite, STASH_KIND_BY_TYPE, PLATFORM_MAP, system prompt tweak), `media_gen.py` (IMAGE_DIMENSIONS + STYLE_HINTS), `js/trail_map.js` (TRAIL_PLATFORMS + text-only default → reddit), `wiki/features/firepit_forge.md`.
- **Stash:** Doug deleted existing rows beforehand → no migration needed.

## [2026-05-08] App-wide redesign v1 (overnight pass — chrome shipped, per-tab content awaiting Doug's morning walkthrough)
- **Spec:** new [`wiki/spec/redesign_v1.md`](spec/redesign_v1.md). Direction = stretch the splash's KVS skin across the rest of the app, lighter touch (no CRT bezel, body data stays sans for legibility, headers/labels/buttons go mono).
- **Tokens:** `:root` palette in `css/style.css` lifted to KVS-aligned dark + warm. `--red` repurposed to KVS orange-red `#ff4500` so all JS-set reds (avatars, error states) auto-update without touching JS.
- **Body:** subtle film grain via `body::after` (2.5% opacity overlay).
- **Header / nav / htabs / account dropdown:** mono uppercase tabs with accent-color underline on active, count badges as outlined boxes, account avatar as outlined accent square, sharp edges throughout.
- **Component primitives:** `.card`/`.stat-card`/`.input` radius 2px, `.stat-card` corner-tick chrome, `.btn-red` flipped to outlined accent (was filled), all numeric values mono.
- **Billing modal:** sharp edges, mono title, accent-orange hover shadow.
- **Trail Map (`css/trail_map.css`):** appended override block — buttons + period header + day cells re-tokened.
- **Custom scrollbars** matching theme (border-lt thumb, accent on hover).
- **Single override block** appended to end of `css/style.css` and `css/trail_map.css` for sweep-pattern fixes (radii, mono headings, pill micro-treatment) — annotated, easy to surgically revert per-rule.
- **Confirmed visually:** splash + home tab (see [`redesign_v1_assets/`](spec/redesign_v1_assets/)).
- **NOT yet visually confirmed:** the 5 sub-tabs + artist detail panel + billing modal — they share the same chrome so should be consistent, but headless screenshot harness couldn't render them (depend on async-fetched data). Doug to walk through in real browser; spec page lists the 10 surfaces to check.
- **Headless gotcha (logged for future):** `--headless=new`, never old `--headless` + `--disable-gpu` (mutes filters and animation forwards). Don't ship-check off headless alone for data-driven tabs.
- **Tech debt carried:** `css/style.css` now ~1466 lines (over 500 guideline); logo SVG still using a `brightness(2.2)` filter band-aid for the new dark bg; ambient drone is synthesised placeholder. All tracked in spec page.

## [2026-05-08] splash + cave entrance redesign — KVS×Augen hybrid (Doug-confirmed, shipped)
- **Doug visual sign-off:** "looks fucking awesome. i love." (chat, 2026-05-08).
- **Confirmed render:** [`wiki/spec/splash_cave_entrance_assets/v1_splash.png`](spec/splash_cave_entrance_assets/v1_splash.png).
- **Headless gotcha (logged):** old `--headless` + `--disable-gpu` mutes CSS filters and skips animation `forwards` fill — wasted ~30 min chasing a render bug that didn't exist in the real browser. For future visual confirms use `--headless=new` and don't trust old-headless screenshots.
- **Tweak made during verification:** logo SVG fills (designed for the old `#4a4a4a` palette) were nearly invisible against the new `#0a0a0a` bg. Added `.cave-logo svg { filter: brightness(2.2) contrast(1.05); }` as a quick fix. **Tech-debt:** longer-term, recolour the SVG paths directly against new tokens — the filter isn't tone-precise on the orange flame.
- **Animation fill mode:** changed `caveLogoIn` and `caveLoginIn` keyframes to use explicit `from { opacity: 0 }` + `backwards` fill so content stays visible if animation skips (reduced motion, slow paint, etc.).


- **Spec:** new `wiki/spec/splash_cave_entrance.md` — direction, hero moment, choreography timeline, ingredients lifted from KVS (skin/microcopy) and Augen (motion grammar). Approved in chat 2026-05-08.
- **Tokens:** new `tokens.css` at project root. Mono font (DM Mono — already in Google Fonts link), KVS palette (near-black `#0a0a0a`, off-white `#e8e8e8`, single accent `#ff4500`), motion durations + easings. Linked in `index.html` *before* `css/style.css` so feature CSS can reference `var(--…)`.
- **CSS rewrite:** entrance block in `css/style.css` (top ~225 lines) re-skinned. Adds `.cave-crt` (scanlines + vignette), `.cave-grain` (animated SVG noise), `.cave-sound-toggle`, `.cave-stamp`. Login inputs/buttons re-styled mono + sharp-edged + accent-only. Phase transitions retuned: total reveal shortened to ~2.6s with halftone-resolve overlay on `.app-wrap::before`.
- **HTML changes:** `index.html` cave-entrance block adds CRT/grain layers, sound-toggle (mute by default, opt-in `{SOUND ON/OFF}`), location stamp `{51.5°N 0.1°W}`, `{HEADPHONES RECOMMENDED}` tag above logo, halftone SVG filter def. CTA copy moved to bracket microcopy (`{ENTER THE CAVE}`, `{USE PASSWORD}`, etc.).
- **JS new:** `js/cave_entrance.js` — exposes `window.caveGlitch(el, target)` (vanilla 600ms scramble effect, locks left-to-right) and a WebAudio synth-drone behind the sound toggle (placeholder — swap to a real audio asset by setting `AUDIO_URL` in the file). Loads before `app.js`.
- **JS edits:** `js/app.js` `reveal()` adds `halftoning` class to `appWrap` then drops it after reveal; CTA submit now glitches via `window.caveGlitch` if available; mode-toggle labels updated to `{BRACKETS}`.
- **Status:** dev server running at `http://localhost:8765/` (PID 24040). NOT yet declared done — needs Doug's visual sign-off (ship-check rule). Open questions logged at the bottom of the spec page.
- **Tech-debt flag:** `css/style.css` is now ~1200 lines (over the 500 guideline). Net add ~100 lines from this work; overage pre-existed. Splitting style.css into modules is a separate refactor — flagged for later, not bundled here to keep this change focused.

## [2026-05-08] design_references: augen.pro added
- Saved [augen.pro](https://augen.pro/) as second entry in `wiki/design_references/`.
- Reference page `augen.md` documents stack (Nuxt 3 + Storyblok + Lenis + GSAP/ScrollTrigger), palette extracted from compiled CSS, replication tiers, and how to apply the aesthetic to Sound Cave (marketing pages yes, app surfaces no — KVS still owns the app mood).
- Visual stills (5 hero images, 144KB total) saved to `augen_assets/` — matches KVS "stills only" pattern.
- **Full code mirror** (504 files, 65MB) lives outside the wiki at `~/Desktop/website_clones/augen/` — too heavy for the repo. Reproducible via `wget --mirror` (command saved in `augen.md`). Doug picked option 2 (code clone outside wiki, visual stills inside) after the first attempt put the whole 65MB clone in the wiki and broke the KVS pattern.
- Index updated in `design_references/README.md`.

## [2026-05-07] auth: forgot-password reset flow added
- Spec amended: `wiki/spec/auth_login_ui.md` §2 now covers reset flow (`resetPasswordForEmail` + `PASSWORD_RECOVERY` event handler).
- `js/lib/supabase.js`: added `sendPasswordReset(email)`.
- `index.html`: "Forgot password?" link inside cave-login form (hidden until password mode).
- `js/app.js`: splash forgot-link sends the reset email; account dropdown listens for `PASSWORD_RECOVERY` and auto-opens the set-password panel.
- Reuses Supabase's default reset email template (custom branding deferred — out of scope).

## [2026-05-07] auth: password sign-in added alongside magic link
- Spec amended: `wiki/spec/auth_login_ui.md` now allows password as a secondary sign-in method (magic link still primary; password-based signup still out of scope).
- `js/lib/supabase.js`: added `signInWithPassword()` and `setPassword()` (wraps `auth.updateUser`).
- `index.html`: splash login form gains hidden password input + "Use password instead" toggle. Account dropdown gains "Set / change password" panel.
- `js/app.js`: toggle switches splash between magic-link and password modes; account panel calls `setPassword`.
- `css/style.css`: minimal additions — `.cave-login-toggle` + `.account-pwd-form` only. No new tokens.
- Driver: dev ergonomics — Doug was tired of email-code re-logins while building. Supabase email+password provider enabled in dashboard before code change.

## [2026-05-07] frontend live on Vercel 🎉
- Deploy `thesoundcave-9k9k086px-douglaswoolfenden-bytes-projects.vercel.app` is `READY` (commit `ac967c0`).
- Fix: added `vercel.json` (framework=null, no build, no install) + `.vercelignore` to suppress Flask auto-detection. Vercel was sniffing `requirements.txt` and demanding an `app.py` entrypoint; the static frontend now bypasses that entirely.
- ⚠️ Backend (Flask `content_api.py`) still NOT deployed — Firepit→Forge "generate" button will be inert in prod until Railway deploy is done. Tracked as the next deploy task.
- Set up `VERCEL_TOKEN` in workspace `.env` so future deploy checks/logs are scriptable from chat (no more screenshots).

## [2026-05-07] design_references library established
- Formalised `wiki/design_references/` as the home for saved UI/visual inspiration. KVS Studio (kvs.services) was the first entry; structure now standardised around its template (source, why, aesthetic-one-liner, ingredients table, palette, type, replication tiers, how-to-apply, open questions).
- Added `wiki/design_references/README.md` as the index + how-to-save-new-references guide.
- Added pointer in project `CLAUDE.md` so Claude reads the library before any UI work — feeds into the workspace-level `ui-change-protocol` Q1.
- Workflow: Doug says *"save [URL] as a Sound Cave design reference"* → Claude fetches/screenshots → writes `<name>.md` + `<name>_assets/` → updates index + log.

## [2026-04-30] [stream-1] Phase G E2E green — IG + Reddit posted from executor
- **Verified live**: executor self-test posted to Instagram (https://www.instagram.com/p/DXwRvcxlnfD/) and Reddit (https://www.reddit.com/r/u_Middle-Belt-761/...) in one fire. DB row went `scheduled → posted` with `ayrshare_post_id` populated. Phase G is functionally complete.
- **IG fix**: Cloudflare-fronted Supabase Storage URLs are unreliable for Meta's production fetchers (error 440 even with valid JPEG/specs). Solution: re-host every IG-bound media URL via Ayrshare's `/api/upload` endpoint (free-tier-allowed) before submitting `/api/post`. Added `_ayr_rehost(url)` helper.
- **Reddit fix**: Ayrshare's `/post` requires `redditOptions.title` + `redditOptions.subreddit`. Default subreddit = `u_<reddit_username>` (user profile pseudo-sub), resolved once at startup from `/api/user`. Title = first line of `post_text`, max 299 chars. Cached for 1h.
- **Error parsing fix**: `_ayr_extract_error()` now reads `data['errors'][]` (per-platform) instead of misleading top-level `error/message`. Stored DB error finally matches what Ayrshare actually said.
- **Frontend**: `js/trail_map.js` smart-defaults platform on drop (`['ig']` if media else `['x']`); modal save now hard-blocks on zero platforms instead of silently falling back to `['ig']`.
- **Image format**: `media_gen.save_image` now converts every uploaded image to JPEG via Pillow. Filename `.jpg`, content-type `image/jpeg`. Resolves PNG-rejection issues for any future platform that requires JPEG. Added `Pillow` to `requirements.txt`.
- **Dev UX**: Added `run.sh` launcher — single command starts Flask API on :8000 and `python -m http.server` on :3000. Site URL `http://localhost:3000` matches Supabase auth allowlist (no Supabase config change). Stops both with one Ctrl+C.

## [2026-04-30] [stream-1] db/0007_ayrshare.sql applied to live Supabase
- `scheduled_posts` extended with `post_text`, `media_urls`, `posted_at`, `error`, `attempts` columns. All 13 columns verified via information_schema.
- Phase G executor now has the schema it needs to write back post-fire status. End-to-end verification (connect social → schedule → fire) is the only remaining gate before Phase G ships.

## [2026-04-30] [stream-2] db/0007_audio_tracks.sql applied to live Supabase
- `audio_tracks` private storage bucket created (25MB cap, no public read).
- Migration 0007 run: `audio_tracks` table + RLS, 5 clipping columns added to `stash_items`, 4 owner-scoped policies on `storage.objects` for the new bucket.
- Verified via `pg_policies` query — all 4 policies (read/write/update/delete) present. Tier 1 composite video uploads now functional against live Supabase.

## [2026-04-29] [stream-2] Phase 5 — /api/generate-media endpoint + health
- New endpoint `POST /api/generate-media` (multipart or JSON). `media_type` ∈ {image, video_composite, video_standard, video_premium}. video_composite requires `audio_file` field (multipart); other types accept it optionally.
- `_parse_media_request` handles both `application/json` and `multipart/form-data` (JSON in `data` field, audio in `audio_file`). Audio size cap = `MAX_AUDIO_FILE_BYTES` (25MB).
- `_dispatch_media` routes by media_type to the right media_gen function.
- Response includes `media_url`, `provider`, `model`, `dimensions`, `duration_seconds`, `audio_track_id`, `estimated_cost_usd`, `credits_balance`. Cost transparency requirement met.
- Credit costs: text=1, image=5, video_composite=10, video_standard=20, video_premium=100. Debit-before / refund-on-error pattern reused from existing image flow.
- `/api/health` now returns `media_providers` (nested per-tier) plus a legacy `image_providers` alias for the existing frontend.
- `/api/generate-image` kept verbatim as a thin alias — the live Forge UI still uses it; Stream 1 will swap when ready.
- Validation errors return 400 (bad media_type, duration over cap, missing audio for composite); auth still 401; provider failure still 500 (with refund).
- Smoke verified via Flask test client (DRY_RUN=1, LOCAL_IMAGE_FALLBACK=1, auth + credits stubbed): video_composite multipart 200, bad media_type 400, missing audio 400, duration cap 400.

## [2026-04-29] [stream-2] Phase 4 — Tier 3 premium video (live skipped)
- Veo 402'd twice (once before Replicate billing fix, once after). Likely Veo 3 gating on account, not a code bug — request shape, auth, and model path all verified by Replicate's clean API rejection.
- Decision: **skip live Tier 3 verification** for this PR. Risk bounded — Phase C credits engine refunds on failure, so a paying user hitting a real Veo bug doesn't lose money.
- Kling deliberately not called — same Fal queue pattern as LTX (already verified Phase 3) at ~$1–2 vs ~$0.10. Poor verification ROI given LTX worked.
- Code-complete: `_generate_fal_kling`, `_generate_replicate_veo`, `generate_video_premium`. Dry-run smoke verified, 91KB placeholder mp4.

## [2026-04-29] [stream-2] Phase 4 — Tier 3 premium video (dry-run gated)
- `_generate_fal_kling` — `fal-ai/kling-video/v1.6/standard/text-to-video`. Duration param accepts '5' or '10'.
- `_generate_replicate_veo` — `google/veo-3-fast` on Replicate. Caps at 8s; uses `Prefer: wait` for inline polling, then standard poll.
- `generate_video_premium(prompt, audio_path, w, h, duration)` — Kling primary, Veo fallback. Same audio mux + DRY_RUN behavior as Tier 2.
- Dry-run smoke verified: 91KB placeholder mp4, both streams.
- **Live Tier 3 call NOT yet made.** Awaiting go-gate (~$1–2 for one Kling 5s call).

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

## [2026-05-12] header — sharp corners + logo-only brand mark
- All `.htab` pills: `border-radius` 10 → 0 for the editorial/terminal feel
- Brand pill chrome stripped (no border, no padding); wordmark `S0UNDCAV3` removed from header (still in title + splash)
- SVG `viewBox` cropped from `0 0 1024 1024` → `252 256 520 520` so the artwork fills its container instead of floating in dead canvas
- Logo finalised at 56×56, vertically centered to pill row, 16px right gap before `THE CAVE`
- Added `brand/fonts/DMMono-Regular.ttf` + `DMSans-Regular.ttf` as the canonical brand-kit upload assets for the in-progress Brand Kits feature
- Commits: `2633e9f`, `9924a05`

## [2026-05-13] Phase 2/3 pivot — promoter-first campaign engine (Day 1)
- Strategic pivot from "AI tools for music industry" to **campaign engine for independent promoters**. Tagline: *"Turn one event into a month of content."*
- Authoritative spec: `~/Downloads/Soundcave Phase 2.3 Mission.md`. Execution plan: `~/.claude/plans/the-sequenced-roadmap-to-floofy-bonbon.md`.
- New wiki page `wiki/spec/phase_2_3_pivot.md` supersedes parts of `overview.md` (banner added to overview).
- Decisions locked: build Supabase magic-link auth at start of Phase 2; Python background thread for async generation; Python + Pillow for image composition; single Promoter tier (~£39/mo) for beta; video gen deferred.
- Phase plan: 1) Reframe; 2) Event entity (weeks 2-3); 3) Campaign generation (weeks 4-6); 4) Profile claim (weeks 7-8); 5) Ayrshare publishing (weeks 9-10); 6) Beta launch (weeks 11-12).
- Code: scaffolded `events_api.py` and `artist_profiles_api.py` as empty Flask Blueprints; registered in `content_api.py`. No routes yet — Day 2 lands migrations and auth wiring.
- Awaiting Doug sign-off on `phase_2_3_pivot.md` before Day 2.
- Commit: `8a9ecb0`

## [2026-05-13] Phase 2 — schema + API + Events UI (Days 2–4)
- **Schema** (`db/0012` + `db/0013` + `db/0014`): events, lineup_slots, artist_profiles (Phase 4 column set), campaigns, posts. All RLS-enabled. Applied to Supabase pooler, verified `rowsecurity=t` on all five tables.
- **Backfill**: `scripts/migrate_scout_to_profiles.py` reads every `data/YYYY-MM-DD.json` weekly scout report, dedupes by SoundCloud handle, upserts to `artist_profiles` with `claimed=false`. Idempotent (verified re-run). Seeded **20 profiles**.
- **Shared helpers**: `sb_helpers.py` (require_user + service-role supabase client), `soundcloud_helpers.py` (search_users / resolve_user / fetch_user_tracks / handle_from_url). Extracted to break the events/profile APIs free of circular content_api dependency.
- **API**: `events_api.py` (GET/POST/PATCH/DELETE /api/events, GET /api/events/<id> with joined lineup+artist_profiles), `artist_profiles_api.py` (list/get/patch, POST /match returning local + SoundCloud candidates with top-track, POST /scrape upserting from a handle). All JWT-gated.
- **Frontend**: new EVENTS tab pinned as the **first** top-level pill (signalling promoter-first); `js/events.js` is one module with three render modes — list (upcoming + past cards), new (manual form), match-review (per-name candidate picker). Built with a DOM-builder helper (no innerHTML / inline onclick).
- **Auth**: magic-link login + cave-entrance splash gate were already wired (Phase B work, 2026-05-07). No new code needed.
- **Not done yet**: Roster rename (Clan → Roster), flyer-upload vision extraction, manual stub endpoint, Day-5 dogfood of 3 real events. All week 2.
- **Not visually confirmed**: API endpoints respond correctly to curl; UI compiles; Doug needs to dogfood the EVENTS tab end-to-end to validate the match flow surfaces good candidates.
- Commits: `979f6a0` (schema + API + backfill), `1939f10` (events UI).

## [2026-05-13] Flyer extraction + Phase 3 v0 (campaign generation)
- **Flyer drop** (`f0e6884`): drag a flyer onto the EVENTS list → upload to new `event_flyers` Supabase bucket → Claude Sonnet 4.6 vision extracts {name, event_date, venue, lineup, ticketing} → new-event form pre-fills → match pipeline runs. Manual-stub endpoint also wired (name-only artist creation).
- **Phase 3 v0** (`3e9c070`): `{GENERATE CAMPAIGN}` is real. Click on the event detail page → ~15-30s sync run → vertical timeline of 6-14 captioned posts (announcement → spotlights → countdowns → recap). Haiku for bulk, Sonnet for hero posts (announcement / headliner_spotlight / recap). Voice presets live in `config/voice_presets.py` — single tuning lever.
- New files: `events_api.py` (extended), `artist_profiles_api.py` (extended), `campaigns_api.py`, `campaign_template.py`, `config/voice_presets.py`, `sb_helpers.py`, `soundcloud_helpers.py`, `js/events.js`, `scripts/migrate_scout_to_profiles.py`, `scripts/create_event_flyers_bucket.py`, 3 SQL migrations.
- Doug validated Phase 2 end-to-end manually — first event "BUCKING PALACE LAST MAN STANDS" created with real SoundCloud-matched lineup.
- **Not yet done**: copy-quality dogfood, post-editor modal, image composition (Pillow), async orchestration (threads), Roster rename.
- Session paused at usage limit. Resumption note in memory.

## [2026-05-13] Session 2 — Phase 3 v0.6 brand-aware image gen shipped end-to-end
Picked up after the morning pause. **25 commits across both sessions today.**

**Phase 1 closed:** EVENTS as default landing tab (`5be156e`), Roster cosmetic rename, wiki ratified.
**Phase 2 closed (~98%):** flyer drop extraction, manual stub endpoint, lineup matching surfaced cleanly, Sonnet 4.6 vision extraction verified working on real flyer.
**Phase 3 v0 → v0.6 shipped:**
- v0 sync copy generation per post type with voice presets (`3e9c070`)
- v0.5 Pillow image composition (`cc321f5`)
- Sound Cave branding stripped from all output (`08d4147` — module hard rule, S0UNDCAV3 mark gone, no Sound Cave red default)
- v0.6 brand-aware: FLUX Redux style-reference image gen, brand_kits.reference_image_urls, events.brand_kit_id, master-flyer generation endpoint, composer dispatch (`c6e426b`)
- v0.6 UI: {GENERATE MASTER MEDIA} + {REGEN FROM REFERENCE} buttons, BRAND REFERENCES library on event edit (`ea8f78b`)
**Stash bridge (`8004984`):** auto-sync campaign posts -> stash_items at gen time; retroactive {PUSH TO STASH} button. Unblocks the path to Trail Map scheduling.
**Tech debt closed:** js/events.js split into 6 focused modules (`e61a79b`), all under 500 LOC.
**Bug fixes:** sb_helpers.maybe_one() killed supabase-py NoneType crashes on zero-row queries (`f2373bc`); JSON variant parser hardened against ```json fences + trailing prose (`94d04cf`); init-tab honoured currentTab (`5be156e`); brand_kits response shape unwrap (`a12d0f6`).
**Spec & wiki:** `brand_aware_image_gen.md` written, rewritten after Doug's Firepit-as-factory reframe, signed off (`e145a25`). `features/campaigns.md` (`ae2632d`). `features/events.md` (`5617894`).
**Drop "flyer" -> "media" copy pass** complete (`ece0d2b`).
**Known v0.7 work (Task #30, memory `project_soundcave_regen_variance`):** brand variance — logos shift between posts; single-ref FLUX is unstable; fix levers = logo lockup overlay + multi-ref IP-Adapter + deterministic seed + palette enforcement.
**Outstanding for next session:**
- Verify Stash UI actually renders the pushed posts (potential firepit.js render tweak)
- v0.7 variance fix (biggest product blocker)
- Trail Map -> real backend (Phase 5; currently reads localStorage mock)
- Proper Brands tab UI for references (shortcutted onto event form for v0.6)
- 3-event dogfood (Doug-driven, not code)
- Doug confirmed voices file hand-tuned mid-session — voice quality validated.

## [2026-06-09] Stash → campaign blocks + Trail Map campaign-aware + Summons→Gatherings rename
Firepit info-architecture pass (plan: `~/.claude/plans/bubbly-percolating-shore.md`, signed off).

**Rename:** user-facing **Summons → Gatherings** across the events surface (`index.html` subnav, `events_list/_match/_form/_detail.js`). Internal `events`/`summons` routing keys + the `events` table untouched (invisible plumbing).

**Stash — campaign blocks (new `js/stash.js`):** the flat list is now a **grid of blocks**. Campaign posts cluster into one campaign tile per Gathering (cover + post-count + date range), click to drill into its posts; loose Forge items sit alongside as single tiles. Every tile shows a title + countdown label (`postTypeLabel`: 7-DAY/3-DAY/ANNOUNCEMENT…). Count moved into the panel header (`STASH · N pieces`); top-pill `#firepitCount` + subnav badge removed.
- **Keystone (no backend change):** `_stashRowToItem` (firepit.js) extended to carry `campaignId`/`eventName`/`postType`/`scheduledFor`/`source` from `stash_items.metadata` top level — these were already persisted by the campaign bridge (`_upsert_post_into_stash`) but dropped before reaching the UI, so every campaign post had been showing as a generic label-less `social_post`.
- **Module split:** stash *view* (render/grouping/drill-in/count/filters) → `js/stash.js`; firepit.js keeps the *data* layer + Forge-coupled mutations. firepit.js back under control (~960 LOC).

**Trail Map — campaign-aware + schedule-lock (`js/trail_map.js`):** drawer now shows campaign folders → drill → draggable post cards, reusing `groupStashByCampaign()`. Calendar pills + cards show countdown labels. **Schedule-lock:** a scheduled item is *derived* as scheduled (its id in the shared `/api/scheduled_posts` cache) → drops from the draggable pool + Stash default grid, surfaced under the "Scheduled" filter, returns to drafts when its calendar entry is deleted. Two-way sync, no new endpoint. (Decision: derive-not-write, confirmed with Doug.)

**Status note:** Trail Map is backend-wired (Supabase `/api/scheduled_posts`), correcting the stale "localStorage mock" note above.

**CSS:** `.stash-grid`/`.stash-block`/`.countdown-badge`/drill-in in `style.css`; `.trail-stash-folder`/`.trail-drawer-head` in `trail_map.css`. Tokens only.

**Verification:** all 7 JS files pass `node --check`; servers up (8000+3000). Visual screenshot-confirm with Doug pending (browser session was locked during build).

### Round 2 — Doug feedback (same day)
After eyeballing round 1 ("looking much better"):
- **Delete/open whole campaigns:** campaign tiles get a hover settings overlay — `openGathering()` (jump to the Gathering) + `deleteStashCampaign()` (bulk-delete the campaign's posts from stash; Gathering record stays).
- **Cave-style icons:** replaced emoji actions (✏️/📋/🗑️ — the clipboard read as ambiguous) with inline 16-grid line-art SVGs matching the clan/watch/cut set, with tooltips.
- **Proposed dates:** drill-in post tiles show `Proposed · <date>` small print so a campaign reads as a timeline.
- **Scheduled stays visible (reverses round-1 hide):** scheduled items remain in the Stash with a `scheduled` badge; in the Trail Map drawer they're dimmed + non-draggable; folders show `N of M to schedule`. Doug's call — clarity over hiding.
- **Parked:** `posted`→`archived`→auto-delete lifecycle (badge styles added; logic TBD).

## [2026-06-04] Cleanup — close stale Phase-B auth TODO
The `// TODO(phase-B): drop DEV_USER_ID gating in content_api.py and pass real auth JWT`
marker at the top of `js/firepit.js` was already satisfied: Phase B auth lockdown
(see 2026-04-29 entries) moved every protected route to `_require_user()` (JWT →
Supabase `auth.get_user`, 401 on miss) and the frontend onto `scAuth.authedFetch`.
The only residue was a dead `from media_gen import DEV_USER_ID` import in
`content_api.py` (unused — grep confirmed) and the stale comments.
- Removed the dead import; rewrote the stash-section comment to state the real
  access boundary (service key bypasses RLS, so the `.eq('user_id', uid)` filters
  are the control).
- Replaced the firepit.js TODO with a note that requests carry the JWT via
  `scAuth.authedFetch` and 401 without it (no DEV_USER_ID fallback).
- `DEV_USER_ID` still lives in `media_gen.py` purely as a default for direct/CLI
  calls; content_api always passes the JWT-resolved `uid`, so no behaviour change.

## [2026-06-09] Stack inventory page
- New `wiki/stack.md` — source-of-truth inventory of every tool/API/model, pulled from code not memory. Covers text-gen (Claude Haiku 4.5 + Sonnet 4.6), image-gen (v2 router: Seedream v5 Lite / FLUX.2 pro / Nano Banana Pro, plus legacy v0.6 FLUX-Redux paths), video-gen (3 tiers: FFmpeg / Fal LTX+Hunyuan / Fal Kling+Replicate Veo), and infra (Supabase, Stripe, Ayrshare, SoundCloud).
- Flagged: no music-gen; Apollo/EchoTik/Perplexity/Notion/Meta keys are workspace-wide and NOT Sound Cave deps; two image-gen generations coexist (v0.6 + v2) — retirement decision pending; single text provider = SPOF.
- Linked from `wiki/index.md` under a new **Stack** section.

## [2026-06-09] Forge output recipes — Phase 0 (per-type media specialisation)
Kicked off the image-quality overhaul. **Diagnosis:** the best image models (v2 router: Seedream /
FLUX.2 pro / Nano Banana Pro) are built but only avatars use them; Forge runs FLUX schnell + never
passes reference images; the campaign path ignores the text prompt entirely (hardcoded 2-word strings).
So output is low-quality AND undifferentiated — every type generates the same 1080×1350.
- **Scope locked with Doug:** post types cut to **5** — Post, Carousel, Event Promo, **Event Poster**
  (renamed from Lineup Poster), Artist Bio. Removed: Short (video), Press Release. Artist Bio gains image
  gen (was text-only) as a portrait 1080×1350 feed post. Audio/attach-music feature handled separately.
- **References sourced + approved** (Claude-sourced, Doug-approved): per-type anchors saved to
  `wiki/design_references/forge_output_refs.md`. Load-bearing finding: real underground posters =
  backdrop layer + type layer in a fixed frame → validates the Konva-compositor architecture (model makes
  the backdrop only; compositor overlays type).
- **Spec:** `wiki/spec/forge_output_recipes.md` (Approved) — per-type format, composition, style language,
  context+refs, and `content_type → job_type` model mapping. Carousel routes to FLUX.2 (seed-locked) since
  Seedream ignores seed and slides would drift.
- **Trust mechanism:** every generation will log the exact prompt + attached refs (Doug's reassurance ask).
- **Next:** Forge cleanup (drop types/rename, Artist Bio image ON) → Phase 1a (route Forge through v2
  router + pass image_refs + per-type dims). Plan: `~/.claude/plans/what-are-the-image-parsed-hare.md`.

### Phase 0 + cleanup + Phase 1a shipped (commit `d14a346`)
- Forge cleanup: dropped Short + Press Release, renamed Lineup→Event Poster, Artist Bio now image-ON
  portrait 1080×1350. Synced across index.html, firepit.js, compositor_templates.js, content_api.py,
  media_gen.py (5 types, all 4:5; new STYLE_HINTS describe BACKDROP intent only).
- Phase 1a: `/api/generate-image` routes through `generate_for_job` via new `job_type_for()`
  (social_post→Seedream, carousel/promo/poster→FLUX.2, artist_bio→FLUX.2 / Nano Banana if avatar).
  Passes `reference_images` as `image_refs`; guarded fallback to legacy `generate_image`; logs prompt +
  ref count. Both ref channels live (Claude vision prompt + FLUX.2 payload). Module-verified.

### Phase 1b — campaign prompts data-driven + v2 router
- `image_composer.py`: deleted `_POST_FLUX_PROMPT` (the hardcoded 2-word strings). `_compose_brand_aware`
  now builds the prompt via `build_image_prompt` from event + artist + the post's **selected copy**
  (threaded in via new `generated_text` param on `compose_post_image`, passed from campaigns_api:394).
  New `_campaign_content_type()` maps post_type → Forge content_type (spotlight→artist_bio,
  announcement→event_poster, else event_promo) for the right STYLE_HINTS.
- Replaced `generate_fal_with_reference` with `generate_for_job(JOB_HERO_ART, …, image_refs=[style_ref],
  seed=…)`. FLUX.2 is fixed for the campaign path because it depends on image_refs + seed, which Seedream
  ignores. Logo overlay + deterministic seed + Pillow fallback all unchanged.
- **Pending live-fire:** real fal generation screenshot-confirm (needs server + credits + a real campaign).
- **Follow-up flagged:** `events_api.py` master-flyer still uses `generate_fal_with_reference` (separate
  surface — not per-post; left in scope-creep parking).
- **Still to do:** Phase 1c-full (Konva compositor for campaign posts) — deferred.


## 2026-06-09 — The Cave overhaul, Phase 1 (Mural + Foraging quick wins)

Branch `phase-3-v0.6`. First of 4 sign-off-gated phases (plan: `~/.claude/plans/okay-i-want-okay-bright-cook.md`). All four items live-fire screenshot-confirmed via Playwright.

- **P1a — auto-add-to-clan bug FIXED.** `openPanel()` (`js/app.js`) used to call `addFavourite()` on any card click, silently adding viewed artists to the Clan. Now opening a non-clan artist builds a **transient** read-only object (`transientArtistFromTrack` + `findReportTrack`, sourced from live search results then weekly reports) and renders view-only. Clan-only sections (platform links / manual entry / notes / cut-export-remove) hide; a prominent **"+ ADD TO CLAN"** section shows instead (`addArtistToClan` — the only UI path that writes to the Clan now). `refreshArtistLive` caches live stats onto the transient object too. New section IDs in `index.html`: `panelAddClanSection`, `panelPlatformSection`, `panelManualSection`, `panelNotesSection`, `panelActionRow`.
- **P1b — orange eye.** Watching empty state swapped the emoji eye for the real SVG eye (matches the Watch button), forced to brand orange `#ff4500` via new `WATCH_EYE_ICON` const in `js/foraging.js`.
- **P1c — Mural scaled up.** `css/dashboard.css`: `.panel-value` 28->40px, labels/trends 9-10->11-12px, panel max-width 240->300px (bl/br 320/340), padding + interior gaps bumped, chip offset 116->150px; panels gained hover lift + pointer cursor. 1024px breakpoint rebalanced.
- **P1d — widget drill-downs (= clan_tracking_dashboard Phase 2, now SHIPPED).** Hover Followers/Likes/Listens -> `.cave-stat-tooltip` (top-5 movers by delta, reuses `window._caveStatDeltas`). Click any of the 6 widgets -> centered `.stat-modal` (new reusable component, dark palette, backdrop+Esc close): ranked artist table (row -> artist panel) for stat widgets, full breakdown for Genre Mix / New Drops (new caches `window._caveGenreFull` / `window._caveDropsFull`). Wiring via idempotent `wireCaveStatInteractions()` in `renderCave()`. Markup: `#caveStatTooltip` + `#caveStatModal` in `index.html`; styles appended to `css/style.css`.

Verification note: the MCP browser uses a persistent profile that disk-cached pre-edit JS/CSS — real (fresh) loads are unaffected; files pass `node --check` and serve correct bytes.

**Next:** Phase 2 — artist detail right-slide panel -> centered modal + compact L->R platform links (spec first).

## 2026-06-09 — The Cave overhaul, Phase 2 (artist detail modal + compact links)

Spec: `wiki/spec/artist_detail_modal.md` (signed off, then built). Live-fire screenshot-confirmed.

- **P2a — artist panel → centered modal.** `.artist-panel` was a 500px right-slide sidebar; now a centered, wider-than-tall modal (760px / max 92vw, max-height 86vh, internal scroll, fade+scale-in) over a dim+blur `#panelOverlay`. Shares the `.stat-modal` grammar from P1d. `openPanel`/`closePanel` logic unchanged — only CSS geometry — so all callers inherit it. Esc-to-close added (`js/app.js`).
- **P2b — compact platform links.** Vertical `.plat-row` list + "+ ADD LINK" replaced by a horizontal row of 40px icon-only `.plat-chip` marks (name on hover via `title`). Linked = orange/active (click opens the URL, `https://` prefixed); unlinked = dimmed (click reveals one shared inline `#platEdit` input → saves via existing `savePlatform` → flips linked); hover a linked mark for a ✎ pencil to edit. Handlers via `addEventListener` (no inline JS with user data). Removed `togglePlatformEdit` / `refreshPlatformRow` and the old `.plat-row*` CSS.

Also (mid-Phase-2): commit security review on the P1 commit flagged the stat-modal row's `onclick="…openPanel('${esc(user)}')"` — esc is HTML-attr-safe but not JS-string-safe. Fixed in `80e05d7` (data-user attribute + addEventListener). Applied the same no-inline-handler pattern to P2b's chips.

**Next:** Phase 3 — accurate own-track play tracking (SoundCloud API, all own tracks) + replace the history table with a chart (spec first).

## 2026-06-09 — The Cave overhaul, Phase 3 (accurate play tracking + chart)

Spec: `wiki/spec/play_tracking_accuracy.md` (signed off). Live-fire verified against the real SoundCloud API.

- **P3a — own-track play accuracy (backend).** Both `clan_tracker.py` (`fetch_all_user_tracks`) and `content_api.py` (`sc_fetch_all_user_tracks`) now paginate `/users/{id}/tracks` via `linked_partitioning` (200/page, capped 500/10pg) and sum `playback_count` across the artist's **entire own catalogue** — not just the 5 most recent. Reposts/mixes are excluded by the endpoint. `latest_track` = newest by `created_at`. Fixes wildly-undercounted plays.
- **P3b — chart, not table (frontend).** Artist panel's "rows and rows" `snap-table` replaced with a **Plays-over-time** chart (`renderPlaysChart` + `buildArtistPlaySeries`, reusing `buildLineChart`), sourced from the backend daily snapshots (`allSnapshots`). Raw series, dips included (Doug's call). Top stats row gains a backend-snapshot fallback so it matches the chart when the live API hasn't synced.
- **Decision:** chart shows the true daily series (no running-max smoothing) — Doug chose raw over increase-only.
- **Live run (2026-06-09):** `clan_tracker.py` → `data/snapshots/2026-06-09.json`. Accuracy proven: **dazegxd 297 tracks → 6.71M plays** (old cap saw ~5 tracks); **81zaki 25 tracks → 26,281 plays** vs old 3,858. Chart + consistent stats screenshot-confirmed.
- Pre-existing, out-of-scope: `fetch_user_by_username` doesn't resolve display names with spaces/unicode (8/20 resolved) — a name→permalink gap, unrelated to play accuracy. Worth a future fix (store `user_id`/permalink at scout time).

**Next:** Phase 4 — real weekly scheduled searches (committed JSON → scout.py → GitHub Action, results tagged by search).
