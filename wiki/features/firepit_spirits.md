# Feature: Firepit — Spirits (avatar system)

> Status: **Code-complete 2026-06-09** (Image Gen v2 Phase 3). Gated on applying `db/0016_avatars.sql` before it runs end-to-end.

## What it does
A **Spirit** is a named, reusable set of reference images for a recurring character, mascot, or specific artist. Summoning a Spirit into a Forge generation passes its reference images to the image model so the same face/character stays consistent across flyers — the direct fix for "uploaded an artist photo, got nothing like them."

"Spirit" is the caveman-vernacular name for what the backend calls an `avatar` (see `wiki/spec/image_gen_v2.md` Phase 2/3). Internal table/field names stay `avatars` / `avatar_id`.

## How it works
- **Selector:** Forge input card always shows a **Spirit** dropdown (`#forgeSpiritSelect`) + a red **+ SUMMON** button (always-visible beat discoverability — an Artist-Bio-only gate buried it). Selecting a spirit affects any type; routing only upgrades **Artist Bio** to the avatar model, while a spirit's reference images are injected for all types.
- **Modal (`js/spirits.js`):** list existing spirits (preview + ref count + banish), and a *Summon a Spirit* form (name, description, multi-image upload → `FormData` POST `/api/avatars`). After create/delete it calls `loadSpirits()` to refresh the Forge select.
- **Generation:** when a Spirit is selected, `gatherForgeContext()` adds `avatar_id` (+ `avatar_image_url` = preview). `/api/generate-image` (content_api.py) then:
  1. resolves the owner-scoped avatar row and **prepends its `reference_image_urls` to `image_refs`** (capped at 10 — fal limit),
  2. `job_type_for('artist_bio', has_avatar=True)` → **`avatar`** job → Nano Banana Pro (character-consistency model).
  - Logs `refs=N (spirit:M + ctx:K)` so ref usage is visible, not promised.

## Data / infra
- Table `avatars` (migration `db/0016_avatars.sql`) — RLS owner-scoped; `reference_image_urls text[]`, `preview_url`.
- Storage bucket `avatar_refs` (uploads) — **created 2026-06-09**. `generated_assets` also created.
- API: `avatars_api.py` — GET/POST/PATCH/DELETE `/api/avatars` (multipart `name`, `description`, `files`). Already built in Phase 2.

## Acceptance criteria
- [x] Spirit selector in Forge (Artist Bio) + manage modal (create/list/delete)
- [x] Backend injects spirit reference images into generation + routes to avatar model
- [ ] **Apply `db/0016_avatars.sql`** (Supabase SQL editor) — gates the below
- [ ] Live-fire: summon a spirit from 2–3 photos, generate Artist Bio, output resembles the references (`job=avatar model=…nano-banana`)
- [ ] Screenshot-confirm with Doug

## Dependencies
- `js/spirits.js` (modal), `js/firepit.js` (selector + ctx), `content_api.py` (ref injection), `avatars_api.py` (CRUD)
- `wiki/spec/image_gen_v2.md` (the v2 architecture + phases), `wiki/spec/forge_output_recipes.md` (artist_bio → avatar routing)

## Not yet / future
- Spirits only surface for Artist Bio in v1 (the recipe's avatar case). Broader use (any type pulling a spirit's refs for consistency) is a later extension.
- Editing an existing spirit's references in the modal (PATCH exists on the backend; UI is create/delete only for v1).
- LoRA-trained avatars (v3, deferred in the spec).
