# Forge Output Recipes — per-type media generation spec

**Status:** Approved 2026-06-09 (Doug signed off the 5 recipes + sourced references).
**Supersedes:** the flat "everything is 1080×1350 with a generic style hint" behaviour.

## Why this exists
Forge generated every post type the same way — same dimensions, near-identical treatment, the text
prompt often flattened by a weak model, reference images never passed. A "post" and a "poster" came
out indistinguishable. This spec gives each type its own **output recipe**: format, composition
intent, style language, the context + reference images it feeds the model, and the model it routes to.

## Load-bearing architecture finding (from reference research)
Real underground posters/posts = **a dark backdrop on one layer + type stacked over it in a fixed
frame**, with type usually the hero (ref: Joe Prytherch / Boiler Room). This validates our pipeline:
**the image model generates the backdrop/hero ONLY; the Konva compositor (`js/compositor.js`) overlays
type + logo.** Never ask the model to render text — it renders text badly. Every recipe below assumes
backdrop-from-model + type-from-compositor.

## House style (when no client brand kit overrides)
Palette is **non-negotiable dark** (see memory `feedback_soundcave_palette`): near-black `#0a0a0a`,
off-white `#e8e8e8`, a SINGLE orange-red `#ff4500` accent used sparingly on exactly one element.
Monospace + grotesk type, high contrast, grain/halftone/CRT/VHS texture, brutalist, underground-dance.
Client brand kits override palette/logo; the house style is the fallback.

## Trust mechanism (Doug's reassurance ask)
Both the **text prompt** (`build_image_prompt`, media_gen.py:120) AND the **reference images**
(`image_refs` → up to 10 via FLUX.2 / Nano Banana) are always used. Every generation logs the exact
prompt + which refs were attached, so it's visible, not promised.

## The 5 recipes

| # | Type (`content_type`) | Format | Model (job_type) | Purpose |
|---|---|---|---|---|
| 1 | Post (`social_post`) | 1080×1350 4:5 | Seedream (`JOB_BACKGROUND`) | scroll-stop feed image: release / mood / announcement |
| 2 | Carousel (`social_carousel`) | 1080×1350 slides | **FLUX.2 seed-locked** (`JOB_HERO_ART`) | multi-slide lineup reveal / tracklist / recap |
| 3 | Event Promo (`event_promo`) | 1080×1350 4:5 | FLUX.2 (`JOB_HERO_ART`) | atmospheric teaser, "something's coming" |
| 4 | Event Poster (`event_poster`, was `lineup_poster`) | 1080×1350 portrait | FLUX.2 seedable (`JOB_HERO_ART`) | full lineup poster, type-heavy |
| 5 | Artist Bio (`artist_bio`) | 1080×1350 4:5 (image now ON) | FLUX.2, or Nano Banana (`JOB_AVATAR`) if avatar set | artist spotlight |

### 1 — Post
- **Composition:** full-bleed dark backdrop, single focal texture/subject, deliberate empty zone for one
  keyword. Optional catalogue-number motif (e.g. `REL-014`) in mono — borrowed from Mord Records.
- **Style language:** one hot `#ff4500` accent only; photo/subject crushed toward near-monochrome so any
  client image still reads on-brand; grain.
- **Context + refs:** artist context + freeform copy → `build_image_prompt`; pass any brand/reference
  images as `image_refs`.
- **Ref anchor:** Possession (`possessiontechno`), Mord Records.

### 2 — Carousel
- **Consistency lever (the hard part):** pick ONE per carousel and hold it across slides —
  (a) locked zone skeleton (header/metadata/accent in identical coordinates), (b) one repeated motif
  pinned identically, or (c) shared baseline grid + `01/02/03` mono slide-numbers. Default: **(c) for
  ordered reveals/tracklists, (a) for lineups.**
- **Why FLUX.2 not Seedream:** Seedream ignores `seed` (media_gen.py:387) → slides drift. FLUX.2 honours
  seed → lock one base seed per carousel so slides share latent space.
- **Ref anchors:** UNTZIG flyer system (skeleton), Submerge (grid + numbering).

### 3 — Event Promo
- **Composition:** ONE atmospheric image (fog / smoke / lone figure / warehouse), heavy negative space,
  a single line of text. Anticipation, not an info dump. The opposite of the poster.
- **Style language:** dark, moody, minimal; single `#ff4500` hot point against near-black.
- **Context + refs:** event context (name/date/venue) + artist → prompt; brand refs as `image_refs`.
- **Ref anchors:** Julia Lutska "Techno", DARK FACES (real promoter teaser cadence).

### 4 — Event Poster
- **Composition:** model generates the **backdrop only** (dark / smoke / grain / brutalist texture).
  Compositor overlays the type hierarchy: headliner large → supporting acts descending → date/venue in a
  small fixed footer band. One locked monospace + grotesk. `#ff4500` on headliner or date only.
- **Style language:** type-as-hero, fixed-frame, industrial. Skip playful display faces; stay brutalist.
- **Context + refs:** event + full lineup (billing order) + brand refs as `image_refs`; seedable for regen.
- **Ref anchor:** ★ Joe Prytherch / Boiler Room poster series.

### 5 — Artist Bio
- **Composition (face-dodging — model renders faces badly):** depict the figure as one of three, never a
  literal face — (a) duotone/halftone crush of a portrait, (b) **name-as-hero, no figure** (heavy display
  name on concrete/grain — the safe fallback), (c) portrait masked inside a bold letterform. Then heavy
  display name + genre + one bio line.
- **Model:** FLUX.2; if the artist has an avatar set, route to `JOB_AVATAR` (Nano Banana Pro, character
  consistency).
- **Context + refs:** artist profile (name/genre/bio_short) + any avatar/reference image as `image_refs`.
- **Ref anchors:** Spotify Duotone Portraits, WNTRGRND (no-figure), Jessica Brankka (letterform mask).

## content_type → job_type resolver (implementation)
Add `_job_type_for(content_type, has_avatar, has_refs)` in media_gen.py — one dict + a couple ifs:
- `social_post` → `JOB_BACKGROUND`
- `social_carousel`, `event_promo`, `event_poster` → `JOB_HERO_ART` (carousel also passes a locked seed)
- `artist_bio` → `JOB_AVATAR` if `has_avatar` else `JOB_HERO_ART`

## Removed types
`social_short` (video — out) and `press_release` (out). Drop from `js/firepit.js`,
`js/compositor_templates.js`, `media_gen.py` dimension/style maps.

## References
Full lift/skip breakdowns live in `wiki/design_references/forge_output_refs.md`. Palette law applies:
references are **technique-only** — never flip the dark palette to match a reference.
