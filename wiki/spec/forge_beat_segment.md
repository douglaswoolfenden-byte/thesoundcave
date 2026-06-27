# Forge Beat — waveform segment picker — UI spec

> Status: **BUILT + verified locally (branch `forge-beat-from-cave`, 2026-06-26)** — pending Doug
> screenshot-confirm, then merge→main + Railway deploy. The slick build of the
> **clip-picker** already specced in [firepit_beat.md](../features/firepit_beat.md) ("a Beat is a
> clip window on the track: `start_seconds`/`end_seconds`, capped at 10s … the *manual* version of
> OpusClips-style clipping"). Today that picker is a bare file input + a hard-coded 10s from the
> start. This makes it the hero: **upload a track → scrub the waveform → drop a window on the exact
> bit you want → that segment scores the video/image.**
>
> Pivoted here from "Elements Phase 3 = pull SoundCloud track audio" — Doug's call (2026-06-26):
> *"assume no barriers for audio upload … a very slick feature where we upload a track and very
> easily select the part of track we'd like input for the video or image."* SoundCloud stream-ripping
> is off the table (ToS + fingerprint strikes — the thing the Beat gate exists to prevent); the user
> uploads the file. See [forge_elements.md](forge_elements.md) for the prior phases.

## The 5 (UI-change-protocol)
- **References:** the universal waveform-trim pattern — SoundCloud's own scrubbable waveform,
  CapCut / IG-Reels / TikTok audio trimmers (drag a window over a waveform, hear the selection).
  Skin = Sound Cave dark, **not** the light/clinical look of those tools.
- **Mood/feel:** tactile and underground — *a DJ dropping the needle on the bit that hits*. The track
  is the product; choosing the drop should feel like cueing, not filling in a form field.
- **Hero moment:** dragging the selection window across the waveform and hearing the drop snap into
  the clip — the segment that will carry the post.
- **Anti-examples:** a bare `<input type=file>`; a numeric "start time (seconds)" box; a fiddly
  light-mode editor; pulling in a heavy library (WaveSurfer.js) for one canvas.
- **Constraints:** vanilla HTML/CSS/JS off the existing `css/style.css` tokens (`--color-accent`
  #ff4500, `--bg`, `--border`, `--muted`, `--space-*`); **no audio library** — waveform via the
  native Web Audio API on a `<canvas>`; touch-draggable (mobile); window length bound to the
  Kling/FFmpeg clip durations (5s / 10s, 10s hard cap = `MAX_VIDEO_DURATION_SECONDS`).

## What's built vs. what this adds
- **Today:** `forgeBeatPanel` = file input + rights dropdown + proof link → `makeBeatVideo()` →
  `POST /api/generate-media` (`video_composite`) → `_ffmpeg_composite` muxes the audio under the
  still (Ken Burns + showwaves). The composite **always starts the audio at 0:00** and runs
  `-t duration`. `start_seconds`/`end_seconds` were specced but never wired into FFmpeg.
- **This adds:**
  1. **Frontend** — a waveform + draggable selection window in the Beat panel. Decode the uploaded
     file once (`AudioContext.decodeAudioData`), draw downsampled peaks on a `<canvas>`, overlay a
     drag-to-move selection window (width = chosen clip length), a play/▮ preview that auditions
     **only** the selected window with an animated playhead, and start/end time labels. Emits one
     value: `audio_start_seconds`.
  2. **Backend** — thread `audio_start_seconds` (float, ≥0, default 0) through
     `generate_media_endpoint` → `_dispatch_media` → `generate_video_composite` → `_ffmpeg_composite`,
     which adds `-ss {start}` **before** the audio `-i` (input seek; fast + frame-accurate enough),
     keeping the existing `-t {duration}` / `-shortest`. One small param on each hop; no new endpoint.

## Interaction model (the one real decision — see sign-off)
- **A — Fixed window, drag to move (recommended).** The window is exactly the clip length (5s or 10s,
  follows the duration control); you drag it left/right along the track to pick the start. One gesture,
  impossible to set a wrong length, maps 1:1 to Kling's fixed 5/10s. Emits `start`; length is implicit.
- **B — Two handles (in + out).** Drag independent start/end handles, free length up to the 10s cap.
  More expressive (sub-5s clips), but a second thing to fiddle and it can fight Kling's fixed lengths.

## Rights ("no barriers", Doug 2026-06-26)
The slick select→preview→forge flow is **not** gated. The backend rights gate (`_audio_rights_ok`,
classify before *scheduling*) stays intact — it's the real protection against retroactive strikes — but
it fires at the **Trail Map / schedule** step, not here. In this panel rights is a small defaulted
footer ("This is my track / I have permission"), never a wall in front of making the video. Keeps the
hero frictionless without deleting the safeguard.

## Build notes
- Decode + peak extraction is O(n) over samples once on upload; cache the peak array so redraws
  (resize, window drag) are cheap. Cap decode work by reading one channel + striding to canvas-width buckets.
- Preview playback = `AudioBufferSourceNode` started at `start`, stopped at `start+len` (or a
  `<audio>` element with `currentTime`+`timeupdate` guard — simpler, reuse for the playhead).
- `-ss` as an **input** option (before `-i audio`) so showwaves reads from the sought position too,
  i.e. the waveform overlay matches the audio you hear.
- Caveman naming is **Doug's call** — working labels only ("Beat", "USE THIS BEAT", "pick the drop"?).

### Build (2026-06-26) — DONE on `forge-beat-from-cave`, verified
- **New module `js/beat_segment.js`** (~165 lines; firepit.js was already 1476, over the 500 cap —
  kept it out). Owns decode→peaks→canvas draw, the drag-window (pointer events, `touch-action:none`
  for mobile), preview (plain `<audio>` + rAF playhead, auditions only the window), and teardown.
  Emits `beatSegmentStart()`. Loaded before `firepit.js` in `index.html`.
- **HTML** (`index.html`): waveform block added inside `#forgeBeatPanel`; file input now
  `onchange="beatSegmentInit(...)"`; CANCEL + a successful forge both call `beatSegmentReset()`.
- **CSS** (`css/style.css`): `.beat-*` classes off the tokens; the dim-outside is one
  `box-shadow: 0 0 0 9999px rgba(0,0,0,.58)` "spotlight" on the window (no per-frame canvas redraw).
- **Backend** (`media_gen.py` + `content_api.py`): `audio_start_seconds` threads
  endpoint → `_dispatch_media` → `generate_video_composite` → `_ffmpeg_composite`, which adds
  `-ss {start}` **before** the audio `-i`. `py_compile` + `node --check` clean.
- **Verified locally:** (1) UI via Playwright on the real page — 24s synth track with a drop at
  10–16s → window sized exactly `(10/24)×canvas`, drag → `start=11`, label + spotlight track
  correctly; shot `scratch/beat_segment_drop.png`. (2) **Seek functionally proven** — ran the exact
  ffmpeg command for `start=0` vs `start=11` on the same drop-heavy track: mean_volume **−13.0 dB**
  (quiet intro) vs **−5.7 dB** (the loud drop), both 10.00s. The `-ss` genuinely picks the segment.
- **Not yet:** real end-to-end through the live app (auth + a generated still + credits) — the unit
  pieces are each verified; the full prod render happens at deploy-verify.
- **Follow-ups parked:** length control in this panel (5s option; today fixed at the composite's 10s);
  attach a Beat to the Kling Animation output (mux audio onto the i2v MP4), not just the composite path.
