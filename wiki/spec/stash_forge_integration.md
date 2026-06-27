# Stash → Forge Integration — UI spec

**References:** Existing Forge dropzone + Spirits modal patterns
**Mood/feel:** Seamless pull from your own archive — no file picker, no re-uploading work you already made
**Hero moment:** Tap FROM STASH, see a grid of your work, pick one — it lands as a reference or animation source in one tap
**Anti-examples:** Not a second Stash view — just a fast picker, no extra chrome
**Constraints:** Dark, existing design tokens, caveman-label conventions, mobile-aware

## What shipped (2026-06-26)

### 1. FROM STASH in Forge references
- New `forge-stash-btn` sits alongside the Upload dropzone in the Elements section
- `openStashPicker()` opens a 3-column image grid modal (matching Spirits modal dark style)
- Pick → calls `addForgeRefFromUrl(item.imageUrl, 'style', '')` → image proxied to dataURL → role-tagged as STYLE and added to refs panel

### 2. FROM STASH in Animation
- Same button pattern on the Animation Artwork dropzone
- Pick → stores URL in `_forgeAnimSourceUrl`, shows thumb preview, clears file input
- `generateAnimation()` resolves: file wins if present, else proxies `_forgeAnimSourceUrl` to Blob → sends to `/api/conjure`

### 3. FROM STASH in Gatherings flyer (event edit)
- `{FROM STASH}` button below `{UPLOAD MEDIA}` in the Media field on the event edit form
- Pick → proxy image URL → convert to Blob → POST to `/api/events/{id}/flyer` → form re-renders with new thumb
- No backend changes needed

### 4. {CLEAR ALL} on Forge Input card
- Small mono chip top-right of the Input card — always visible
- `newForge()` clears all text inputs, reference images, animation source, and calls `resetForgeOutput()`
- Solves the "locked in a Stash item" problem — one tap to start a clean forge

## Files changed
- `js/stash_picker.js` (new) — reusable picker modal
- `css/style.css` — stash picker + forge-clear-btn + forge-stash-btn styles
- `index.html` — CLEAR ALL button, FROM STASH buttons, stash_picker.js script tag
- `js/firepit.js` — `newForge()`, `addStashAsRef()`, `addStashAsAnimSource()`, `_forgeAnimSourceUrl`, modified `generateAnimation()`
- `js/events_form.js` — FROM STASH button in `renderFlyerField`
