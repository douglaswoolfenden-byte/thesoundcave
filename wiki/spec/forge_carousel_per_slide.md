# Forge — Carousel Per-Slide Generation + Output Panel — UI spec

**Captured:** 2026-06-26

**References:** Screenshot of current carousel output (5-thumbnail-on-1-image smoking sequence); UNTZIG flyers (locked-zone skeleton for lineup/announcement sets); Submerge / XK studio (slide-number discipline `01/02/03`); existing `forge_output_refs.md` carousel section.

**Mood/feel:** Underground music campaign studio. Same dark DNA as the rest of the Forge — `#0a0a0a` ground, off-white type, single `#ff4500` accent. The carousel output should feel like a designer made it, not a template. Text is *baked in* (not an overlay the user edits after) — that's the product promise. Continuity across slides is non-negotiable: same models/scene, same type system, same grid.

**Hero moment:** User hits FORGE → 5 separate download-ready images land in the output panel, each with scene-consistent AI imagery + their text (artist name, date, venue — whatever they typed per slide) baked correctly. Drag-and-drop onto Instagram Stories or TikTok, done. Zero external editing.

**Anti-examples:** Canva template-picker vibe. Anything that looks like a stock social-media-kit. No light-mode, no rounded corners, no gradient backgrounds. No "slide 1 of 5" badge in a bubble.

**Constraints:**
- Dark palette only — `#0a0a0a` bg / `#e8e8e8` body / `#ff4500` single accent. Never flip.
- Vanilla HTML/CSS/JS — no framework.
- `tokens.css` already exists at project root — reference via `var(--...)` only, never hardcode hex/px.
- Mobile-aware but desktop-first (Forge is a desktop creation tool).
- Files must stay under 500 lines each (architecture rule).

## Scope of this branch (`forge-carousel-output-panel`)

### 1 — Per-slide carousel generation
- Each carousel slide = **one separate image** (currently all slides are thumbnails on a single image — fix this)
- Per-slide text field: user types whatever they want on each slide (artist name, tour date, venue, event copy) — one text input per slide
- Backend passes per-slide text to image gen so it's **baked into the image**, not overlaid in JS
- Slide count: 5–10 (user-controlled, as today)
- Consistency lever: locked-zone skeleton approach (UNTZIG ref) — header zone + type zone stay at identical coordinates across all slides; only content swaps
- Slide number badge: `01 / 05` style (Submerge ref), small, monospaced, bottom-left or top-right corner

### 2 — Output panel (right-hand side)
Show a persistent metadata strip alongside every generated output (not just carousel), covering:
- **Direction text** — the direction/prompt the user typed
- **Format + size** — e.g. "Carousel · 4:5 · 5 slides"
- **Reference image thumbnails** — small strip of style refs used
- **Quality / model** — e.g. "FLUX schnell · 12.3s"
Panel must be consistent across all format types (Post, Carousel, Flyer, Animation).

### 3 — Remove API status indicator
Remove the "API: CONNECTED" green dot + label from the top-right header. Nothing replaces it.

### 4 — Fix button animation stuck bug
Action buttons (SAVE TO STASH, R?+#_, NEW IMAGE, DOWNLOAD, DISCARD) can get stuck mid-animation. Investigate and fix the stuck state.

## Build notes
_(add decisions made during build here)_
