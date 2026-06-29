# Sound Cave Wiki — Log

## [2026-06-27] Age 1 milestones reframed to the real build → `v1.2.2` (branch `claude/version-tier-roadmap-l3nzhu`)
Doug reframed Age 1's milestones to match how the studio was *actually* built (breadth-first), and we set the live version to reflect it. New decision [0014](decisions/0014_age1_milestones_reframed.md).
- **Age 1 milestones are now the real segments/tools:** `1.0` **The Cave** (Mural · Foraging · Clan · Footprints, built; Foraging search being smoothed) · `1.1` **The Firepit** (Forge · Gatherings · Stash · Trail Map · Marks, built; Trail Map calendar parked) · `1.2` **Forge formats** (Flyer ✅ · Animation ✅ · Still ⏳ · Carousel ⏳ — the only new builds left).
- **Iteration digit = "make it all work"** — hardening every page, no new features beyond Still + Carousel.
- **Etchings retired** — the curated style gallery is dropped from the plan (marked retired in [glossary](glossary.md), [build_plan](build_plan.md) Stage 2, [index](index.md), [style_gallery spec](spec/style_gallery.md)); history left intact.
- **Gate → Age 2:** all four formats shipped + studio solid + ready for users (replaces the old "Etchings live" gate).
- **Version → `1.2.2`** (Age 1 · Forge-formats milestone · Cave+Firepit built, Flyer+Animation done). Updated root `VERSION`, `js/version.js` fallback, the two `index.html` stamp fallbacks, and rewrote [roadmap](roadmap.md) Age 1. The site corner stamp now shows `V1.2.2`.

## [2026-06-27] Version surfaced in the corner stamp (branch `claude/version-tier-roadmap-l3nzhu`)
Carried the live version into the UI off the back of the Ages system below. The splash bottom-left stamp went from a hardcoded `{S0UNDCAV3 / V1}` to `{51.5°N 0.1°W} {S0UNDCAV3 / V1.0.0} {FIRST AGE}`, and the **same stamp now persists bottom-left on every app page** (Doug's ask — "locked in at the bottom left on every page").
- **Single source of truth:** new [`js/version.js`](../js/version.js) reads the root `/VERSION` file and paints any `[data-version]` / `[data-age]` slot → `V<number>` + the Age label. Splash (`#caveStamp`) and app-shell (`#appStamp`) share the markup contract, so one paint keeps both in sync. Bumping `/VERSION` updates the UI automatically; the Age is a one-line constant in `version.js` (bumps only at a graduation gate).
- **App stamp** (`.app-stamp`, new in [css/style.css](../css/style.css)) lives **outside `.app-wrap`** — that ancestor has `transform: scale()`, which re-anchors `position: fixed` (same gotcha as corner-nav / mobile-tabbar). Fixed bottom-left, `pointer-events:none`, z 40 (below modals, hidden behind the splash overlay until entry). **Hidden on mobile** ([css/mobile.css](../css/mobile.css)) so it never collides with the bottom tab bar.
- Verified headless (Playwright): both stamps render `{S0UNDCAV3 / V1.0.0} {FIRST AGE}` from `/VERSION`; app stamp anchored at viewport bottom-left, clear of the OVERVIEW/INDEX corner-nav.

## [2026-06-27] FROM STASH (cont.) — proxy allow-list now passes own Stash images (branch `firepit-stash-edit-fix`)
Live-testing the picker fix on `localhost:3000` (against the prod Railway backend) surfaced the *next* error
when picking a still: **"only SoundCloud CDN images are allowed."** Root cause: `/api/proxy-image`
(`content_api.py`) — which base64s a URL server-side so it can be used as a Forge reference — whitelisted
**only** `sndcdn.com` for SSRF safety. Stash images live on our **Supabase Storage** host, so they were
rejected. Fix: also allow URLs that pass the existing `_is_own_storage_url()` guard (same SSRF-safe check
the media endpoints already use; `allow_redirects=False` still blocks redirect SSRF). Error copy + docstring
updated. Verified (Python sim of the new condition): accepts our Stash + SoundCloud, rejects other-project
Supabase, the cloud-metadata IP, http-downgrade, and arbitrary hosts.

⚠️ **Backend change → needs `railway up`** (decision 0007: Railway deploys manually, not from GitHub). The
`:3000` test frontend points at the live Railway backend, so this fix is invisible until the backend is
redeployed. Additive + backward-compatible (only widens the allow-list), so safe to deploy independently of
the frontend merge.

## [2026-06-27] FROM STASH picker — pick now loads; stills-only (branch `firepit-stash-edit-fix`)
Two fixes to the shared FROM STASH picker (`js/stash_picker.js`), which feeds all three FROM STASH buttons
(Forge references, Animation artwork, Gatherings flyer).

**1. Picking an item didn't load it into the Forge (root cause of Doug's report).** The cell-click handler
called `_close()` — which sets `_currentCallback = null` — and only THEN ran
`if (_currentCallback) _currentCallback(item)`, so the pick callback never fired: the modal closed but
nothing loaded. Fix: capture the callback into a local (`const cb = _currentCallback`) before `_close()`,
then invoke `cb(item)`. Affected every item type (stills and animations alike).

**2. Animations excluded from the picker (Doug's call).** Animation stash items store their VIDEO url in
`imageUrl` (the very field the picker hands to image-only code), so a picked animation would fail as a
reference/artwork source. FROM STASH is "use existing artwork" → now **stills-only** via `_isStill()`
(drops `type === 'animation'` and any `context.kind === 'video'`). Empty-state copy updated. To edit a saved
animation, open it from the Stash grid — `editStashItem` already reopens it as a playable video (unchanged).

Verified: Node sim of both functions — filter shows only stills (animation/video/text-only dropped); the
old handler reproduces the never-fired bug, the new handler fires with the picked item. ⚠️ Doug to confirm
live (login + a saved still/flyer) that picking a still lands it in the Forge. Spec:
[stash_forge_integration.md](spec/stash_forge_integration.md).

## [2026-06-27] Version system (Ages) + go-to-market plan (branch `claude/version-tier-roadmap-l3nzhu`)
Gave the product a formal versioning spine and spec'd the era after this one. **No app code changed** — wiki + a root `VERSION` file + one git tag.
- **Scheme:** `Age.Milestone.Iteration` (e.g. `1.2.3`), git-tagged `v1.2.3`. Age = strategic era (bumps only at a **graduation gate**), Milestone = roadmap step within the Age, Iteration = each shipped release. "Age" chosen over "Tier" to avoid colliding with subscription tiers (`tier_*`) + video tiers. Rule in [decision 0013](decisions/0013_version_ages.md); live position in [roadmap](roadmap.md).
- **Three Ages:** First = The Studio (now), Second = The Market (first 100→1000), Third = The Platform. Each has an explicit graduation gate so "when does the next era start" is a checklist, not a feeling. First-Age milestones map 1:1 onto [build_plan](build_plan.md) Stages 0–4.
- **GTM plan** ([gtm.md](gtm.md)) — the Second Age: design partners → first 100 (hand-to-hand, "done-for-you first flyer") → first 1000 (referral loop + Etchings-as-portfolio). North-star = assets *posted*, not generated. Ties into the built invite-gate + Starter/Pro plans.
- **Anchors:** root `VERSION` = `1.0.0` (machine-readable source of truth); tagged `v1.0.0` on the current beta baseline (`main` @ `ea343bc`). Tag messages point back to this log (log stays the changelog).
- **Index/glossary updated:** roadmap + gtm + decisions 0011–0013 linked; glossary gains Age/Milestone/Iteration + a "Tier ≠ Age" note.

## [2026-06-26] Favicon — cave logo on brand dark square (branch n/a, site-wide asset)
Added a real favicon (was none). Self-contained `favicon.svg` wraps the actual brand logo
(`brand/logo/soundcave_logo_2026-05-11.svg`) on a `#0a0a0a` rounded square (rx 104) so the light-grey mark
reads on light *and* dark tab bars (transparent logo alone would vanish on white tabs). Generated via
`scratch/make_favicon.py` (extracts the logo's inner SVG, fits its `252 256 520 520` viewBox into a 64px-padded
512 canvas). PNG fallbacks rasterized through Playwright at exact sizes: `favicon-32.png` (legacy) +
`apple-touch-icon.png` (180, iOS home-screen). Wired into `index.html` head (SVG + 32 PNG + apple-touch +
`theme-color #0a0a0a`); `bypass.html` got the SVG link too (local-only/gitignored). Verified: all three serve
200 with correct content-types, render legibly at 16/32/64/180 on light+dark, and resolve in the live DOM.

## [2026-06-26] Mural scroll — speed-proportional drain (branch `cave-scroll-speed`)
Follow-up to the same-day cooldown fix: Doug said the one-card-per-gesture clamp was **too slow** — "the
quicker I scroll through, the faster it can go through." The flat 480ms cooldown killed *proportionality*
(every scroll cycled at one fixed rate). Replaced it with a **bank-and-drain** model in `js/cave.js`:
- `wheel` banks travel into `_caveWheelAccum` (clamped to `CAVE_WHEEL_STEP × CAVE_WHEEL_MAX_BANK`), then
  `drainCaveWheel()` releases **one card per `CAVE_WHEEL_DRAIN_MS`** via `setTimeout` until less than one
  card remains (sub-threshold remainder carries into the next scroll). So the faster/more you scroll, the
  more banks up and the more cards riffle past — **speed-proportional** — but spread over time so each card
  still glides (not 17 in one frame like the original `while` loop). Gentle nudge banks <1 step → exactly
  one card; a hard flick is capped (`MAX_BANK`) so it can't rifle the whole clan. Removed the old
  `_caveWheelLockUntil` / `CAVE_WHEEL_COOLDOWN`.
- Constants: `STEP=60`, `DRAIN_MS=110` (~9 cards/sec ceiling), `MAX_BANK=8`. Knobs for feel: `DRAIN_MS`
  (riffle speed), `STEP` (sensitivity), `MAX_BANK` (max burst).
- Verified with the **real** `drainCaveWheel` + real constants under real timers (extracted from the file):
  NUDGE→1 card; SOFT FLICK→6 over 556ms; HARD FLICK→10 over 999ms (~110ms apart = each card on its own
  timer tick → each glides). Monotonic (faster ≥ slower), bounded (~11 ceiling), gentle = one. Arrow keys
  unchanged (instant single step, bypass the drain).

## [2026-06-26] Mural scroll smoothness + glitch-button restore (branch `cave-scroll-glitch-polish`)
Two interaction-polish fixes Doug flagged (both Cave/site-wide, not Firepit → one branch).

**1. Diagonal clan stack scrolled too fast / couldn't land one-by-one.** The 06-26 wheel rewrite used a
delta accumulator that stepped one card per `CAVE_WHEEL_STEP` px **inside a `while` loop** with no
cooldown. A trackpad flick fires a long momentum tail (~1s, ~850px), so a single flick stepped through
**~17 cards** and the 600ms (`--motion-mid`) card glides never settled → fast + choppy.
- Fix (`js/cave.js` wheel handler): step **at most one card per gesture** (`while`→`if`), reset the
  accumulator after a step, and open a **480ms cooldown** (`_caveWheelLockUntil`, keyed off monotonic
  `e.timeStamp`) during which momentum deltas are swallowed. Raised `CAVE_WHEEL_STEP` 50→80. `preventDefault`
  still runs FIRST so the page never scrolls over the window (preserves the 06-26 rails behaviour).
- Verified (Node sim, faithful copies of old vs new algo on realistic streams): FLICK 851px → OLD 17
  steps / **NEW 1**; gentle NUDGE → 1/1 (responsiveness kept); DELIBERATE 2s scroll → OLD 12 / NEW 3
  (paced ~1.5/sec so each glide lands). Arrow keys bypass the lock (unchanged). Tuning knobs: `CAVE_WHEEL_STEP`
  (sensitivity) + `CAVE_WHEEL_COOLDOWN` (browse speed).

**2. Glitch-scramble action buttons stayed corrupted on a quick skim.** The site-wide hover effect
(`js/cave_entrance.js`) read the target word **live from `textContent`** (`dataset.glitchText || textContent`)
on every hover — but `dataset.glitchText` was only ever set for the login button. So skimming across a
`.btn-red`/`.btn-outline` mid-animation re-read the **half-scrambled text as the new target** and locked
the garbage in permanently (`CLAN`→`C+}?`). Only resting the mouse long enough to finish the first run
restored it.
- Fix: capture the **pristine label once** before any scramble can run — `if (t.dataset.glitchText == null)
  t.dataset.glitchText = t.textContent.trim()` — and always pass that as the target. caveGlitch always ends
  on `write(target)`, so every hover now converges back to the original word regardless of duration.
- Verified (A/B on the real `cave_entrance.js` via Playwright, synthetic mouseover/out): OLD → final
  `C+}?` (corrupted, restored:false, glitchText never set); NEW → re-skim-mid-scramble, 6× rapid skims, and
  single quick flick **all converge to `CLAN`** (sampled `CL_]`→`CLA+`→`CLAN`), glitchText captured.
- Specs touched: [cave_dashboard_redesign.md](spec/cave_dashboard_redesign.md) (scroll), [splash_cave_entrance.md](spec/splash_cave_entrance.md) (glitch).

## [2026-06-26] Stash — square format-agnostic thumbnails (branch `stash-thumbnail-crop`)
Doug flagged the Stash grid reading ragged: every Forge format outputs a different ratio (Still 1:1,
Carousel 4:5, Flyer 9:16, Animation 16:9, Poster 2:3) and each card grew to its image's native height —
a portrait flyer towered over a landscape still. The cover (`.stash-block-cover`) *intended* to crop to
`16/10 + object-fit:cover`, but it was a **flexbox** with the `<img>` as a flex child at `height:100%`;
the flex item's `min-height:auto` overrode the container `aspect-ratio`, so the box stretched to the
image. (The crop was on `main` + deployed, yet visually dead — a CSS bug, not a stale deploy.)
- **Decision (Doug):** square **1:1**, top-anchored crop (artwork is mostly portrait flyers → a landscape
  slice loses the headline; square keeps the title zone). Click behaviour **unchanged** — opens the piece
  in the Forge (the full uncropped render lives in the output panel; no lightbox built).
- **Fix** (`css/style.css`, one shared rule): `aspect-ratio 16/10 → 1/1`, `overflow:hidden`, dropped flex;
  media is now `position:absolute; inset:0` (can't stretch the box past 1:1 — root cause killed) with
  `object-fit:cover; object-position:top center`; `.stash-block-noimg` re-centres itself. Overlay badges
  (count / slide ×N / countdown / play ▶) already absolute → still paint on top. Fixes both tile builders
  (`_postTileHTML` + `_campaignTileHTML`) at once. No JS, no grid-column change → responsiveness untouched.
- **Verified:** standalone repro linking the real `style.css` with mismatched-ratio cards (1:1/4:5/9:16/
  16:9/2:3 + no-image) → Playwright @1280px: all covers identical squares, title band survives every crop,
  placeholder centres, console clean. Spec: [stash_thumbnail_crop.md](spec/stash_thumbnail_crop.md).

## [2026-06-26] Beat — waveform segment picker (branch `forge-beat-from-cave`)
Pivot of "Elements Phase 3". The spec'd P3 ("pull a SoundCloud track's audio into the Beat") hit a
wall: ripping the SC stream violates SC's API ToS (risks the access that powers scout/clan discovery)
**and** produces exactly the fingerprint-struck audio the Beat rights gate marks BLOCKED. Surfaced the
fork to Doug → he reframed it: *"assume no barriers for audio upload … a very slick feature where we
upload a track and very easily select the part of track we'd like input for the video or image."* So:
a **waveform segment picker** — the slick build of the manual clip-picker already in `firepit_beat.md`.
- **What it is:** in the Beat panel, upload a track → its waveform draws on a canvas → drag a
  fixed-width window (= the 10s clip, Doug picked *fixed window, drag* over two-handles) onto the bit
  you want → ▶ auditions just that window → forge bakes *that* segment under the still. One emitted
  value: `audio_start_seconds`.
- **Build:** new `js/beat_segment.js` (vanilla, Web Audio decode→canvas, no library; firepit.js was
  already 1476 lines). Dim-outside = a box-shadow "spotlight" on the window (no canvas redraw).
  Backend: `audio_start_seconds` → `-ss` before the audio input in `_ffmpeg_composite`.
- **Verified:** UI via Playwright on the real page (window math, drag, label, spotlight — shot
  `scratch/beat_segment_drop.png`); **seek proven functionally** — `start=0` vs `start=11` on a
  drop-heavy track → mean_volume −13.0 dB vs −5.7 dB, both 10.00s. `py_compile` + `node --check` clean.
- **Rights gate untouched** (Doug's "no barriers" = don't gate *this* slick flow; the gate still fires
  at schedule-time, the real strike-risk moment). Spec: `wiki/spec/forge_beat_segment.md`.
- **Status:** on the feature branch, pending Doug screenshot-confirm → merge to main + `railway up`.
- **Process note:** built in a dedicated `git worktree` (`thesoundcave-beat-wt`) — the lesson from the
  2026-06-25 concurrent-session tangle. A locked `invite-codes` worktree is live in parallel; no collision.

## [2026-06-22] Embers (Motion format) — R&D → live integration started (branch `firepit-embers`)
New Firepit format: **bring a finished static artwork to life** (upload art → simple text instruction → looping animation). Full spec + journey: `wiki/spec/animated_flyer.md`. Long R&D session; arc:
- **Pivoted off AI video.** i2v (LTX melted; Kling coherent but "no good" — halftone texture crawled like bugs, colour-drifted). Decision: **code-based motion, no generative video** for the animation itself. Frontier i2v shelved (revisit for photographic sources).
- **Direction (Doug):** simple, looping, holographic; **per-region** (circle the item) + **instruction-driven** (no effect dropdown in the product); reference aesthetic = **chrome/holographic** (ref videos in `scratch/embers_local/refs/`).
- **Built the engine** (prototype `scratch/embers_local/`, gitignored): effects palette (holo/prism/glow/flicker/sweep/sparkle/ripple/scan) + **`fall`** (cut figure via birefnet → drop top→bottom loop → fill vacated hole). Matched Doug's "falling man" ref3 (clean silhouette, slow float, living bg: zoom-pulse + rising particles + grain). Verdict: **"MUCH better."**
- **The void fight (hole fill):** diffusion/Telea/biharmonic all muddy or trace; generative object-removal/SDXL imperfect. **FLUX Fill (`fal-ai/flux-pro/v1/fill`, Firefly-class)** = best — keep ORIGINAL artwork exactly, fill ONLY the figure's hole. Faint trace can remain on hard cases (big central subject between conflicting colours) → Adobe Generative-Fill-on-the-still is the hero escape hatch. (Earlier mistake: replacing the whole bg lost the artwork Doug loved — reverted.)
- **Integration (this commit):** engine ported to tracked **`animation_gen.py`** (`animate()` → mp4 bytes), `numpy` added to requirements. Verified standalone. **NEXT (not built):** `/api/animate` endpoint (reuse `_debit`/`_refund` + `media_gen.save_video`) → Forge **Motion** format UI (ui-protocol) → deploy (Railway+Vercel), **gated on look-lock**. Session fal spend ≈ $4. Rotating-vinyl (ref5) effect queued next.

## [2026-06-22] Build B Phase 1 — recipe fix PROVEN (the 3 P0 flaws closed, same seed)
Fixed the flyer recipe in `media_gen.py` (no new model/overlay — pure prompt-builder), re-fired P0 on the same TECHNO HOUSE ref + seed 70707. All three P0 flaws closed in **one iteration**; Doug's verdict: **clears the bar.**
- **`_baked_text_lines` ([media_gen.py:308](../media_gen.py#L308)) rewritten:** the night/theme name is now the HERO Title; the lineup is a SECONDARY block rendered ONCE, split across the reference's lineup zones in billing order, never repeated. (Old code made the whole 12-name lineup "the biggest element" → the model fought the reference's hierarchy and stranded leftover title text.)
- **`build_restyle_prompt` text block:** added an explicit FULL-title-replacement clause ("no word/fragment of the reference's original title survives") → kills stranded leftover text (v1's dangling "HOUSE").
- **Result (v1→v2, same seed):** stranded "HOUSE" gone · the two lineup blocks now hold DIFFERENT acts (Carl Cox→Joris Voorn / Peggy Gou→Zhu) · title is hero · spelling still 12/12 · style fidelity still strong. Artifacts: `scratch/p0_baseline/p0_output_v1.png` (before) vs `p0_output.png` (after), gitignored.
- **Proves Build B's thesis:** the model was always capable; fixing the INSTRUCTION fixed the output — validates baked-in + the prep/verify direction (decision 0009).
- **Reconciled** the stale `forge_output_recipes.md` Event Poster recipe (was "backdrop-only + compositor overlay", pre-P1.5) to the baked-in reality.
- **Next:** reassess whether Phase 2 (vision prep step) is needed now or deferred — P0/Phase-1 used a *clean* ref, so the palette-inversion / distress-extraction bug classes Phase 2 targets weren't exercised yet.

## [2026-06-22] P0 baseline FIRED — dense text bakes clean; recipe (not model) is the bottleneck
Ran the real Forge recipe on a live fal call (`scratch/p0_baseline/`, gitignored): Doug's TECHNO HOUSE flyer as STYLE anchor → `build_restyle_prompt` → `JOB_RESTYLE` → `nano-banana-pro/edit` (2K, seed 70707, 40s, ~$0.15), with a **deliberately dense 12-act lineup** forced in.
- **Headline result — content trigger NOT needed.** All 12 names baked **correctly spelled** (Carl Cox…Zhu), legible at 2K. The model even **corrected** the reference's own garbles (NIVA KRAWIZ→Nina Kraviz, AMELIE LEAS→Amelie Lens, KAYTRAWADA→Kaytranada). The "diffusion can't spell a dense lineup" premise is **false for nano-banana-pro** → decision [0009](decisions/0009_baked_vs_overlay.md) evidence gate resolves: **no overlay escape hatch for density.** (`forge_output_recipes.md`'s "garbles longer text / CATURDAY" caveat was FLUX.2-era — obsolete.)
- **Model is capable; the RECIPE is the bottleneck.** Style/palette fidelity strong (cream/starfield, chrome hands, gradient blocks, red type ~identical). Three flaws, all recipe/input, not model: (1) **stranded "HOUSE"** — night name dropped in over "TECHNO" but the reference's "HOUSE" left behind; (2) **duplicate lineup blocks** — one flat `artist_list` field can't express two distinct blocks, so the model cloned it; (3) **inverted hierarchy** — `_baked_text_lines` ([media_gen.py:318](../media_gen.py#L318)) labels the 12-name lineup "the dominant display type, biggest element," which is wrong; the model overrode it (good instinct) but the fight stranded "HOUSE."
- **Doug's taste verdict: CLOSE — recipe fixes get it there.** Bar = "a promoter would post this." → proceed to Stage 1 (prove the recipe).
- **Confirms (build_plan anchors):** example-anchored path works (style fidelity via the ref); baked-in is viable; the gap is contradictory/underspecified *instructions* — exactly decision 0009's thesis, now proven on real output.
- **Stale-doc flag #3:** [forge_output_recipes.md:75-81](spec/forge_output_recipes.md#L75-L81) still says Event Poster = backdrop-only + compositor overlay (pre-P1.5). Reconcile in Build B.

## [2026-06-22] Build B — baked-vs-overlay decision recorded (decision 0009); was already shipped, not open
Read the real Forge generation path before phasing Build B (carry-over brief from Doug's external chat). Finding: **the baked-vs-overlay "fork" the brief treated as open was already decided AND shipped.** Flyers (`event_poster`) bake all event text into the image via `_baked_text_lines` ([media_gen.py:308](../media_gen.py#L308)) → `build_restyle_prompt`/`build_compose_prompt`; flyers are explicitly excluded from the overlay compositor ([js/firepit.js:730](../js/firepit.js#L730)). Overlay isn't dead — it drives Posts/Carousels (Konva [js/compositor.js](../js/compositor.js)) + the campaign auto-generator (Pillow [image_composer.py](../image_composer.py), [campaigns_api.py:394](../campaigns_api.py#L394)) — so it's available as an *escape hatch* with no new infra.
- **Decision [0009_baked_vs_overlay](decisions/0009_baked_vs_overlay.md):** baked-in = default/shipped; overlay = **constrained, evidence-gated escape hatch**, never a Canva-style text editor. Doug's governing constraint (2026-06-22): if the hatch ever needs >locked-font-set, a manual placement editor, or per-gen scene-matching → we stop and fall back to regen-on-failure.
- **Key correction:** the content-trigger premise ("diffusion can't spell a dense lineup") is a FLUX-era claim. The Flyer path now runs `nano-banana-pro/edit` ([media_gen.py:765](../media_gen.py#L765)) — strong at multi-line text. So the content trigger is **gated on a P0 dense-text stress test**, not built in. Bakes clean → no hatch. Garbles → hatch only under the Canva-line limits, else regen-on-garble.
- **Four open Qs answered vs code:** Q1 flyers DO carry dense text by design (lineup + set-times + door/curfew + tickets); Q2 prep = a *vision* pass that doesn't exist yet (today's prompt-building is text-only); Q3 no verification exists — split = OCR-back-check + palette automated, hierarchy/aesthetic human; Q4 no per-style store exists — model as a `brand_kits` sibling.
- **Stale-wiki flags:** (1) [build_plan](build_plan.md) said "Stage 0 not started" but the studio went live 2026-06-22 — P0 baseline still un-fired (acceptance gate open), so next step unchanged; (2) [glossary:43](glossary.md#L43) WHO "carbon-copy, never redrawn" is stale — reversed in code 2026-06-18 ([content_api.py:935](../content_api.py#L935)). Not yet fixed.
- **Next:** P0 baseline (real tech-house flyer + dense-lineup stress test) is the evidence gate. No code this turn — decision-page only.

## [2026-06-22] Embers (Animated Flyer) — spec drafted + Phase 0 Stage-B spike → GO (with nuance)
New feature request: animate an approved flyer for social, text/logos pixel-frozen. Spec: `wiki/spec/animated_flyer.md` (working name **Embers**). Doug picked the **generative-i2v** path over the shipped Phase D Ken Burns path; greenlit spec-first, then a Phase 0 spike on the make-or-break (Stage B: layer separation on a flat baked-text flyer).
- **Spike** (`scratch/embers_p0_spike*.py`, gitignored) on a real baked-text techno flyer (`phaseA_direction_test.png`). Tested 3 Fal approaches:
  - ❌ `evf-sam` text masking → coarse semantic **blob** (48% coverage), not glyph-accurate.
  - ❌ general `object-removal` → **hallucinated** a blue smear, only caught one text block.
  - ✅ **`fal-ai/image-editing/text-removal`** (dedicated) → genuinely **clean text-free plate** in one ~10s call: text gone, red texture reconstructed behind it, smileys/mascot/graphics correctly kept, no smears.
- **Masking trick:** the remover is a diffusion edit (whole image re-renders subtly), so the text mask is derived from `diff(source, plate)` at a **high** threshold (text = black→bg ≈150+ change; re-render noise ≈28-50) + despeckle + dilate → captures all text blocks. Over-captures some graphics/halftone, but **over-freezing is safe** (never warps text; arguably the right behaviour — freeze all designed marks, animate only the atmospheric field).
- **Result:** recomposite **visually identical** to source; byte-identity in mask region = **max diff 0** (by construction — exact source pixels stencilled back through a binary mask). Artifacts: `scratch/embers_p0_v2/{0_source,1_mask,2_plate,3_text_layer,4_recomposed}.png`.
- **Stage B VERDICT — GO.** Two caveats: (1) diff-mask over-captures graphics, but over-freezing is safe; (2) i2v payoff is style-dependent.
- **i2v VALUE TEST (same day)** — ran the full chain (plate → i2v → frozen-text overlay) on an atmospheric flyer (`cowgirl_dj_v2.png`): ❌ **LTX melted** the scene to mush in 5s + cropped to landscape (cheap-tier i2v dead); ✅ **Kling v2.5-turbo** gave coherent subtle motion (the DJ mixes, atmosphere breathes, no warp, portrait kept, text crisp) — a usable animated flyer, clearly more alive than a Ken Burns zoom. **Decision: build Phase 1 with Kling-class i2v as primary; never LTX.** Spend this session ≈ $0.40 fal. Clips for Doug to watch + make the aesthetic call: `scratch/embers_i2v/embers_kling_overlay.mp4` (Kling), `embers_i2v_overlay.mp4` (LTX, bad), `embers_kenburns.mp4` (baseline). Spike scripts: `scratch/embers_*.py` (gitignored).

## [2026-06-22] 🚀 Forge studio LIVE — forge-output-ux merged to main + deployed (Railway backend, Vercel frontend)
The campaign studio (`forge-output-ux`, 35 commits) shipped to production via the **safe staged path** — Doug's call to push it live now, at its current output quality. The branch was **28 commits behind live `main`** (tracking v2 Phase 1+2, CORS hardening, SoundCloud token-refresh, health watchdog), so a direct merge would have regressed the live tracking pipeline + a security fix.
- **Caught up first (on the branch, not on live):** merged `origin/main` → `forge-output-ux`; only conflict was this log file (both sides appended — all entries kept). Git auto-merged the Supabase/tracking code cleanly. Verified: 0 origin/main commits missing from forge, all Python compiles, gitleaks clean. Safety backup at branch `forge-output-ux-pre-sync-backup` (8b81b79).
- **Backend (Railway — manual `railway up`, does NOT auto-deploy from git):** deployed merged code to `soundcave-api`/production. Confirmed `● Online`; `/api/avatars` 401 (studio) + `/api/tracking/health` 200 (catch-up) both serving. FAL_KEY + studio keys confirmed present (names-only check, no values exposed).
- **Frontend (Vercel — auto on push to `main`):** fast-forwarded `main` cb2d669 → 74794dc, pushed (gitleaks: 35 commits, no leaks). Studio JS (`spirits`/`brands`/`firepit.js`) serving 200; CORS verified — live API returns `access-control-allow-origin: https://thesoundcave.vercel.app`.
- **⚠️ OPEN ACCEPTANCE GATE (Doug):** the real end-to-end flow — log in → Forge → generate a flyer (fal spend) — has NOT been fired. Deploy is mechanically live + wired; "live" ≠ "proven working" until a real generation succeeds. Rollback = `forge-output-ux-pre-sync-backup` + Railway previous deployment.
- **⚠️ Known gap shipped:** the Forge output-quality misses diagnosed this session (clean-vs-distressed font, red→orange palette inversion from contradictory direction, flat text hierarchy) are UNADDRESSED. Going live did not fix them.
- **Parked follow-up (designed this session, not built):** a pre-generation **prep/verification step** — vision auto-detect of the reference's typography + contradiction-catch (would have caught the red-vs-orange conflict) + seed-lock + reference-weighting. Decision: keep text **baked-in** (scales to the Etchings gallery; overlay kept only as a per-style escape hatch). Spec to be written.

## [2026-06-18] Clan grid polish + star-vanish bug fix
From Doug's Clan + modal screenshots. Spec: `wiki/spec/clan_grid_polish.md`.
- **Star-vanish bug FIXED (root-caused):** `toggleStar` wrote `starred` only to local `sc_favs`, but `roster_sync.loadRoster()` overwrites `sc_favs` from the account on refresh, and the backend roster never stored `starred` → stars (and unsynced artists) wiped. Fix = stars now live in a **separate `sc_starred` key** that loadRoster never touches (+ `pushArtist` on star so the artist stays synced). Migration-free, backend-free. Reproduced the bug in Playwright and confirmed the fix. **Trade-off:** stars are device-local until a `roster.starred` column is added.
- **Starred artists float to the top** of the Clan grid; star is now brand-**orange** (`★`, was gold `⭐` emoji) and persists.
- **Platform icons → 4×2 grid** on clan cards + modal: **SoundCloud always first + orange** (the source link), all other platforms shown (was sliced to 5), **linked recoloured green→orange**. Modal SC moved into the grid (separate `#panelSCLink` logo removed; SC visible on read-only views too).
- **Removed** the "Tracked Xd" line from clan cards; **uppercased** the sort buttons (Name/Followers/…) + the top-right trend label.
- **Files:** `js/app.js` (star helpers + modal grid), `js/clan.js` (star, grid, starred-top, drop tracked), `css/style.css` (grid, orange linked, uppercase, orange star), `index.html` (removed panelSCLink). Playwright-verified, 0 console errors.

## [2026-06-18] Artist modal v4 — header reflow + drag-reorder tracks + cut/remove clarified
From Doug's BLAM! modal screenshot. The shared `#artistPanel` (Mural + Clan + Foraging + Footprints — one component) got a five-part redesign. Spec + build notes: `wiki/spec/artist_modal_v4_header_reflow.md`. **3-way picker sign-off.**
- **Two-column header:** identity (avatar, name, `genre · location`, SoundCloud **logo** replacing the old "SoundCloud ↗" text, platform marks) left; **Notes moved up** beside it, right.
- **Tracks** now **drag-to-reorder** by preference (`⠿` grip, HTML5 DnD → persists `preferred_tracks`, sorts preferred-first). Heading "Suggested tracks" → "Tracks".
- **Cut vs Remove clarified** as icon buttons (orange hover): ✂ **Cut** now moves the artist to the **Watch list** (`status='cut'` + added to `sc_watching`, record kept so Restore reverses it); 🗑 **Remove** = permanent delete (red).
- **Location:** backend `artist_stats` returns `city`/`country` (cache-miss response, no DB migration); frontend shows it when shared. Frontend display verified; live SC fetch not yet proven.
- **Files:** `index.html` (panel markup), `js/app.js` (renderPanel reflow + drag + toggleCut→watchlist + refreshArtistLive location), `js/icons.js` (soundcloud/download/location/grip), `css/style.css` (two-col header, icon-btn, grip), `content_api.py` (location in response).
- **NEXT pass (needs Doug's SoundCloud profile URL):** swap the track list to Doug's *real* SoundCloud likes of each artist — likely readable via the existing app token (public likes), no full OAuth. Reorder UI already in place.
- **Verified** via Playwright (8 seeded clan): reflow, SC logo, `genre · London, GB`, 7 grip rows, drag persists + re-applies, Cut→watchlist + Restore, Clan opens the same modal, 0 console errors.

## [2026-06-18] Cave clan-aggregate chart → interactive single-metric + stat-card cleanup
Doug's mural screenshot: the bottom "Weekly stats · clan aggregate" strip looked broken (flat lines, oversized axis numbers, not clickable) and the stat cards carried a noisy "· 9/18 tracked" tag. Fixed both. Spec + full build notes: `wiki/spec/cave_chart_interactive.md`.
- **Chart rebuilt as one-metric-at-a-time** (Doug picked this model). Legend chips (Followers/Likes/Listens) are now buttons; click swaps the chart to that single series, auto-scaled to its own range so it never flatlines. Default Followers; Pl. Adds = disabled "soon" chip. Hover a point → floating tooltip (value + date), clamped inside the strip.
- **Three root-cause fixes:** (1) data source switched from the noisy 2-point weekly `allReports` to the clean daily snapshots via `caveAggregateSeries()`; (2) single series instead of 4-on-one-axis (which crushed everything but Followers flat); (3) render at the canvas's real pixel width so axis text stays ~9px instead of being upscaled to ~18px.
- **Stat cards:** removed the `· X/Y tracked` coverage tag from `renderStat`; kept "▲ +17 this week". Playlist Adds stays "coming soon" untouched.
- **Files:** `js/app.js` (`buildLineChart` gains optional `opts={interactive,unit}`, back-compatible), `js/cave.js` (`renderCaveChart`/`drawCaveChart`/`wireCaveChartHover` + coverage-tag deletion), `css/dashboard.css` (`.strip-chip`, `.strip-canvas`, `.chart-tip`).
- **Verified** via Playwright (8 seeded clan, 3 snapshot days): metric switch + auto-scale (Followers ~20.6K band → Likes 621→148.8K), tooltip clamped, 9px axis, cards clean, 0 console errors. Screenshots: `scratch/cave_chart_followers.png`, `scratch/cave_chart_likes_tip.png`.

## [2026-06-12] Phase E (part 1) — Spirits become forged cartoon characters
Doug's complaint ("Spirits not good, untested") addressed: a Spirit is now a **forged cartoon persona**, not a raw photo set.
- **`POST /api/avatars/<id>/forge-character`** (avatars_api): runs the Spirit's reference photos + description through Nano Banana (`compose_person`) → a clean illustrated mascot on a neutral bg → saved as `character_url` + `preview_url`, and led into `reference_image_urls` so the Forge composes from the LOCKED character (resilient if `db/0019` isn't applied yet — degrades to preview only).
- **MARKS UI** (`js/spirits.js`): each Spirit card gets FORGE CHARACTER / RE-FORGE; forged Spirits show a ✦ badge + "character forged". Summon nudges "now forge its look".
- **`db/0019_spirit_character.sql`** (additive ALTER — Doug to apply): `character_url` + `linked_artist` (the artist↔Spirit connector hook for Phase E part 2).
- **Security:** commit security review flagged SSRF on the Phase D `base_image_url` fetch — fixed: `_is_own_storage_url` restricts the fetch to our Supabase Storage host over https, `allow_redirects=False` (7/7 unit checks: metadata-IP / localhost / host-confusion all rejected).
- **Still open in Phase E:** artist-connector pulls (Clan→lineup multi-select, Cave-facts→copy expansion, Spirit auto-attach on the artist profile, Beats→audio menu, output tagging→Footprints). Mechanism shipped; aesthetic of the forged character is **Doug's eye to judge** on a real run.

## [2026-06-12] Phase D — SOUND + VIDEO shipped (flyer/still → pulses to the track)
The flagship flow: generate a still → **+ ADD A BEAT** → composite MP4 that moves to the music. Built on the existing `/api/generate-media` + Beat rights gate (no new infra):
- **Animate the EXISTING still:** `generate_video_composite(..., base_image_bytes=)` + endpoint fetches `base_image_url` (the just-generated image) instead of regenerating a cover — "make THIS flyer move". Falls back to regen if the fetch fails. Video uses the L7 size (default 9:16).
- **Beat UI** (Forge output): ADD A BEAT reveals on single-still formats → panel: audio upload + **rights classifier** (7 categories) + proof link. Frontend mirrors the server gate — postable categories require proof before forging; blocked categories (major-label / app-sound-rip / undocumented) still generate but the result is flagged "can't be scheduled" (matches the platform-fingerprinting reality). Output swaps to an autoplay-loop `<video>`; DOWNLOAD grabs the MP4.
- **Verified:** compiles; **live composite** (`scratch/phaseD_beat_video.mp4`) — animated the Phase C still + a tremolo test tone → 8s 1080×1350 h264+aac, `composite+still` (not regenerated), 4s render; browser: button reveals on Flyer/Still (hidden on Carousel), panel toggles, 8 rights options, clean console.
- **Standard/Premium AI-video tiers** (~$0.10/$2) remain wired in the backend behind the same endpoint — surfaced to the UI in a later pass; composite is the default and the flagship.

## [2026-06-12] Phase C — WHO CARBON-COPY shipped (people pasted, never drawn)
The carbon-copy law (glossary, 2026-06-12) is now real pipeline. WHO photos are SPLIT OUT of generation in `content_api` (`who_refs` vs `ctx_refs`), the design renders without them, then each person is composited on top:
- **`remove_background`** (media_gen) — cutout via fal `birefnet/v2` (~$0.002, ~1s) → transparent PNG.
- **`composite_who`** — PIL `alpha_composite` paste, pixel-true; the person is NEVER redrawn. `_parse_placement` reads the binding Direction as a keyword contract: anchor (top/bottom/left/right/centre + corners), scale (tiny/small/large/huge → 0.18–0.85 of canvas height), grayscale (b&w/monochrome → desaturate keeping alpha). Defaults bottom-right, 45%, colour.
- **Routing:** `job_type_for` — `who` no longer enters generation; **`spirit`** (drawn cartoon character) is what routes to `compose_person`. Best-effort: a cutout failure leaves the design intact (no 500); response echoes `who_composited`.
- **Verified:** 6/6 units (placement parse, real PIL paste pixel-true bottom-right, top-left untouched, grayscale desaturate) + **live end-to-end** (`scratch/phaseC_who_composite.png`): synthetic test figure → real birefnet cutout → composited bottom-left + B&W exactly per the Direction, and it's the EXACT input pixels, not a redraw. (Test subject was a placeholder drawing — real photos give a real person pixel-perfect.)
- **Frontend:** WHO chip already travels role-tagged from `forge_refs.js`; the split happens server-side, no UI change needed this phase.

## [2026-06-12] Phase B — REAL CAROUSEL shipped (multi-still, one locked style)
Rolling phase rollout per Doug ("one after the other"). Carousel now produces a genuine SET:
- **Copy:** slide-count picker (2–10, default 5) → `n_slides` → copy writes EXACTLY n slides.
- **Images:** one per slide — frontend loop (`generateCarouselImages`) with ONE shared seed; `_slide_block` adds series-consistency ("identical palette/grid/motif, only focal content changes") + bakes the slide's own line on the nano routes (backdrop route stays text-free per its system prompt; slide text rides the caption there). Carryover-killer added to the slide path.
- **UI:** progress per slide → slide strip (thumbs, click to switch, active highlight); NEW IMAGE retakes the ACTIVE slide (fresh seed); lightbox works per slide.
- **Stash:** sets ride in `context.slideUrls` (metadata JSON, no migration); tile gets a ×N badge; reopen restores the strip.
- **Verified:** 8/8 units; live 3-slide set (`scratch/phaseB_slide{1,2,3}.png`, seed 7777): **style locked across all three** ✓, slide text exact on every slide ✓; known restyle small-print carryover appeared on the set (same tension as Phase A — clause added, re-test on Doug's next run). Browser: picker toggles per format, strip renders, active-switch works, no new console errors.

## [2026-06-12] Phase A — Context Stack alignment SHIPPED (build plan lives in Notion §13)
The Forge build now follows the [master spec](spec/forge_context_pipeline.md) ([Notion workbook](https://app.notion.com/p/37d1a74e117981aa9e8cfce3b0425672) §13 = the 5-phase plan: A Stack alignment ✅ · B real carousel · C WHO carbon-copy · D sound+video · E spirits+artist connector). Commits `69ec03b` (backend) + `0a6df75` (frontend) + prompt-precedence fix, branch `forge-output-ux`.
- **Additional Context = director's notes:** `_parse_additional_context` (Haiku) splits the box into FACTS (fill empty slots, typed wins) + DIRECTION (binding) + MOOD; **200-char image-path clip is dead**; parse failure → whole box becomes direction (never dropped).
- **Prompts assembled in Stack order** (intent → style law → subjects → quoted facts → direction → mood) across restyle/compose/backdrop; `_direction_block` is the binding-instruction block.
- **Form walks the Stack:** 1·Format(+Size 4:5/9:16/1:1) → 2·Style(refs, brand w/ steps-back hint) → 3·Subject(Spirit·artist) → 4·Facts → 5·Direction&Mood. "Post"→**STILL**. `forgeDynamicFields` split into Subject/Fact containers, value-preservation kept.
- **Verified:** 10/10 units (real Haiku parse split direction/mood/facts correctly) + 10/10 browser E2E + **2 live alignment-law generations** (`scratch/phaseA_direction_test*.png`): facts law ✓ perfect text both runs; style law ✓; **direction law PARTIAL** — moves prompt-named elements (headline → bottom-right ✓) but loses wholesale composition fights ("empty the top third") against the style ref, even after a precedence clause. **Known tension, tuning levers queued:** lead prompt with direction / route direction-heavy restyles via compose. Doug to weigh (touches Stack-order principle).
- **Ops gotchas hit:** the parallel session's worktree servers (`/tmp/sc_phase2_wt`) had taken ports 3000/8000 serving stale code — reclaimed; browser JS cache needed force-revalidation; `run.sh` kills its children when backgrounded (trap on EOF) — servers now launched via nohup directly.

## [2026-06-11] Forge P1.5 — style-first gen, baked text, output rework (Doug's live verdict actioned)
Doug tested P1 live and rejected the output quality. Spec updated ([spec/forge_context_pipeline.md](spec/forge_context_pipeline.md) P1.5). Four commits on `forge-output-ux`:
- **Vanishing-fields bug FIXED (`894753a`)** — root cause was NOT the upload: closing the file picker refocuses the window → supabase-js re-emits SIGNED_IN → roster_sync → refreshCurrentTab → updateForgeFields innerHTML wipe. Fix: value-preserving rebuild (snapshot/restore by id) + roster only reloads on a genuine user change + editStashItem now restores venue/city/date/doors/curfew/tickets.
- **Style-first generation (`3b76c9f`)** — bake-off 2 (`scratch/forge_bakeoff2/`, 6 calls, Doug judged): **Nano Banana Pro 2K wins** (style fidelity + perfect typography both seeds; FLUX flex mangled type; FLUX pro garbled small print 1/2). JOB_RESTYLE → `nano-banana-pro/edit`. `build_restyle_prompt` REVERSED: "strip all text → backdrop" became "recreate this exact design, replace ALL text" with per-line quoted strings (`_baked_text_lines`) + carryover-killer for reference small print. `build_compose_prompt` → narrative prose (Google guidance) — the terse role list underperformed. **Payload bug fixed**: nano endpoint ignores `image_size` — every avatar/person call had silently run at auto-ratio 1K; now `aspect_ratio` 4:5 + `2K` + png.
- **Output rework (`2274447`)** — image on TOP, caption below; 3-variant pick step killed (straight to output, REGEN to iterate); button wall → SAVE TO STASH · REGEN · NEW IMAGE · DOWNLOAD · DISCARD; click-to-zoom lightbox; **flyers no longer mount the Konva compositor** — text is baked in (overlay stays for brand-kit Post/Carousel; `compositor_overlay_forge.md` superseded for flyers). Deleted: enhanceDraft, saveDraftAsTemplate (create-templates path — restore inside Marks if missed), copyForgeOutput, buildPosterOverlay, variant CSS. firepit.js 1119→892.
- **Verified:** 18/18 prompt/payload units; 8/8 browser checks (fields survive both wipe paths, DOM order, buttons, lightbox, discard, dead symbols gone). **Acceptance gate = Doug's real Flyer generation against his style refs.**

## [2026-06-11] Forge context pipeline P1 + formats 5→3 (shipped, browser-confirmed)
Branch `forge-output-ux` (naming rule: branches say what's being built now — workspace CLAUDE.md). Spec: [spec/forge_context_pipeline.md](spec/forge_context_pipeline.md), signed off same day (4 calls: auto-guess+tap-to-fix roles · style ref wins over brand · combined P1 pass · WHO/WHERE/WHAT/STYLE labels).
- **Formats consolidated 5→3 (`084de16`):** picker = Post / Carousel / **Flyer** (`event_poster` relabeled; `event_promo` + `artist_bio` retired display-only — `contentTypeLabel()` keeps legacy Stash items readable, `LEGACY_TYPE_FALLBACK` reopens them in the nearest current format). Internal keys untouched; backend/compositor/DB unchanged. Bio returns later as a Spotlight mode inside Post.
- **Role-tagged references (`b0a507a`, the core):** every upload gets a WHO/WHERE/WHAT/STYLE chip — auto-guessed by Haiku vision (new `/api/classify-ref`, fail-safe to STYLE), click chip to cycle, ✎ for a note ("my logo"). New `js/forge_refs.js` (took the upload machinery out of firepit.js: 1119→1049 lines).
- **Compose routing (media_gen):** any WHO → `compose_person` (Nano Banana Pro /edit, ≤14 refs, best person-consistency; Spirits enter as WHO refs); mixed roles no person → `compose` (FLUX.2 /edit); STYLE-only → proven `restyle`; no refs → backdrop. `build_compose_prompt` names each image's job ("Image 1 is a PERSON to feature…") — Doug's me+palace+crown+flyer composition is now one call.
- **Style law:** an uploaded STYLE ref outranks the brand palette (brand cue dropped from restyle + compose prompts when style ref present; brand still leads otherwise).
- **Freeform fact-mining:** `_merge_freeform_facts` (Haiku, strict JSON) extracts venue/city/date/doors/curfew/tickets/lineup from Additional Context to fill EMPTY structured slots only — typed input always wins. Echoed in the response as `extracted_facts`.
- **Verified:** 18/18 routing+prompt unit checks; 10/10 normalize+extraction (real Haiku calls — pulled "Canning Town"/"11pm"/"£15 first release"/lineup from a paragraph, left typed venue alone); browser-confirmed chips render + cycle + payload roles correct, 0 console errors. Screenshot `scratch/forge_role_chips3.png`.
- **NOT yet live-fired:** a real compose generation (fal spend) — Doug's 4-image test (me + palace + crown + loved flyer) is the acceptance gate, to run on his account.
- **Next (parked in spec):** P2 real multi-image carousel (IG ≤20, TikTok ≤35, optimal 5–8); P3 post-generation reveal + button reshape (hero = poster reveal).

## [2026-06-12] 📊 Clan Data Tracking v2 — Phase 2 LIVE (Footprints A&R redesign + accurate data on prod)
Shipped + deployed (frontend Vercel `bb0e7a2`, backend Railway). Footprints now reads the accurate Supabase tracking series; the old static-JSON path is the signed-out fallback only.
- **Chart cutover:** `app.js init()` loads `/api/tracking/snapshots` when signed in (5 days incl. 06-12); `syncDailySnapshots` rebuilds daily points from the API so server-side corrections propagate; failed/partial points excluded so they can't fake jumps.
- **Footprints rebuilt for A&R:** WHOLE CLAN aggregate is the default chart; GENRE + ARTIST dropdowns; UPPERCASE metric toggle (FOLLOWERS/PLAYS/LIKES/REPOSTS); MOVERS leaderboard with its own FOLLOWERS/PLAYS toggle and clickable rows; artist name is a white→orange hover hyperlink to SoundCloud; report builder popover (whole clan / per genre / per artist → CSV, artist scope = day-by-day series). Spec: `spec/footprints_clean_chart.md`.
- **Live headline:** new `GET /api/tracking/artist/<key>/live` fetches current stats by the STABLE numeric id; headline shows the live value + green ● LIVE so it matches soundcloud.com exactly (verified on prod: 81zaki 831 = SoundCloud). Chart line stays daily history.
- **Chart hover tooltips** (date · value); fixed a clipping bug where top-of-chart tooltips rendered off the top edge — now flip below.
- **Data accuracy resolved (not a bug):** verified 81zaki against SoundCloud's API — we match to the play at 07:00 capture; the "wrong numbers" were snapshot-vs-live drift. Authoritative contract written: `spec/tracking_metrics_definitions.md`. SKH legacy rows confirmed wrong-user (different account) and marked failed with Doug's approval.
- **Process hazard hit again:** the parallel Forge session's servers grabbed :3000/:8000 and served a stale build mid-review; reclaimed ports + bumped mtimes. One session driving the local app at a time.
- **Still open:** Phase 3 screenshot-ingest lane (playlist adds + other platforms); Phase 4 retire GH-Actions/static pipeline after ≥3-day parity.

## [2026-06-11] 📈 Clan Data Tracking v2 — Phase 1 LIVE (registry + robust collector + Supabase time-series)
Spec: `wiki/spec/clan_data_tracking_v2.md` (approved via plan sign-off). Commit `deb67e7`, deployed to Railway. The "data I can't trust" problem diagnosed and fixed — it was our pipeline, not SoundCloud:
- **Root causes found:** display-name `/resolve` (fails on spaces/unicode — 12/20 scouted artists never tracked; worse, `Lucki`/`BELFORT`/`TREMUR` in old snapshots were a *different user's* numbers); failed fetches stored as zeros; pagination failures silently undercounting; tracker reading stale weekly reports instead of the Clan roster.
- **Shipped:** `db/0019` (`tracked_artists` registry + `artist_snapshots` time-series + `snapshot_runs` log); `tracking_collector.py` (identity = numeric SoundCloud user id resolved once from `artist_url`; retries w/ backoff; **failed ⇒ NULL metrics, never zeros**; partial pagination flagged; resume-safe upserts); `tracking_api.py` (`/api/tracking/snapshots` mirrors the legacy static shape for a one-line Phase 2 cutover; `/artist/<key>/series`, `/run`, `/runs`, `/artists`); scheduler cron 07:00Z + hourly catch-up inside `_start_executor()`.
- **Backfill:** registry seeded — **10/10 Clan+Watching artists resolved**, incl. every previously-impossible name ("Mulda (NL)", "Blam!", "𝐇𝐚𝐭𝐬𝐮𝐦𝐢 𝐂𝐡𝐚𝐧"); legacy snapshots imported with honesty flags (wrong-user rows → `failed`, 05-12 undercounts → `partial`).
- **Calibration vs public SoundCloud pages: EXACT.** Followers 4/4 exact (Blam!, real Lucki, Mulda (NL), James Ray); Blam! per-track plays hand-summed from public pages = 807 = ours, to the play. Negative test: invalid id ⇒ `failed` + NULL metrics, omitted from the snapshots endpoint (gap, not zero-dip). First full collection run: 10/10 ok.
- **Verified live post-deploy:** health 200, tracking routes 401-without-auth, Railway log shows `tracking cron=07:00Z + hourly catch-up`. Data accrues daily from tomorrow.
- **Next:** Phase 2 frontend cutover (charts read `/api/tracking/snapshots`; clean toggle chart in Footprints), Phase 3 screenshot-ingest lane (extract→confirm→image deleted), Phase 4 retire GH-Actions/static pipeline (needs ≥3-day parity window — keep dual-running until then).

## [2026-06-11] 🔒 CORS hardened — API restricted to known origins (deployed + live-verified)
- `content_api.py`: `CORS(app)` (open to any origin) → `CORS(app, origins=[https://thesoundcave.vercel.app, http://localhost:3000, http://127.0.0.1:3000])`. Vercel *preview* deploys are deliberately not allowed — test against prod or localhost. Commit `9aa16f9`.
- **Deploy fact worth remembering:** Railway does NOT auto-deploy from GitHub pushes — deploys are CLI uploads. Recipe: `railway link -p 1d496daa-30f8-45e3-af72-5bb478b2790f -e production -s soundcave-api && railway up`. Deployed from an isolated `git worktree` of `main` so a parallel session's WIP couldn't ride along.
- **Live-verified post-deploy:** preflight from `evil.example` → no `access-control-allow-origin` header (refused); from the prod origin → allowed; real data endpoint (`/api/artist/dazegxd`) 200 with the correct header; health 200.
- Closes open item 3 of the handoff list below. Remaining: snapshots-via-API, favicon 404.

## [2026-06-11] ✅ Auth-redirect blocker closed — login verified on prod (no change needed)
The handoff's "DO THIS FIRST" item (Supabase Auth URL config) turned out to be **already configured** — Doug had set it himself. No config was changed; this session *verified* it end-to-end on production:
- `scAuth.signInWithEmail('…')` fired from `https://thesoundcave.vercel.app` → `{}` (no "invalid redirect URL").
- Magic-link email inspected via Gmail: `redirect_to=https://thesoundcave.vercel.app/` ✅.
- Supabase `/auth/v1/verify` bounces to the prod origin (even on a bad token it landed on `thesoundcave.vercel.app/#error=…`).
- Doug clicked the real link from his inbox and logged in on the live site ("seems to be working good").
Also observed: prod now serves **4** daily snapshots (CI fix accruing as designed); minor `favicon.ico` 404 on every page load (cosmetic, open). **Gotcha:** reading a magic-link out of Gmail via the Gmail MCP mangles the token — for Playwright logins use the admin `generate_link` API instead.
**Remaining open (re-ranked):** CORS hardening → snapshots-via-API → favicon. Item 1 of the handoff list below is closed.

## [2026-06-11] 🧭 SESSION HANDOFF — dashboard viz + deploy hardening + OPEN items
> Resume point for switching tools/sessions. Read this + [decisions/0007_backend_live_on_railway.md](decisions/0007_backend_live_on_railway.md) first.

**Shipped this session (all on `main`, deployed):**
- **Artist modal v3** — numeric stats → 4 sparkline metric tiles (followers/plays/likes/reposts, click a tile to switch the chart); manual data entry + `followers_override` deleted everywhere; top-5 suggested tracks (new `/api/artist` `top_tracks`); brand-orange SVG star. Spec: `spec/artist_modal_v3_visual_stats.md`.
- **Cave drill-downs** — graphic-first modals (clan-aggregate line chart + movers; genre donut; framed empty-baseline). Hover = CSS ring only (dropdown removed); detail on click. Spec: `spec/cave_drilldown_graphics.md`.
- **Cave dashboard → rails layout** — overlay corners → 3-column grid (panels in left/right rails, artist stack in centre stage); overlap impossible; bigger. Spec update in `spec/cave_dashboard_redesign.md`.
- **Backend LIVE on Railway** — see decision 0007. `soundcave-api-production.up.railway.app`; frontend wired via `js/config.js` (`scApiBase()`); verified end-to-end from prod.
- **CI fix (`af68b8e`)** — Daily Clan Tracker + Weekly Scout were failing ~5 days: job ran fine but `git push` 403'd (read-only `GITHUB_TOKEN`). Added `permissions: contents: write` to both workflows. Verified green via manual branch run.
- **Charts-on-prod fix (`9b95612`)** — `.vercelignore` was hiding `data/snapshots/` from the Vercel bundle → chart data 404'd → empty charts. Removed the exclusion; prod now serves snapshots (verified 200). Combined with the CI fix, fresh snapshots land daily.

**⚠️ OPEN / NEXT (do these to finish):**
1. ~~**Supabase auth redirect**~~ ✅ CLOSED 2026-06-11 — was already configured; verified live (see entry above). In the Supabase dashboard → Auth → URL Configuration (project ref `agmmdrqmjywggtsycsri`): set **Site URL** = `https://thesoundcave.vercel.app`; add **Redirect URLs** `https://thesoundcave.vercel.app/**` and `http://localhost:3000/**`. Frontend uses `origin+pathname` as `emailRedirectTo`/reset `redirectTo` (`js/lib/supabase.js`). Until set, magic-link / password-reset redirects fail on prod. Verify by firing `scAuth.signInWithEmail` from the live site (expect no "invalid redirect URL").
2. **Live charts need data** — populate only with ≥2 snapshot days AND the artist in your Clan. 3 days on record now (05-12, 06-09, 06-10); accrues daily via the now-fixed tracker.
3. ~~**CORS hardening**~~ ✅ CLOSED 2026-06-11 — restricted + deployed (see entry above).
4. **Snapshots delivery (proper)** — current fix ships static JSON in the Vercel bundle (only refreshes on redeploy). Better: serve from `content_api`/Supabase (decision 0007 follow-up #2).
5. `APP_BASE_URL` on Railway set to `https://thesoundcave.vercel.app` (Stripe/reset redirects).

**State:** work branch `phase-3-v0.6`, merged to `main`, both pushed. Railway env has 13 vars (CLI-pushed from workspace `.env`; `SOUNDCLOUD_OAUTH_TOKEN` omitted/optional; `DEV_USER_ID` deliberately unset in prod). Note: a parallel session has been doing Forge work in the same repo — coordinate before big merges.

## [2026-06-10] 🚀 LIVE: full product on production + Forge inputs wired into image gen
**S0UNDCAV3 is now a working product on the public internet.** Verified end-to-end on production: `thesoundcave.vercel.app` (Vercel) → `soundcave-api-production.up.railway.app` (Railway, health 200, CORS pass) → real Forge generation (Claude copy + FLUX.2 restyle via fal) → Supabase Storage → compositor overlay. First production poster: `scratch/forge_confirm/live_poster_first.png`.
- **Input-usage fixes shipped (`5bea4b2`)** — actioned the audit same-day at Doug's direction: `_vibe_cues()` appends genre/theme/freeform/voice-energy/brand-palette to the restyle prompt (style-only framing); `build_image_prompt` gains lineup, venue·city setting, voice energy, brand palette; `gatherForgeContext` sends `ctx.brand`; `job_type_for` routes Spirit-on-non-bio to FLUX.2. **Visually proven:** same pink reference flyer + S0UNDCAV3 kit → brand orange-on-black poster (`vibe_poster_v1.png`). Audit finding 3 corrected in the page (Post+refs already restyled; real hole was Spirit-on-Post).
- **Deploy chain:** other session prepped Railway (`24a5c5b`) + pointed frontend (`8c307d0`); Doug ran the Railway dashboard deploy; merged to `main` (`643e6c6`) → Vercel production READY.
- **Observed:** brand palette outweighs freeform colour cues when both set (acceptable — brand should win). API-status pill shows "Not connected" on cold start (3s timeout race; recheck succeeds) — minor, add a retry later.
- **Next (Doug):** full live review of the product → informed pass on the post-generation buttons (hero = poster reveal) + GTM push.

## [2026-06-10] Forge input-usage audit — Doug's "inputs aren't used" hypothesis confirmed (findings only)
Read-only audit, no code changed: `wiki/spec/forge_input_usage_audit.md`. Headline: the **restyle path runs a constant prompt** (since `f5eeebc` literally only the reference image reaches FLUX.2 — freeform/genre/voice all discarded); the **backdrop path never receives lineup, structured event fields, or brand kit**; **Post drops reference images at the model** (Seedream ignores `image_refs`). Fix directions captured in the page — to be actioned after Doug's full live review. Also parked there: post-generation button reshape (Doug hates the 10-button wall; hero = the poster reveal; decide after review).

## [2026-06-10] Cave dashboard → rails layout (overlap killed, bigger, click-only drill-downs)
- **Why:** Doug (mural screenshot): floating corner panels overlapped the artist thumbnails; wanted tidier/bigger/no-overlap (scrolling fine). Also disliked the hover *dropdown* (top-movers tooltip) — keep the orange hover ring + lift, detail on click only. Chose "side rails" over "bigger floating glass". Spec: `wiki/spec/cave_dashboard_redesign.md` (Update 2026-06-10).
- **What shipped:** `.cave-hero` overlay → 3-column grid (left rail: Followers/Listens/Genre · centre stage: artist stack · right rail: Likes/Playlist/New Drops). Overlap now impossible by construction; cinematic CRT/vignette texture moved onto `.cave-stage` which clips the fanned back-cards in the gutter. Stage `min-height:800px`, cards 320→340px, diagonal tightened so the fan stays centred. Hover dropdown deleted (`showCaveTooltip`/`hideCaveTooltip`/`#caveStatTooltip` + CSS gone); hover is pure-CSS ring+lift, click opens the modal. Wheel-cycle rebound to the centre stage (rails scroll the page).
- **Touched `css/style.css`** (removed dead `.cave-stat-tooltip`/`.cst-*` block) — a concurrent session was also editing this file; coordinate before commit.
- **Verified:** Playwright, 6 seeded artists — grid 250/585/250, stage clips, 0 cards over rails, click opens modal, wheel cycles, 0 console errors.

## [2026-06-10] Forge posters — structured event fields → overlay lines (shipped, browser-confirmed)
Spec extension in `wiki/spec/compositor_overlay_forge.md`. Doug's call: the free-text "Event" box gave the overlay an unparsed blob; replace with structured fields so each fact lays down as a clean overlay line (the overlay, not the AI image, is the legible source).
- **`firepit.js`:** new `event_details` field key on `event_poster` + `event_promo` → Night name + a 2-col grid (Venue/City/Date/Doors/End-curfew/Tickets; night name keeps id `forgeEvent`). `gatherForgeContext` reads them into ctx. New `buildPosterOverlay(ctx)`: headline = lineup (or night name), supporting = stacked `Night / Venue · City / Date · DOORS <d>[–<curfew>] / Tickets` (only present fields). Field grid uses inline `display:grid` (avoided `css/style.css` — a concurrent session was editing it).
- **`content_api.build_user_prompt`:** appends the structured facts so the 3 copy variants reference venue/date/doors. *(Uncommitted this session — `content_api.py` also holds another session's `top_tracks` WIP; not bundling it. Recommit-coordinate.)*
- **Browser-confirmed (no brand):** lineup headline + all structured lines render crisp over the styled backdrop; `toBlob()` flattens 1080×1350. Screenshot in `scratch/forge_confirm/overlay_structured.png`.
- **Still open:** FLUX.2 `/edit` keeps baking *some* backdrop text (stray source date/“doors” persist) — lower impact now the real facts overlay cleanly on top. Options unchanged (prompt-harder / top mask band / editable). Doug to decide.

## [2026-06-10] Forge poster compositor overlay — brand-less legible text (shipped, browser-confirmed)
Spec: `wiki/spec/compositor_overlay_forge.md` (signed off). Closes the "shippable poster" gap after the restyle confirm.
- **Problem:** restyle clones flyer *style* but bakes *garbled text*; the Konva text-overlay compositor existed but only mounted **when a brand kit was selected** (`firepit.js:795`), so the common no-brand case got a flat garbled image.
- **Shipped (5 steps):** (1) `compositor.js` `DEFAULT_STYLE` (S0UNDCAV3 palette + DM Mono/Sans) so text renders on-brand with no kit; `addText` falls back to it (headline=text colour, supporting=body colour). (2) `firepit.js` gate → mounts for `event_poster`/`event_promo` even brand-less (`applyBrandKit(_brand||null)` clears stale brand). (3) Poster text wiring: headline=lineup, supporting=event details (date·venue·time). (4) `build_restyle_prompt` flipped from "render text legibly" → "clean BACKDROP, minimise lettering, leave clean zones for the overlay".
- **Browser-confirmed (no brand):** compositor mounts (2 Konva layers, `_compositorActive=true`); `CONCRETE WONDERS` + event line render crisp + legible over the styled backdrop; `toBlob()` flattens full 1080×1350. Screenshots in `scratch/forge_confirm/`.
- **Known rough edge:** FLUX.2 `/edit` still bakes *some* text (a wrong `SATURDAY OCTOBER 26 2024` header + `THE DOME` survived). Body zone clean; top header uncovered. Follow-up options captured in the spec (prompt-harder / top mask band / rely on editable overlay) — Doug to decide.
- **Out of scope (unchanged):** campaign-post Konva; `artist_bio`/`social_post` auto-mount.

## [2026-06-10] Cave drill-downs — graphic-first modals (shipped)
- **Why:** Doug (mural screenshot): clicking "Followers gained" / "Genre mix" must pop a *more detailed high-level graphic* — even while data is empty. Click-wiring already existed (Phase 2 of clan_tracking_dashboard), but the modal showed a numbers table and a dead empty state. Spec: `wiki/spec/cave_drilldown_graphics.md` (signed off).
- **What shipped:** followers/likes/listens modals lead with a clan-aggregate orange line chart over every snapshot day (movers table demoted to supporting detail below); genre modal is now an SVG donut in brand-orange shades + full swatched legend; empty baseline shows a framed "chart draws itself as snapshots land" placeholder instead of dead text; wired widgets get a "↗ details" hover hint.
- **Verified:** Playwright — chart + movers, donut, simulated baseline-only state, hover hint, 0 console errors.

## [2026-06-10] Artist modal v3 — visual stats, manual entry deleted (shipped)
- **Why:** Doug's screenshot review: platform links belong up top with the name; *no* manual data input anywhere; followers/plays/likes/reposts must be shown as line graphics, not bare numbers; top-5 suggested tracks; the gold emoji star clashes with the brand orange. Spec: `wiki/spec/artist_modal_v3_visual_stats.md` (signed off, both questions).
- **What shipped:** centered modal header with the platform chips inline under the name; 4 metric tiles each with an orange sparkline from the daily snapshots (click a tile → big chart switches metric); Manual Data Entry section + `saveManualData` + every `followers_override` read (cave/clan/footprints too) deleted; `/api/artist` now returns `top_tracks` (top 5 by plays, response-only) which the panel merges with scout-discovered tracks; star is an SVG in brand orange.
- **Bug caught in verification:** tiles initially preferred local scout snapshots (single-track stats) and showed 4.3K plays against the chart's 6.7M — tiles now read the same backend series as the charts.
- **Verified:** Playwright on seeded clan artist + live API path fired (real top tracks rendered); read-only view correct; 0 console errors.

## [2026-06-10] Forge reference-restyle — browser-confirmed live (closes the open gate)
- **What:** Drove the full UI path (login → FIREPIT → FORGE → Event Poster → uploaded the pink "Concrete Wonders" flyer as a Reference Image → GENERATE → picked a variant → auto-image). The restyle route fired exactly as designed.
- **Evidence:** API log `🎨 Forge image — type=event_poster job=restyle refs=1 (spirit:0 + ctx:1)`; output caption `1080x1350 | flux-2-pro/edit`. The 3-variant text step also correctly *read* the reference ("neon magenta and black constructivist grid… angular smiley faces").
- **Visual verdict:** **Style nailed** — exact magenta-on-black palette, constructivist grid, twin smiley faces, mascot, molecule motifs, "PRESENTS" banner, "CONCRETE WONDERS" all faithfully recreated. **Text garbled** as predicted (kept source "SATURDAY OCTOBER 26 2024", body became nonsense). The new event text did not render cleanly — confirms FLUX.2 `/edit` nails style but mangles long text; the Konva compositor overlay (still deferred, Phase 1c) is what's meant to lay legible date/venue on top.
- **Bug found + FIXED:** caption read `fal-ai/fal-ai/flux-2-pro/edit` — doubled prefix. Root cause was a source inconsistency: `generate_for_job` (media_gen.py:500) returned the full slug *with* the `fal-ai/` prefix, while every other generator returns a bare model name and callers prepend `provider` themselves. Fix: strip the leading `fal-ai/` from the returned model (keeping `model_slug` intact for the `fal.run/{slug}` URL). Re-confirmed in browser — caption now `fal-ai/flux-2-pro/edit`. Also corrects the video-composite label path (media_gen.py:647).
- **Takeaway:** restyle backend + UI path are proven end-to-end. The remaining blocker to a *shippable* poster is the compositor overlay, not the restyle itself.

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

## 2026-06-09 — The Cave overhaul, Phase 4 (real weekly scheduled searches)

Spec: `wiki/spec/scheduled_searches.md` (signed off, API-backed model). Live-fire verified. **Completes the 4-phase Cave overhaul.**

- Scheduled searches were fake (localStorage only, nothing ran them, the Running tab falsely claimed CI ran them). Now real:
  - **Store + API:** `data/scheduled_searches.json` + `content_api.py` `GET/POST /api/scheduled-searches`.
  - **Runner:** new `scheduled_scout.py` runs each active search (genre/keyword + own follower range), writes `data/searches/<id>.json` (results tagged with `search_id`/`search_name`) + `index.json`, sets `last_run`.
  - **Action:** new `.github/workflows/scheduled_searches.yml` — weekly + manual dispatch, commits results.
  - **Frontend:** `js/foraging.js` API-backed store (localStorage fallback); Running tab renders **results grouped per search** (name + filters + last-run), triaged via `forageAction`; added a `keyword` field; manual results show their filter summary; **removed the false "runs automatically" claim**.
- Live run: seeded "Underground Tech House" → 12 results (all ≤5000 followers), tagged + grouped in the UI; API GET/POST + 400 validation confirmed.

### Cave overhaul — all 4 phases shipped (commits)
- P1 `f5fb908` — auto-add fix, orange eye, bigger Mural, widget tooltip+modal · XSS hardening `80e05d7`
- P2 `db366a4` — artist detail centered modal + compact platform links
- P3 `45faff1` — accurate own-track play tracking + plays chart
- P4 (this) — real weekly scheduled searches

## [2026-06-18] Tracking outage diagnosed + fixed · Phase 3 (screenshots) PARKED

**Assessment first (Doug's ask): what's actually collecting data?** Two parallel SoundCloud-API collectors — *no screenshot system has ever run* (0 rows `source='screenshot'`; all 103 snapshots are `source='api'`):
1. **Old static** — `clan_tracker.py` via GitHub Actions → `data/snapshots/*.json` → Vercel. Running daily (6/6 success). The *buggy* one (display-name resolve → wrong-user bug; zeros-on-failure). Still live as the signed-out fallback.
2. **New Supabase** — `tracking_collector.py` on Railway → Supabase. The *robust* one (stable user-id, NULL-not-zero). What the Footprints charts read when signed in.

**The frozen-charts cause:** the Supabase pipeline 401'd every run **2026-06-13 → 06-17** (5 days `failed`/NULL — the chart hole). Root cause = `get_token()` cached the OAuth token forever; the long-running Railway process used an expired token. Fixed: expiry tracking + 60s safety margin + force-refresh on 401 (`soundcloud_helpers.py`). Deployed to Railway 12:10 UTC (`railway up`); manual run after = **21/21 ok**. Token fix cherry-picked onto `main` (`2a256d6`) — it was live on Railway but missing from git, a drift risk now closed. **First autonomous proof = the 00:04/07:00 UTC scheduled run (today's 07:00 predated the deploy).**

**Decision — Phase 3 screenshot-ingest lane PARKED (not built).** Rationale: the inaccuracy that motivated screenshots was *our bug* (token expiry + display-name resolve), now fixed at source; the API lane gives guaranteed-live followers/plays/likes/reposts for clan+watching. Vision extraction tested *framing-sensitive/unreliable* (misread 765/171 vs real 834/1144) → would re-introduce inaccuracy. Screenshots only uniquely add playlist-adds + cross-platform (Spotify/IG/TikTok) — a future A&R enhancement, not today's need. Phase 3 backend stays on branch `tracking-v2-phase3` (also inert-live on Railway); no frontend built. Static pipeline kept as fallback for now (retire later, after several clean Supabase days — Doug declined immediate retirement + gap-backfill).

### Same day — Tracking Health Watchdog SHIPPED (so a silent failure can't recur)
Doug's deeper ask ("real, live, consistent, no more delays"): the token bug fixed *one* outage, but the real damage was that it stayed **invisible for 5 days**. Built a monitor — spec [spec/tracking_health_monitor.md](spec/tracking_health_monitor.md), commit `02cc42f`, on `main` + deployed:
- **`GET /api/tracking/health`** (public, no auth) — computes `severity` ok|degraded|down from the latest `snapshot_runs` row + freshness (an OK SoundCloud snapshot dated *today* UTC). `down` = stale / unfinished run / `artists_ok==0` (the June failure class); `degraded` = fresh but some artists failed (one dead account, warn-not-page); `ok` = fresh + clean.
- **`.github/workflows/tracking_health.yml`** — daily 10:00 UTC (3h after the 07:00 collector), curls the endpoint, **hard-fails on `down` → GitHub emails Doug**. *External* to Railway, so it fires even if Railway's scheduler/host is dead. No new secrets (uses GitHub's free failure-email; `SLACK_BOT_TOKEN` ping is a noted future add).
- **Verified end-to-end:** local Flask test-client → live Railway curl (HTTP 200) → `workflow_dispatch` run green, log shows it parsed real data (`severity:ok`, 21 OK) and passed. During 06-13→17 the latest run had `artists_ok:0` ⇒ `down` ⇒ would have alarmed on day one.
- **Deploy note:** `railway up` from the `main`-based branch also dropped the inert Phase 3 screenshot endpoints from Railway (Phase 3 stays parked on `tracking-v2-phase3`). Prod deploy + main-merge were gated by the auto-mode classifier → Doug authorized via AskUserQuestion.
- **Branch hygiene:** `tracking-health-alert` fast-forwarded into `main`, then deleted (worktree + local + remote).

Note: an editor open on Doug's side clobbered some uncommitted edits mid-P3 (auto-saved stale buffers over disk); re-applied + committed. Mitigation: commit promptly / keep project files closed in the editor during a session.

## [2026-06-17] Strategy lock — Campaign Studio leads (tech-house first) + branch backed up

**Strategy session (2026-06-16→17), no code.** Worked through "does a music-niche tool have legs in a fast AI space" and locked direction:
- **Campaign studio leads**; intelligence/tracking stays but **parked**; long-term = both with a discovery→studio round-trip. **One scene first: tech-house.** Full reasoning + decision: [decisions/0008](decisions/0008_campaign_studio_first.md).
- **Moat = encoded niche taste**, not pixels (we orchestrate Canva/Higgsfield/fal APIs) and not data (won't out-data Chartmetric/Sony). "Ahead of AI" is the losing bet for a solo builder.
- **Genre selection = visual gallery, not a text dropdown** (a genre is a lossy proxy for a look; crossover is real). New spec: [spec/style_gallery](spec/style_gallery.md) — **DRAFT, pending sign-off**. Surfaces curated STYLE tiles into the *existing* role-tagged STYLE pipeline; the input architecture is already built.
- **Spirit = avatar = character** (face consistency), never a mood; mood lives in Additional Context. Locked.

**Grounding finding:** ~70% of the studio inputs already exist on `forge-output-ux` (Context Stack, WHO/WHERE/WHAT/STYLE refs, 3 formats, Spirits, video). **None live** (`main` is deployed). The branch was **22 commits local-only** → pushed to GitHub `origin/forge-output-ux` on 2026-06-17 after a clean gitleaks scan. `gh` wired as the git credential helper to unblock the HTTPS push.

**Next:** Doug signs off style_gallery (esp. IP handling of reference flyers + vernacular name) → P0 baseline the current tech-house Flyer output → build the gallery → source the tech-house pack.

### Same day — style_gallery signed off · name = Etchings · UX principles captured
- **style_gallery APPROVED.** Decisions locked: IP (real flyers = private R&D ref only; shipped tiles are our own generated plates) · gallery default + upload kept · **tile volume: prove the recipe on 3 distinct looks, then scale to 20+** (never manufacture 20 on an unproven recipe — Doug's push-back, kept) · **name = "Etchings"** (gallery) / "an Etching" (one tile); "Markings" rejected (collides with "Marks"). Glossary + rename-log updated.
- **New: [spec/forge_ux_principles](spec/forge_ux_principles.md)** — 5 generation-UX principles Doug brought from an external chat, adapted to Sound Cave's mechanics: iterative control · examples as guide-rails (an Etching is an anchor, not a cage) · style-consistency across a series (extends the carousel one-locked-style to a campaign-level style lock) · closing the vision gap · Start→Generate→Review→Refine→Approve→(lock style→continue).
- **2 tensions flagged → RESOLVED 2026-06-17.** Principles 1 & 4 (iterative refine + A/B) conflicted with P1.5, which had *killed* the refine row and 3-angle variant pick. **Doug chose *full iterative richness*** — refine controls + A/B return as first-class (P1.5 calls 4 & 5 reversed; cross-noted in forge_context_pipeline). Placement guardrail recommended (richness lives *post*-generation; pre-gen path stays minimal — confirm/override).
- **Refine-loop capability list captured** (Doug's market-leader note): A/B branching (easy) · selective TEXT edit (needs compositor layer) · selective IMAGE edit (hard, model-dependent) · "real-time" (recalibrate to fast-async — we don't own latency). **New fork surfaced: baked-text (P1.5) vs separate compositor layer** — selective text editing needs the layer; let P0 inform the call. Anchor restated: the refine loop is table-stakes, not the moat (don't race Midjourney; win on Etchings).
- **New canonical roadmap: [build_plan.md](build_plan.md)** — staged map (P0 → prove 3 looks → Etchings → refine loop → 20+) Doug wants top-of-mind at each stage. style_gallery's build-outline now points here; surfaced under "Current focus" in index.

## [2026-06-18] WHO integration proven + carbon-copy law REVERSED (uncommitted)
- **Root-cause found & fixed:** the "WHO carbon-copy law" (Phase C, 2026-06-12) stripped WHO refs out of generation and PIL-pasted a cutout afterward → the model invented a random subject + pasted Doug's photo in the corner (the recurring failure). Fix in `content_api.py generate_image_endpoint`: deleted the WHO strip + the carbon-copy paste loop; ALL refs (STYLE+WHO+WHAT+WHERE+Spirit) now flow into `nano-banana-pro/edit` together. `job_type_for`, `build_compose_prompt` and size-select were already correct — WHO-stripping was the only bug. **Uncommitted; pending local verification; do NOT deploy (Doug's call: test local first).**
- **Proven raw** (rule-free harness `scratch/raw_model_test.py`): nano-banana-pro/edit integrates Doug's real face INTO a style ref (no paste) — `scratch/raw_nano_test1.png`; iteration by feeding the output back keeps everything & fixes one thing — `raw_nano_test1_v2.png`; generalises across 3 style clusters with new event text — `scratch/test_{alves,deanblunt,kaytranada}.png`. **Model is sufficient — NO Higgsfield/tool switch.** CapCut uses Seedream/Seedance; we use the equivalent (nano-banana-pro/edit).
- **Decisions reaffirmed:** baked-in text stays (overlay was disjointed + uneditable); no hardcoded text/layout rules (use-case specific → Additional Context + iteration); creative direction is Doug's (Claude = technical comparison only). Iteration loop (feed last output back, never reroll) is the next build.
- **Full context handoff written to `SESSION_HANDOFF.md`** (Doug moving the thread to Antigravity IDE). Local servers running (`./run.sh`, :8000 + :3000).

## [2026-06-18 PM] WHO-fix VERIFIED · flyer-iteration session · reference-as-template insight

- **WHO-fix verified (the carbon-copy reversal holds).** Confirmed the uncommitted `content_api.py` fix through the *real* compose pipeline (not just `py_compile`): `roles=['style','who'] → compose_person → nano-banana-pro/edit`, subject INTEGRATED (real face re-rendered into the style, no corner paste), text rendered EXACTLY. The 12:58 browser run also fired through the fixed code (new print format `(spirit:N + uploads:M)`, 200 OK). Harness: `scratch/verify_who_fix.py`.
- **STYLE_HINTS lever CONFIRMED (handoff §6).** The generic `STYLE_HINTS` "Output intent: dark brutalist/concrete" line was diluting specific STYLE refs. A hand-crafted compose prompt *without* it + explicit grain/ink/type instructions took a Dean-Blunt-style flyer from "not close" → close on green + grain. **TODO (not yet coded):** drop `STYLE_HINTS` from `build_compose_prompt` when a STYLE ref is present. Harness: `scratch/cowgirl_dj_test.py`.
- **Live flyer iteration with Doug** (Dean Blunt riso ref → cowgirl-as-DJ). v1 missed (side-on pose, matched the old output's text block not the ref's hierarchy, clean font); locked spec via picker (keep her courtyard backdrop · body-front + head-down · big title + scattered small print); v2 hit all three. **Two persistent gaps:** font glyph-degradation + grain intensity still under-cooked (model defaults to clean render) — first job for the iteration loop, NOT another reroll. Defect: model duplicated a small-print line.
- **Reference-as-template insight (Doug) → [forge_context_pipeline](spec/forge_context_pipeline.md) §5.** The reference is a *template of information roles*; map our event data into each role (HACKNEY'S VERY OWN→LONDON'S VERY OWN, @BOILER ROOM→@CHATSWORTH PRESENTS…), reproducing structure + treatment. Guardrail: learn the grammar, don't clone the artifact (IP).
- **Flag:** these tests used a Dean Blunt / DIY-riso reference, **not tech-house** (build_plan Stage 1 says tech-house first) — confirm with Doug whether the first proven look is still tech-house or this DIY direction.
- **Next (Doug's priority): build the iteration system** — feed-last-output-back refine, never reroll (proven raw in `raw_nano_test1_v2.png`). Spec → sign-off → build, on `forge-output-ux`, local (no live deploy yet).

## [2026-06-18 PM] Iteration loop — backend + frontend built (Phases 1–2)

- **Spec written + scope signed off** ([forge_iteration_loop.md](spec/forge_iteration_loop.md)): MVP = refine + version history (no A/B, no region-edit); build on branch, no live deploy.
- **Phase 1 — backend** (`87ddc55`): `POST /api/refine-image` feeds the active output back into `nano-banana-pro/edit` (`JOB_EDIT`) with one instruction, keeps everything else. Auth/debit/refund mirror generate-image; version chain client-side. Model-level smoke test held composition/subject/hierarchy/colour while applying the change; **finding: multi-part instructions only partially execute → UX steers to one change per refine.**
- **Security** (`a05d133`): commit review flagged SSRF on the client-supplied `base_image_url`. Fixed — allowlist the Supabase host (blocks metadata/loopback/RFC1918/external by construction), `allow_redirects=False`, generic error (no host-reachability leak). Guard tested against all vectors.
- **Phase 2 — frontend** (`ui-change-protocol` ran; layout = *behind a ✎ REFINE button*, Doug's pick): `✎ REFINE` toggles a version strip + "describe one change" box under the Forge output. `index.html` + `css/style.css` (mirrors slide-strip pattern, palette-law) + `js/firepit.js` (`refineImage`/`renderVersionStrip`/`setActiveVersion`, client-side chain, XSS-escaped). Single-image formats only. **Layout screenshot-confirmed** (`scratch/_verify/refine_panel_check.png`).
- **Phase 3 — remaining:** browser end-to-end (restart server + login → generate → refine → confirm). Not yet run.

## [2026-06-18 PM] BUGFIX — no-person compose route 422'd → silent flux-schnell fallback

- **Symptom (Doug's Phase-3 test):** a Flyer with STYLE + WHAT + WHAT (no WHO) ignored all refs + direction and garbled the text. Output meta showed `fal-ai/flux-schnell`.
- **Root cause:** `roles=['style','what','what']` → `job_type=compose` → `JOB_COMPOSE` was mapped to `fal-ai/flux-2-pro/edit`, which returns **422 Unprocessable Entity**. `generate_image_endpoint` caught it and silently fell back to legacy `generate_image` = text-only `flux-schnell` (can't read refs, mangles text). This no-person compose path had **never been run live** — every prior win used a WHO ref → compose_person → nano-banana.
- **Fix:** route `JOB_COMPOSE` → `nano-banana-pro/edit` (proven workhorse; one model for all compose). Verified at model level (`scratch/compose_route_fix.png`): same inputs now give a ref-aware flyer with legible, correctly-spelled text.
- **Still open (next):** (1) the silent fallback to a ref-blind model is dangerous — it ships garbage that looks like a real attempt; should surface the error or fall back to another ref-capable model, not flux-schnell. (2) Doug flagged the post-caption box under the flyer as confusing/redundant for baked-text flyers — UX review pending.

## [2026-06-18 PM] Output-column rework + routing principle ([forge_output_column](spec/forge_output_column.md))

Built from Doug's brief; spec signed off. Four changes:
1. **Kill silent fallback** — `generate_image_endpoint` no longer downgrades a **ref-based** gen to text-only `flux-schnell` on router failure; it surfaces the error instead (no-ref gens may still fall back — nothing to reference). Closes the "shipped garbage that looked real" trap.
2. **Rename** "Direction & Mood"/"Direction & Notes" → **"Direction"** (it's the context/connector for the refs, not "mood"). Glossary has no entry (no change needed).
3. **Enlarge** output image — `.forge-image-preview` max-height 420px → 70vh (flyer dominates the column).
4. **Caption box** — for flyers, the flowery `/api/generate` text is dropped; caption = **concise facts assembled client-side** (name · lineup · date·time · venue—city · price, then stop), editable, in a new box **below the action row, above BEAT**. **✨ Enhance** button → new `POST /api/enhance-caption` (Haiku expands on demand). Per-format-aware (`_CAPTION_TEMPLATES` keyed by `content_type`) so tour/album/etc. add a template, not a rewrite. Other formats keep the old output-area flow untouched.
- **Locked principle (Doug):** with any reference images attached, every still gen uses one model (`nano-banana-pro/edit`); the ref combination never re-routes the model — role tags shape the *prompt*, not the model. (Recorded in [forge_output_column](spec/forge_output_column.md).)
- **Verified:** JS + Python compile; caption assembly output checked; new endpoint live (401). **Visual confirm = Doug's live test** (Playwright profile was locked; column styling pattern was screenshot-validated earlier with the refine panel).

## [2026-06-18 PM] FIX — STYLE_HINTS dark line flipped cream references to black (finally shipped)

- **Symptom:** Doug's flyer from a **bright cream** STYLE ref (TECHNO HOUSE) came out a **dark starfield** — palette inverted vs the reference.
- **Root cause (diagnosed 2026-06-12 §6, proven by the cowgirl test, but not yet coded into the live builder):** `build_compose_prompt` injected `STYLE_HINTS['event_poster']` = *"Dark brutalist backdrop…"* as "Output intent" on **every** flyer prompt — overriding the STYLE ref's actual palette.
- **Fix:** suppress the generic hint when a STYLE ref is present (`if hint and not style`) — the reference governs the look; the hint only seeds a default backdrop when there are no refs. Verified at prompt level: with a STYLE ref the dark line is gone; with none it remains.
- **Secondary (for Doug's "recreate the style closely" goal):** WHAT refs can over-influence the composition (his teal figure became the hero); the model also defaults to clean type rather than the ref's distressed lettering. Levers = Direction box ("recreate this layout, keep cream + hands + lineup boxes, swap only the text") + fewer/targeted WHAT refs + a stronger "replicate the reference's exact lettering" instruction. Pending.

## [2026-06-19] Refine loop RE-ANCHORED to the original STYLE reference

- **Trigger:** Doug ran the refine loop v1→v4 on his TECHNO HOUSE recreate. v1 nailed it (cream palette fix worked); v2/v3 stayed close; **v4 drifted** (busier, symmetry lost).
- **Root cause:** the loop fed back **only the previous output** — after v1 the original STYLE ref's authority was gone, so each refine edited an increasingly-drifted *copy*. Drift compounded over 4 lossy re-renders; bundling 5–7 changes per refine amplified it (edit models reliably apply *one* change).
- **Fix (shipped):** refine now re-anchors. Frontend passes the original `reference_images`; `refine_image_endpoint` feeds **[working image (image 1), …STYLE refs]** to `JOB_EDIT`/nano-banana, prompt anchors image 1 to *"the reference's layout, symmetry, typography and palette — re-align, do not drift."* Anchored on **structure not content**, so deliberate changes (swapped hands etc.) survive. Spec: [forge_iteration_loop §Re-anchoring](spec/forge_iteration_loop.md).
- **Verified at model level** (`scratch/refine_anchor.png`): working image + style anchor → 2-ref edit applied the change AND pulled palette/type toward the style ref; text stayed legible.
- **Coaching to surface in UX:** one change per refine · branch from the *best* version (not always latest) · big structural moves → regenerate from refs, not refine a drifted copy.

## [2026-06-22 PM] Conjure → **Animation**, folded into the Forge FORMAT dropdown (Doug's restructure)

- **Trigger:** Doug reviewed the standalone CONJURE sub-tab live and called it: *"the new conjure tab is in fact a different output format — so add conjure to that rather and rename to animation. keep all the UI style and branding inline with soundcave."*
- **Change:** removed the CONJURE top-nav sub-tab; added **Animation** as a 4th option in the Forge FORMAT `<select>` (Still / Carousel / Flyer / Animation). Selecting it swaps the standard input stack (`#forgeStandardStack`) for a native-styled generative sub-form (`#forgeAnimationStack`): **Artwork upload → Motion (plain-words) → Length → ANIMATE → looping `<video>` → SAVE TO STASH**. Size picker hides (output follows the source artwork).
- **Native styling:** the prototype's bespoke inline-styled panel was replaced with SoundCave classes (`.card`, `.forge-stack-label`, `.forge-label`, `.input`, `.btn-red`, `.btn-outline`, `.forge-image-preview`) — matches the existing Forge cards exactly.
- **Scope:** the v1 Animation UI is **animate→video only**. The generative image-edit path (`/api/conjure action=edit`, nano-banana) stays live in the backend for a later "tweak the still first" surface.
- **Files:** `index.html` (dropdown option, `#forgeSizeWrap`, `#forgeStandardStack` wrap, `#forgeAnimationStack`, removed `#firepit-conjure`); `js/firepit.js` (`CONTENT_TYPES.animation`, `setFirepitMode` array, `updateForgeFields` stack-toggle + early-return, `generateContent` dispatch, new `generateAnimation`/`forgeAnimPreview`/`saveAnimationToStash`, `editStashItem` video reopen); `js/stash.js` (video thumbnail for animation items). Same `/api/conjure` backend — no backend change.
- **Verified:** `node --check` clean on all three JS files; no stale `conjure*` DOM refs; `<div>` balance 284/284. **Visual confirm = Doug's live UX review (gate before merge→deploy).**

## [2026-06-23] Animation format SHIPPED TO LIVE 🎉 (Doug: "push to live site")

- **Deployed** the Animation format end-to-end. firepit-embers was 6 ahead / 7 behind main; integrated `origin/main` into the branch (clean auto-merge — mobile shell + Animation touched different parts of `index.html`; only overlap was index.html, no conflicts), verified (JS `node --check`, `py_compile`, div balance 284/284, both features present), then fast-forwarded `main` to the integrated tip and pushed.
- **Frontend (Vercel):** production deploy `dpl_3J1J…` READY at `a0352e2`, `thesoundcave.vercel.app` HTTP 200 serving the Animation option + sub-form. **Backend (Railway):** `railway up` → `/api/conjure` live (404→405 flip confirmed; FAL_KEY/SUPABASE/STRIPE all set). Live backend reads the same Supabase (`agmmdrqmjywggtsycsri`) that holds Doug's saved animation, so it appears in live Stash with the new poster-frame thumbnail.
- **Shipped scope:** Animation = animate→video only (Kling i2v). Generative image-edit (nano-banana text/material swaps) remains in the backend (`action=edit`) but is NOT surfaced in the UI yet — so a "change AUGUST→SEPTEMBER" instruction is ignored by the animate path. **PARKED DECISION:** how to surface text/artwork edits (recommended: optional cheap EDIT-still step (5cr) before ANIMATE (100cr)).
- **Also live (from main's 7 commits):** mobile bottom-tab shell (step 1/7), Phase-2 prep-interpreter spec, daily/weekly data snapshots.
- **Margin note to action:** a 10-sec animation costs ~2× COGS but charges the same 100 credits — consider 200cr for 10s.

## [2026-06-23] Credit pricing locked at ~80% gross-margin floor (Doug's call)

- Repriced `CREDIT_COST` against real model COGS, margin computed at the cheapest credit rate (Agency £0.0332/cr) so 80% is the floor on every plan/pack. £/credit unchanged → no Stripe re-bootstrap.
- **image 5→18** (nano-banana-pro/edit ~£0.12), **video_premium 100→240** (Kling 5s ~£1.58), **+ video_premium_10s 480** (Kling 10s ~£3.16). `/api/conjure` now picks the tier by duration BEFORE the debit (10s was wrongly charging the 5s price). text/composite/standard already >80%, kept.
- **Verified LIVE** (authed 402, no spend): animate 5s → cost 240, animate 10s → cost 480. Deploy `e3f67d12` ● Online; frontend fallbacks synced + pushed (commit a6f3d98).
- ⚠️ DRAFT — COGS are list-price estimates; the nano-banana image cost ($0.15) is the biggest uncertainty (drives the 18cr). Verify vs a real fal invoice. Provider may change (Higgsfield) → re-derive animation credits if so. **✅ RESOLVED later same day — see [2026-06-23] COGS verified entry below + [decision 0010](decisions/0010_media_gen_cogs_verified.md). nano-banana $0.15 confirmed (18cr stands); Higgsfield rejected (API-gated); BUT video COGS was ~5.7× too high → 240/480cr animations are at ~96% margin, not 80%.**
- Side-effect: at 240cr/animation, Doug's own dev account (18 credits) can't run one in-app — test via a credit top-up or Higgsfield (off-credits).

## [2026-06-23] Media-gen COGS verified — fal stays, Higgsfield rejected, animation credits over-priced (decision 0010)

Closed the DRAFT flag above. Triggered by Doug's question: while pre-customer, switch to a Higgsfield-style subscription? Investigated by reading the real fal model prices + his actual fal usage dashboard (not memory — earlier ballparks were wrong by ~10×).

- **Decision [0010](decisions/0010_media_gen_cogs_verified.md):** stay on fal pay-as-you-go + dogfood promo content through Forge. Higgsfield's cheap/unlimited tiers are **web-UI only (no API/MCP/CLI)** → cannot power the pipeline. Sub only ever makes sense as a separate inspiration toy.
- **Verified COGS** (live fal pages, ≈£0.79/$): Kling v2.6 Pro i2v 5s audio-off = **$0.35 (£0.28)**, 10s = $0.70; nano-banana-pro/edit = **$0.15**; flux-2-pro/edit ≈ $0.075. Recorded in [stack.md](stack.md).
- **The £1.55–£3-per-video belief was a myth** — Doug's all-time *video* spend is **$1.75 total** (fal dashboard, 4 months). His cost is **image-dominated** (nano-banana $8.40 = 54% of ~$15.50). The "£1.58" came from the app showing the **stale `COST_ESTIMATES['video_premium'] = 2.00`** constant ([media_gen.py:65](../media_gen.py#L65)), ~5.7× the real charge.
- **⚠️ Pricing fallout:** the 240cr/480cr animation prices were reverse-engineered from that 6×-high COGS for an "80% floor" — so the real margin is **~96.5%, not 80%**. A true 80%-floor price is **~42cr / ~83cr**. Image 18cr is correct (nano-banana $0.15 verified). **Doug to decide:** keep fat margin vs drop animation price ~5.7× as an adoption hook (rec: drop it).
- **Forward estimate:** 25 videos + 25 images/mo with refinement ≈ **~£35/mo** on fal. Trivial; no sub.
- **Code follow-ups (not done):** fix the stale `COST_ESTIMATES` video constants; optionally wire the fal MCP (`mcp.fal.ai/mcp`) for in-session runs (generation-only — no billing access). No code touched this session — knowledge capture only.

## [2026-06-23] Admin accounts bypass in-app credits — unlimited for owner, fal balance is the ceiling (decision 0011)

Doug's call: his personal/owner account (`douglaswoolfenden@gmail.com`) should generate freely to dogfood Forge + make Sound Cave's own promo content, bounded only by his real fal.ai credit. First "admin" concept in the product. Branch `admin-unlimited-credits` (cut off `firepit-embers`, which holds the live credit/conjure code — the `forge-output-ux` trunk is stale and lacks it). Full reasoning: [decision 0011](decisions/0011_admin_unlimited_credits.md).

- **Mechanism (server-side, no DB migration, no endpoint changes):** the credit gate is entirely backend — `_debit()` runs before the fal call and the frontend only blocks on a `402`. So: `_resolve_user_id()` stamps `g.is_admin` from the JWT email vs `ADMIN_EMAILS`; `_debit()`/`_refund()` short-circuit for admins (same "free action" path captions use). Never charged → never a `402` → generation runs → fal bills the real balance.
- **Env-driven, never hardcoded** — repo is public, so the email lives in gitignored `.env` (`ADMIN_EMAILS=…`, comma-sep) + Railway. Missing var = no admins = normal billing (safe default).
- **UI:** `/api/me` returns `admin: true`; the credits chip (`#reflectionCredits`) shows **∞** instead of a number ([app.js](../js/app.js), [firepit.js](../js/firepit.js)).
- **⚠️ Prod step Doug must do:** set `ADMIN_EMAILS=douglaswoolfenden@gmail.com` in **Railway** env — local `.env` only covers localhost. Until then the live app charges normally.
- **Not yet:** real-flow verification (log in as admin on live → fire a generation → confirm no charge + ∞). Branch not merged/pushed.

## [2026-06-25] Admin-unlimited-credits VERIFIED LIVE ✅ (closes the "not yet" above)

Real-flow verification done end-to-end on prod — the feature is fully live and confirmed.

- **Setup confirmed:** `ADMIN_EMAILS=douglaswoolfenden@gmail.com` is set in **Railway** prod (the "prod step Doug must do" was already done); latest Railway deploy `685acced` (2026-06-24 16:59) post-dates the admin merge, so the bypass code is live; `main` == `origin/main`, clean tree.
- **Auth path note (for future live tests):** the Supabase magic-link token is **corrupted crossing the Gmail→JSON tool boundary** (a byte renders as `�`, dropping 2 hex chars → `otp_expired`). Reliable workaround: mint a fresh link via the **admin API** — `POST {SUPABASE_URL}/auth/v1/admin/generate_link` with the service key (read from `.env`, never echoed) returns a clean `action_link`; navigate Playwright to it to log in.
- **Assertion 1 — admin recognised:** authed `GET /api/me` on the live backend returned `{"admin":true,"credits_balance":18,"tier":"solo"}`; the `#reflectionCredits` chip rendered **∞** (read from live DOM). Proves `ADMIN_EMAILS` is wired correctly in the deployed code.
- **Assertion 2 — charge bypassed (real flow):** fired one real `POST /api/generate-image` (cost `image`=2cr for non-admins) → `status 200`, real `image_url` returned by fal, ~40s. Balance **18 → 18** (unchanged), no `402`. Definitive: `_debit()` short-circuits on `g.is_admin`, fal billed Doug's real balance (~£0.12 for the throwaway test image).
- **Stale-numbers reconciliation (corrected an out-of-date resume brief):** live `CREDIT_COST` is the **small adoption scale** — `image=2`, `video_premium=4` (5s), `video_premium_10s=8` — at ~80–82% margin, NOT the `18/240/480` from the [2026-06-23] "80% floor" entry (those were superseded by the adoption-scale reprice). The decision-0010 follow-up to fix the stale `COST_ESTIMATES` is also **done**: [media_gen.py](../media_gen.py) now reads `image 0.15 / video_premium 0.35 / video_premium_10s 0.70`, all annotated "verified — decision 0010". So the animation-pricing question is closed; no `5.7×` drop pending.

## [2026-06-25] Tracking Health Watchdog false-alarm FIXED (health severity keys off freshness)

The watchdog had been hard-failing (→ daily email to Doug) since ~06-21, but **tracking was never actually down** — it was a bug in the health *check*, not the pipeline.

- **Root cause:** [tracking_api.py](../tracking_api.py) `health()` read only the **latest** `snapshot_runs` row and flagged `severity='down'` on `ok == 0`. Every day the 00:00 **catch-up** run collects all 21 artists (`ok=21`), then the 07:00 **scheduled** cron finds them already captured today and skips them all ([tracking_collector.py:240](../tracking_collector.py#L240) `continue # already captured today`) → a legit no-op run with `ok=0`. The check read that no-op as an outage, even though `data_fresh=true` / `last_ok_date=today`. Confirmed via `/api/tracking/runs`: catch-up runs = 21 ok, scheduled runs = 0 ok, every day 06-23→06-25.
- **Fix:** `down` now means **stale data only** (`not fresh`) — the true outage signal. The token-outage class it was built for (runs that 'complete' with every artist failed) still trips it because that produces no OK snapshot today → `not fresh`. `failed`/`partial` with fresh data = `degraded` (warn, don't page). Dropped the misleading `ok == 0` and `not completed` clauses + the now-dead `completed` local. `py_compile` clean.
- **Not yet:** deploy (backend → `railway up`, batched with the Forge work) then re-curl `/api/tracking/health` to confirm it flips `down`→`ok`. Minor follow-up noted but NOT actioned: the 00:00 catch-up beats the 07:00 cron daily, so the scheduled run is always a redundant no-op — harmless (cheap skip), left as-is to avoid changing collection cadence.

## [2026-06-25] Forge UX — Higgsfield left→right reflow (pass 1, awaiting Doug's review)

Doug shared the Higgsfield "Create Video" UI and asked to adopt its left→right flow. Spec [forge_layout_higgsfield.md](spec/forge_layout_higgsfield.md) written + signed off as **Option B** (tighten left + hero canvas; Etchings stays the entry; @elements + right history rail are fast-follows). Built on branch `forge-higgsfield-layout`.

- **What changed (CSS-led, no JS):** `.forge-grid` `1fr 1fr` → `minmax(300px,340px) 1fr` (compact control rail | hero canvas); left card → `.forge-controls` (sticky, tightened spacing off `--space-*`); right card → `.forge-canvas` (min-height 440px, centred stage); `GENERATE CONTENT` → **FORGE** (`.forge-go`). Reused existing 900px collapse + disabled sticky there.
- **Verified on localhost** (admin login via the generate_link trick, Playwright @1440 + @430): grid measures 340|788 desktop, single-column mobile; div balance 284/284; no new console errors. Shot: `scratch/forge_higgsfield_reflow.png`.
- **NOT pushed** — Doug reviews the layout first, then we batch-push (this + the watchdog fix) to `main` (Vercel front) + `railway up` (backend health fix).
- Open for Doug: rail width (340px)? FORGE CTA louder (solid) or keep consistent outline? keep the FORGE rename?
- **Pass 2 (same day, Doug's follow-up):** Format + Size → **iconised pill pickers** (reuse `.forge-picker`, inline SVGs via `currentColor`); native selects kept hidden as source-of-truth, driven by `forgePick()`/`syncForgePills()` (synced inside `updateForgeFields`). Reference upload → **`+ ADD REFERENCE` drop-block** (`.forge-dropzone`, dashed, orange +, clicks the now-hidden file input). No JS readers changed; format-switch + handleRefImagesChange verified intact; `node --check` clean, div 286/286. Shots: `scratch/forge_pickers_top.png`.
- **Pass 3 (same day, Doug's tidy-up batch):** Format+Size → **compact dropdowns on one row** (reverted pass-2 pills per Doug); **Size now shows for all formats** incl. Animation (caveat: i2v output still follows the source artwork — aspect→Kling is a follow-up); **removed Brand kit + Voice Profile** (both JS-safe; voice defaults to `underground`, to be inferred from Direction once the interpreter lands); **event details restructured** — Night → Venue|City → Date(`type=date` calendar)|Ticket → Doors|Close(`type=time`, one row); `gatherForgeContext` formats date→`FRI 12 DEC` / time→`10PM`; **animation length → snap-slider** (5/10, live label); **condensed** helper/example text; native pickers themed dark. `node --check` clean, div 281/281, no new console errors. Shots: `scratch/forge_pass3_flyer.png`, `forge_pass3_animation.png`. **Decisions:** duration slider snaps to 5/10 (model reality); history rail = next pass (client-side v1); interpreter = follow-up.
- **Pass 3b (same day, Doug's polish):** Format+Size **icons restored** via a custom icon-dropdown (`.forge-dd` — hidden `<select>` source-of-truth, `forgeDDToggle`/`forgeDDPick`/`syncForgeDD`, click-outside close); **animation Artwork → `+` drop-block** (matches References); **duration → continuous 5–10s slider** (`step=1`) — conjure endpoint snaps to nearest supported 5/10 before the Kling call + bills by snapped tier (model only renders 5/10; clamp removable later). `node --check`+`py_compile` clean, div 286/286. Shot: `scratch/forge_pass4_icondd.png`. **NEXT (big, needs spec):** unify References+Subject+Artist into one Higgsfield-style "Elements" section + auto-populate artist assets (avatar/artwork/SoundCloud tracks) from the Cave — the "@elements" prize + a Cave↔Firepit bridge.

## [2026-06-25] Forge reflow + tidy-up + watchdog fix — SHIPPED LIVE ✅

Doug's call: push the batch, then spec Elements. Merged `forge-higgsfield-layout` → `main` (fast-forward; rebased over the remote's automated `Daily snapshot` data commit first — disjoint files, no conflict), pushed (gitleaks clean), `railway up` for the backend.

- **Frontend (Vercel):** `thesoundcave.vercel.app` HTTP 200; served `index.html` contains the new `forge-dd` / `forge-dropzone` markup → reflow + icon-dropdowns + drop-blocks are LIVE. `main == origin/main @ 06d636a`; feature branch deleted.
- **Backend (Railway):** deployed; `/api/health` 200; **`/api/tracking/health` flipped `down`→`ok`** (`healthy:true`) — the watchdog false-alarm is fixed in prod (still trips on genuinely stale data). Duration-snap shipped in the same deploy.
- **Verified end-to-end** by polling the live health endpoint (down→ok on the 2nd poll) + curling the served frontend markup. Local dev servers stopped.
- **Feasibility grounded for the Elements spec:** roster carries `avatar_url`; `clan_tracker.fetch_all_user_tracks` → per-artist tracks (cover art + audio); Spirits = `avatars_api.py`. So the unified "Elements" panel is mostly merge+connect of existing pieces. Spec next.

## [2026-06-25] Launch-safety: Free Trial + invite-code gate (branch `free-trial-invite-gate` → cherry-picked to main)

Pre-flight before sending the live app to industry friends. Ran a 3-agent audit (auth/abuse, secrets/RLS, billing/credits). Verdict: **data is safe** (no leaked secrets, RLS + JWT scoping solid, credit-spend uncheatable) but **one money drain**: open signup + 100 non-expiring auto-credits + zero rate-limit → ~£6 fal/throwaway account, unbounded. Full reasoning: [decision 0012](decisions/0012_invite_gate_launch_safety.md). Spec: [spec/free_trial_invite_gate.md](spec/free_trial_invite_gate.md).

- **Fix — gate the gift, not the signup** (anon key is public, so signup can't be gated client-side): new accounts start at **0 credits**; trial credits gifted only by redeeming an invite code, server-verified vs `INVITE_CODES` (case-insensitive), once per account (`users.trial_claimed`), IP rate-limited.
- **Backend** ([content_api.py](../content_api.py)): `INVITE_CODES` + `FREE_TRIAL_CREDITS` env constants; in-memory per-IP limiter; `POST /api/redeem-invite` (atomic one-time claim → `grant_credits`); `/api/billing/plans` → Free Trial (active) + Starter/Pro (greyed `disabled`); `/api/me` returns `trial_claimed` (column-absent-tolerant for deploy-order safety). Migration [db/0020](../db/0020_free_trial_invite.sql): signup grant 100→0, add `trial_claimed`, mark existing rows claimed.
- **Frontend** ([js/app.js](../js/app.js), [index.html](../index.html), [css/style.css](../css/style.css)): 3-tier modal, Free Trial card with inline invite-code input + Claim flow (`redeemInvite`), greyed coming-soon tiers, tier-label map (solo→Free Trial), fresh-user "🎁 Claim free credits" relabel, fixed stale "Image 5cr" subtitle.
- **Glitch effect → all action buttons** ([js/cave_entrance.js](../js/cave_entrance.js)): the login hover text-scramble now fires on every action button site-wide via a delegated handler keyed off `.btn-red`/`.btn-outline` (+ `.glitch-cta` opt-in for bespoke ones: forage Clan/Watch/Cut, Trail Save, Marks new/save; `.no-glitch` opts out CANCEL/← BACK). Made the scramble icon-safe (writes the label text node, preserves SVG children) + emoji-safe. NOT on nav/selection/Reflection-settings buttons (Doug's call).
- **Audit correction:** `bypass.html` is NOT committed (gitignored, absent from history) — no public JWT exposure; left as-is.
- **Branch hygiene:** the feature branch was stacked on another session's unpushed Forge "Elements" commits; Doug chose to ship Free Trial **only**, so cherry-picked the single commit onto a clean branch off `main` (resolved content_api.py + log conflicts). Elements stays unshipped on its branch.
- **Verified:** `py_compile`+`node --check` clean; `/api/billing/plans` 3-tier; `/api/redeem-invite` registered + 401 without auth; Doug eyeballed the modal (screenshot — looks right). **NOT fired:** happy-path redeem (needs migration 0020 live) — to verify on prod post-deploy.
- **Go-live order:** apply db/0020 in Supabase · set `INVITE_CODES` (+ optional `FREE_TRIAL_CREDITS`) in Railway · `railway up` (backend) · push `main` (Vercel) · then real-flow redeem test + send the link.

## [2026-06-25] Wiki: write the image-gen provider decision page (0013) + refresh Forge "Related" links

Closed the longest-standing wiki TODO in the Forge feature page's "Related" list — `wiki/decisions/image_gen_provider.md _(TODO — write when picking primary vs fallback strategy)_`. The strategy was already decided and as-built in code; it just had no decision page.

- **New page** [decisions/0013_image_gen_provider.md](decisions/0013_image_gen_provider.md): **fal primary, Replicate fallback**, documented with evidence. v2 job router is fal-only and raises on failure ([media_gen.py:858-900](../media_gen.py#L858-L900), registry [:774-792](../media_gen.py#L774-L792)); legacy `generate_image()` fal→Replicate→raise chain ([:953-969](../media_gen.py#L953-L969)) survives only as the **ref-free** degrade path; `/api/generate-image` re-raises (never silently degrades) when a **ref-based** gen fails ([content_api.py:1087-1103](../content_api.py#L1087-L1103)). Why fal: model breadth (Nano Banana Pro / FLUX.2 / Seedream `/edit` routes have no Replicate equivalent), reference-native restyle/compose, verified-acceptable COGS ([0010](decisions/0010_media_gen_cogs_verified.md)). Follow-up logged: retire the legacy chain (and the Replicate dep) once Forge is fully proven on v2.
- **Refreshed** [features/firepit_forge.md](features/firepit_forge.md) "Related": the other two list items were also stale — `firepit_stash.md` and `firepit_trail_map.md` both exist now (Trail Map is built, not "not yet built"). Replaced all three `_(TODO)_` annotations with live relative links.
- No code changed — documentation only; the provider routing it describes was already shipped.

## [2026-06-25] Forge "Elements" — Phase 1 UI merge (branch forge-elements)

Doug: "roll it out." Wrote the spec ([forge_elements.md](spec/forge_elements.md)) — unify References+Spirit+Artist into one "Elements" panel + a Cave→Firepit artist-asset bridge, built in phases. Design direction approved (unified typed elements; artist auto-populate = suggest-not-force; tracks → cover-art element + audio Beat; create Spirits inline).

- **Phase 1 (UI merge) DONE:** collapsed `2·Style` + `3·Subject` → one **`2·Elements`** panel (References + Spirit + Artist under one header); renumbered Facts→3, Direction→4. Pure relabel/regroup — no input IDs moved, `gatherForgeContext` untouched. Verified on localhost (1·Format → 2·Elements → 3·Facts → 4·Direction), div 285/285. Shot: `scratch/forge_elements_p1_flyer.png`. NOT pushed.
- **NEXT:** Phase 2 = Cave bridge (artist → suggest avatar + track cover-art as elements); Phase 3 = tracks as audio/Beat.

## [2026-06-25] Forge "Elements" — Phase 2: Cave→Firepit artist-asset bridge (branch forge-elements)

The moat connection. Pick an artist in the Forge → a **"From the Cave — tap to add"** strip shows their SoundCloud avatar + top-track cover-art; tapping adds it as a reference (avatar→WHO, track art→STYLE).
- **Backend:** `/api/artist/<username>` top_tracks now carry `artwork`; new `/api/proxy-image` (auth + host-whitelisted to `*.sndcdn.com`, 5MB cap, SSRF-safe) downloads a CDN image → data-URL so Cave assets join the data-URL-only ref pipeline without CORS.
- **Frontend:** `loadArtistAssets()` (firepit.js) renders the strip on artist change; `addForgeRefFromUrl()` (forge_refs.js) proxies the tapped image → `_forgeRefImages`. Display via CDN URL (cross-origin `<img>` ok); only the add proxies. URLs upsized `-large`→`-t500x500`.
- **Verified end-to-end (localhost, admin):** "konzo" → 3 assets (avatar t500x500 + 2 track arts) → tapped avatar → added as WHO data-URL ref (refs 0→1, no error). `py_compile`+`node --check` clean, div 285/285. Shot: `scratch/forge_elements_p2_cavebridge.png`. NOT pushed.
- **Elements feature now P1+P2 = a coherent release.** Phase 3 (tracks as Animation audio/Beat) is the remaining piece. Bridge currently on single-artist formats (Still/Carousel); Flyer lineup could extend later.

## [2026-06-25] Forge "Elements" P1+P2 — SHIPPED LIVE + recovered from a concurrent-session branch tangle ✅

The Elements feature (UI merge + Cave→Firepit bridge) is live on prod. Getting there hit — and recovered from — the exact one-session-per-repo hazard our CLAUDE.md warns about.

- **The tangle:** a second session (free-trial-invite-gate) shared this working tree and `git checkout`'d its branch *between* my two Elements commits, so Phase 2 (`568581c`) landed on their branch + accidentally captured an early snapshot of their uncommitted invite-gate code (whole-file `git add`). They then shipped Free Trial to `main` rebased *without* my Elements. Net: my Phase 2 was orphaned-but-recoverable; main had their work, not mine.
- **Recovery:** branched off `568581c`, `git rebase --onto main 324b2f0` to replant Phase 1+2 onto the new main. Resolved conflicts: `wiki/log.md` (kept both entries); `content_api.py` (kept HEAD = main's finalized invite-gate for all 3 conflicts) + **removed the stray `trial_claimed` line my bad capture had added to `/api/me`**, so the diff vs main is *pure Elements*. Verified `git diff main -- content_api.py` = only `proxy_image` + `artwork`.
- **SSRF fix (commit security review):** `/api/proxy-image` now `allow_redirects=False` + 200-only (a whitelisted host can't 302 → internal). Verified sndcdn serves images at a direct 200, so the bridge still works.
- **Shipped + verified LIVE on prod:** merged `forge-elements-ship` → `main` (ff `25ffaa3..75a62bc`), pushed (Vercel), `railway up`. Live checks (authed): `/api/artist/konzo` → avatar + 2 track artworks; `/api/proxy-image` of a real sndcdn image → **data-URL (200)**; SSRF guard on `169.254.169.254` → **400**; invite-gate intact (`/api/billing/plans` 200, `/api/me` 401). Frontend serves `2·Elements`.
- **Lesson (again):** one session per repo, or worktrees. I should have re-checked `git branch` before the second commit. Branch cleanup done (mine deleted; `free-trial-invite-gate` left for the other session).
- **NEXT:** Elements Phase 3 (artist tracks → Animation audio/Beat).

## [2026-06-25] Mobile elevation pass — native-grade phone UX (branch `mobile-ux`)

Goal (Doug): make S0UNDCAV3 "fit for purpose on mobile … show people on the move," same essence/branding, on a worktree off `main`. The app was already *functional* on phones (stage-1 shell + scattered component media queries); this pass takes it functional → native-grade. All changes additive inside `@media (max-width:720px)`/`560px`, built on `tokens.css`, palette law intact, **desktop untouched** (verified `mobileTabbar` = `display:none` @1280px). Files: `css/mobile.css` (expanded), `index.html` (tab-bar markup). Full detail + follow-ups in [spec/mobile_responsive.md → Build log](spec/mobile_responsive.md).

- **Icon bottom tab bar** (cave/firepit/person `sc-icon`s inlined as HTML — the `data-icon` hydrate path renders SVG-namespaced nodes CSS can't size, so they came out 0×0; inline fixes it), active-glow + indicator, backdrop blur, safe-area, tap feedback.
- **Header fix:** the ≤700px `.htab span:not(.count){display:none}` rule was blanking the sound toggle into an empty box — restored as a compact ghost control; logo shrunk; notch-safe top.
- **Segmented scroll sub-nav pills · ≥46px touch targets · 16px inputs (no iOS zoom) · full-width primary CTAs · legibility bump.**
- **Forge hero:** sticky FORGE/ANIMATE CTA above the tab bar (core action always thumb-reachable).
- **Full-screen sheets** for the artist panel + centred modals; full-width Trail Map drawer; trimmed cavernous gaps.
- **Verified** via headless-Chromium harness at 390×844 across all 9 screens + the panel sheet (`scratch/mobile_shots.js`, gitignored). Not deployed; built in a worktree off `main` for review.

## [2026-06-25] Mobile fixes — dead cave sub-nav + silent ambient drone (branch `mobile-ux`)

Two bugs Doug hit testing the preview on his phone.

- **"Tabs in the cave don't work."** Root cause: the empty-state overlay `.stack-empty` (`position:absolute; inset:0; z-index:10`) anchors to the nearest *positioned* ancestor — but `.container` is unpositioned, so on an **empty cave** the overlay escaped to fill the whole viewport, an invisible layer swallowing every cave sub-nav tap (header + bottom tab bar survived — higher z-index). Doug's cave is empty, so he got it square-on. Fix (mobile.css, ≤720px): `.cave-hero{position:relative}` bounds the overlay to the hero box (below the pills), `.cave-subnav{position:relative;z-index:30}` as belt-and-braces. Verified: `elementFromPoint` over the FORAGING pill now returns the button (was `.stack-empty`); a real `.tap()` fires `switchTab:foraging`.
- **"Can't hear the Soundcave noise."** Not a regression — ambient sound starts OFF by design (autoplay is gesture-gated) and only ever started if you found the `{SOUND}` toggle (a small chip on mobile). Fix (`cave_entrance.js`): start the drone on the **first `pointerdown` anywhere**, unless explicitly muted (`sc_sound_on === '0'`); fires once; the toggle still mutes and persists. Audio asset is committed + serves 200, so no 404. Also bumped the mobile sound toggle to a 44px target. **Behaviour change (global, not just mobile) — flag for Doug:** the drone now auto-starts on first interaction; revert to toggle-only if unwanted.

## [2026-06-25] Mobile follow-up — ambient drone still silent for Doug (stale-mute suppression)

Doug (logged in, heavy prior testing) still got no sound after the first-gesture autostart. Likely cause: my autostart **respected a stored mute** (`sc_sound_on === '0'`), and a stale 'off' from earlier testing was suppressing the drone for exactly the person reporting it. Fix (`cave_entrance.js`): first-gesture autostart now **ignores the stored mute** — the drone is the brand signature, so it starts on the first gesture regardless; the toggle still mutes for the rest of the session (autostart is one-shot). Also broadened the gesture set to `pointerdown/touchend/click/keydown`. **Still environment-bound on iOS:** the hardware ring/silent switch mutes ALL web audio (WebAudio + `<audio>`) — unfixable from web short of a `<video>` hack — and the drone is deep/ambient ("HEADPHONES RECOMMENDED"), so phone speakers reproduce it poorly. Asked Doug to confirm silent-switch + output.

## 2026-06-26 — Forge: carousel per-slide text, output meta panel, button fixes

Branch: `forge-carousel-output-panel` (cut from `forge-output-ux`). Commit `f789e95`.

**What landed:**
- **Per-slide text inputs (Carousel)** — when Carousel format is selected, N labelled text inputs appear below the slide picker (one per slide). User types artist name, date, venue, event info etc. These replace the LLM-split `---` copy as the baked text on each image. Fall back to the old LLM-split behaviour if all inputs are blank. Values persist to Stash (`slideTexts`) and restore on edit.
- **Output meta panel** — a persistent strip at the bottom of the output card shows: Direction text, Format+size (e.g. "Carousel · 4:5 · 5 slides"), Reference image thumbnails, and Model/quality (provider, model, dims). Populated as soon as FORGE is clicked; model fills in once the first image returns. Cleared on DISCARD.
- **API indicator removed** — the "API: CONNECTED" green dot in the Firepit header is gone entirely. `checkApiStatus()` call removed from `renderFirepit()`; function kept.
- **Button stuck-animation fix** — `saveToStash` now disables during async + re-enables in `finally`. `refineImage` and `makeBeatVideo` moved their button restore into `finally` blocks (previously after try/catch, could silently stay disabled on uncaught throws).
- **DOWNLOAD ALL** — new action button for carousel sets; triggers sequential blob downloads, one file per slide (`soundcave_slide_01.png` … `_05.png` etc.), with 350ms gap between triggers.

**Spec:** `wiki/spec/forge_carousel_per_slide.md`

## [2026-06-26] Per-friend single-use invite codes — SHIPPED LIVE + verified (branch `invite-codes` → main)

Replaced the env `INVITE_CODES` shared-pool gate (from [0012](decisions/0012_invite_gate_launch_safety.md)/[0020](../db/0020_free_trial_invite.sql)) with **per-friend, single-use, DB-backed codes** so Doug can send the live app to industry friends without a leaked code reopening the fal drain. Spec: [invite_codes_per_friend.md](spec/invite_codes_per_friend.md).

- **Why:** a shared code is redeemable once *per account* but *unlimited times across accounts* → one leaked code = every new signup claims credits (drain returns) + no attribution. A code consumed by the **first account to redeem it** makes a leak already-spent, and records who/when.
- **Migration `db/0021_invite_codes.sql`** (applied to prod): `invite_codes` table (code · label · credits · redeemed_by · redeemed_at), RLS on with no policies (service-role only — codes are secrets, never browser-readable).
- **Backend** ([content_api.py](../content_api.py) `/api/redeem-invite`): claim the **code** first (atomic single-use, 403 on unknown *or* used → no enumeration; account untouched on a bad code), then claim the **account** (one trial each; roll back the code if already claimed so a fresh code isn't wasted → 409), then `grant_credits(code.credits)`; roll back both on grant failure. Default grant **100→50** (Doug's call). Frontend untouched (existing Claim flow still POSTs `{code}`). Killed dead `hmac` import + the superseded env `INVITE_CODES` constant.
- **Scripts** (run from project root; never commit a live code — repo is public): [scripts/mint_invite.py](../scripts/mint_invite.py) `"email" --code X` issues a code (prints to terminal only); [scripts/list_invites.py](../scripts/list_invites.py) shows the open/redeemed ledger.
- **Deployed:** merged `invite-codes` → `main` (merge `603cd12`; auto-merged content_api.py with the concurrent Beat session's `cb8cdfd`, both kept, compiles), pushed (gitleaks clean), `railway up`. Prod `/api/billing/plans` Free Trial now shows 50.
- **Real-flow verified on prod** (throwaway codes + 2 throwaway accounts via admin generate_link, all cleaned up): valid redeem → **200 + 50 credits granted** (balance landed); same spent code → **403**; **second account, same code → 403 (single-use ✅)**; already-claimed account + fresh code → **409**, fresh code stayed **open** (rollback, no waste); per-IP limiter fired **429** after 8 hits. Every spec acceptance criterion met.
- **First codes minted (open, 50cr each):** for georgeshipton8@gmail.com and josh@grail-talent.com. Code strings live only in the DB + Doug's records (not git).
- **Also:** corrected stale local `.env` `FREE_TRIAL_CREDITS` 100→50 (it over-minted the first codes to 100; patched both rows back to 50). Railway has no override → defaults to 50, matching the plan card.
- **Concurrent-session note:** built in isolated worktree `~/Documents/thesoundcave-invite-wt`; the Beat work landed on main mid-session — the merge combined cleanly. Worktree isolation paid off again.

## [2026-06-26] Mural — wheel-cycle capture + chart date-label thinning (branch `mural`)

Two small Mural fixes Doug asked for (worktree off `main`).

- **Diagonal clan stack "scrolled to the bottom of the page" instead of cycling.** Root cause in `js/cave.js attachStackInteractions`: the old wheel handler had a `Math.abs(delta) < 5` early-return that fired *before* `preventDefault`, so slow trackpad scrolls (tiny per-event deltas) fell straight through to the page; plus a 220ms hard lock that only ever advanced one card per burst. Rewrote it: bind the `wheel` listener on `#caveHero` and gate on `e.target.closest('.cave-stage')` — so the whole diagonal window owns the wheel (even cards that visually overflow the stage box are DOM children of it) while the side rails leak through to normal page scroll. Cycling is now a **delta accumulator** (`_caveWheelAccum` += delta, step one card per `CAVE_WHEEL_STEP = 50`px), so a gentle nudge = one artist and a fast flick = several — proportional, device-agnostic. Removed `_caveWheelLock`. This realises the spec's "scroll cycles… smooth, springy, never abrupt" intent ([spec/cave_dashboard_redesign.md](spec/cave_dashboard_redesign.md)). **Behaviour note for Doug:** while the cursor is over the window the page won't scroll — move onto the side panels/margins to scroll past the dashboard (that was always the documented "rails own page scroll" design).
- **Chart x-axis dates crowded once multiple days accumulate.** `buildLineChart` (`js/app.js`) now thins the printed date labels to a calendar-friendly stride — `[1, 2, 7, 14, 30, 60, 90, 180, 365]` days — picking the smallest stride so at most `~maxLabels` fit the chart's pixel width (`maxLabels = clamp(floor(cw/70), 4..10)`), anchored to the **last** point so today's date always shows. Daily snapshots → an index stride maps straight to a calendar frequency: daily → every 2 days → weekly → fortnightly → monthly as the series grows. The line keeps every data point (full fidelity, every point still hovers a tip); only the labels thin. Fixes all 4 `buildLineChart` callers (cave strip, stat-modal, artist modal, footprints) in one place.
- **Verified live** (Playwright, 8-artist seeded clan, 18 snapshot days): wheel over window cycles +1/+3/wraps with `defaultPrevented=true`; wheel over a rail panel leaves the stack and is **not** prevented (page scrolls). Cave strip → 9 labels every 2 days (06-09…06-25); stat-modal (560px) → weekly (06-11/06-18/06-25). 0 console errors. Shots: `scratch/mural_hero.png`, `scratch/mural_chart.png`.

## [2026-06-29] Brand assets — one easy-to-find home (`brand/`)

Doug asked to gather the S0UNDCAV3 logos & brand assets somewhere easy to find. They were partly already in `brand/` (logos + fonts) but the app-icon/favicon set lived only at the repo root and nothing catalogued the lot.

- **`brand/` is now the single source of truth.** Added `brand/icons/` holding reference copies of the app-icon set — `favicon.svg` (512², logo on the dark rounded square), `favicon-32.png`, `apple-touch-icon.png`.
- **Deployed icon copies stay at the repo root** (`index.html` links them root-relative because GitHub Pages serves icons from site root) — the README flags the root copies as the live ones and the `brand/icons/` copies as findable masters, with a don't-drift note.
- **Rewrote `brand/README.md`** into a complete index: a "just need the logo" quick-grab table, a folder tree, a full asset list (logos + dormant alt + icons + fonts), plus the existing locked palette & type. No mark/colour was changed — purely organisation + documentation.
- **Wiki:** added a **Brand** section to [index.md](index.md) pointing at `brand/README.md` (distinct from the brand-kit *spec* pages in `wiki/spec/brand_*.md`).

## [2026-06-29] Brand — horizontal banner for social profiles (Reddit)

Doug wanted a logo-left / wordmark-right lockup sized for his Reddit profile banner, as a raster file.

- **Added `brand/banners/soundcave_banner_reddit_1920x384_2026-06-29.png`** — the master logo SVG (`brand/logo/soundcave_logo_2026-05-11.svg`) on the left + `S0UNDCAV3` wordmark on the right, on cave-black `#0a0a0a`. Wordmark is DM Mono, weight 500, uppercase, `0.18em` tracking, `#e8e8e8` — exactly the splash lockup tokens. Subtle `{HEADPHONES RECOMMENDED}` tag beneath in muted `#888`. 1920×384 (5:1), the standard Reddit profile-banner size; lockup centred so mobile centre-crop never clips it.
- **How it was made:** composed an HTML lockup (`@font-face` → `brand/fonts/DMMono-Regular.ttf`, inline logo SVG) and rasterised with the pre-installed Playwright Chromium (`--headless --screenshot`, `--window-size=1920,384`). No new mark/colour — pure composition of existing brand assets.
- **`brand/README.md`** now has a *Banners / social* section + quick-grab row, with a note on re-rendering other sizes (e.g. X header 1500×500) keeping the group centred.
