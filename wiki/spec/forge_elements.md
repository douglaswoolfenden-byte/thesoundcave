# Forge "Elements" — unify references / spirits / artists + Cave→Firepit bridge — UI spec

> Status: **APPROVED in direction 2026-06-25 ("roll it out")** — build in phases on branch `forge-elements`. Phase 1 (UI merge) first; Cave bridge + tracks follow.
> Builds on [forge_layout_higgsfield.md](forge_layout_higgsfield.md) (the shipped left→right reflow). Essence: [0008 — Campaign Studio first](../decisions/0008_campaign_studio_first.md).

## The idea
Today the Forge input has **three separate sections** for what is conceptually one thing — *the stuff that goes into the generation*:
- `2·Style` — uploaded **References** (role-tagged WHO/WHERE/WHAT/STYLE)
- `3·Subject` — **Spirit** (a saved character/avatar) + **Artist** (from the roster)

Doug's call: collapse these into **one "Elements" panel** (Higgsfield's model — a library of named, reusable, `@`-mentionable assets). And — the strategic part — **wire the Cave into the Firepit**: picking a tracked artist auto-suggests *their* assets (SoundCloud avatar, track cover-art, tracks-as-audio) as drop-in elements. No generic media tool has this; it's Sound Cave's data advantage (the discovery layer feeding the studio).

## References
- **Higgsfield "Elements"** (screenshots, Doug 2026-06-25): a "My Elements" library of saved cards (e.g. `@created-person`, tagged *Character*); a **"New Element"** create flow (name + description + **Category: Auto / Character / Location / Prop** + upload media); elements `@`-mentioned inline in the prompt.
- Our existing equivalents: role-tagged **References** (`handleRefImagesChange` → thumbs with WHO/WHERE/WHAT/STYLE chips), **Spirits** (`avatars_api.py`, `reference_image_urls`), **Artist roster** (`avatar_url` + SoundCloud tracks via `clan_tracker.fetch_all_user_tracks`).

## Mood / feel · Hero · Anti-examples · Constraints
- **Mood:** unchanged Sound Cave identity — dark, underground, caveman-vernacular. Higgsfield is the *structure* reference, not the skin.
- **Hero moment:** pick an artist → their avatar + best track art appear as ready-to-drop elements; one cohesive "Elements" panel instead of three scattered inputs.
- **Anti-examples:** the current 3-section clutter; a generic "upload box" with no scene/artist intelligence; light palette.
- **Constraints:** vanilla HTML/CSS/JS off `tokens.css`; reuse `.forge-dropzone` / `.forge-ref-thumbs` / role chips; keep the shipped left→right layout; **caveman naming is Doug's call** (`feedback_soundcave_caveman_language` / `feedback_creative_direction_is_dougs`) — "Elements" is a working label, Doug renames (Totems/Relics/Summons?).

## Design decisions (Doug-approved direction, 2026-06-25)
1. **"Element" = one unified, typed, reusable asset** (Style / Who / Where / What / Spirit). This is what makes them saveable + `@`-mentionable later, reused across gens. *(Data-model unification is phased — Phase 1 groups the existing types visually; the saved-library/`@`-mention comes later.)*
2. **Artist auto-populate = SUGGEST, not force-add** — picking an artist surfaces their assets as tappable suggestions; the user adds what they want. Keeps control.
3. **Tracks:** cover-art → a visual element; the track audio → the **Beat** for Animation. Two distinct uses, clearly separated.
4. **Create Spirits inline** — fold the existing Summon/avatar flow into the Elements "+ Add".

## Phasing
- **Phase 1 — UI merge (this branch, first):** collapse `2·Style` + `3·Subject` → one **`2·Elements`** panel: References drop-block + Spirit picker + Artist picker under one header; renumber Facts→`3`, Direction→`4`. Low-risk frontend regroup; no backend change; all existing IDs/handlers intact (`gatherForgeContext` unchanged).
- **Phase 2 — Cave bridge:** on artist select, fetch + show the artist's `avatar_url` + top track cover-art as suggested elements (tap to add as WHO/STYLE refs). Needs a small endpoint or reuse of existing roster/track data.
- **Phase 3 — Tracks as audio:** surface the artist's SoundCloud tracks; selecting one feeds the **Beat** path for Animation.
- **Later:** saved Elements **library** + `@`-mentions in Direction; "New Element" create modal with categories.

## Build notes
- **Phase 1 (2026-06-25) — UI merge DONE (branch `forge-elements`):** collapsed `2·Style` + `3·Subject` → one **`2·Elements`** panel (References drop-block + Spirit picker + Artist picker under one header). Renumbered Facts→`3`, Direction→`4`. Pure relabel/regroup — no input IDs moved, `gatherForgeContext` untouched, all handlers intact. Verified on localhost (Flyer: 1·Format → 2·Elements → 3·Facts → 4·Direction; Still/Carousel additionally show the Artist picker inside Elements; `forgeFactsLabel` still auto-hides for Still). div 285/285. Shot: `scratch/forge_elements_p1_flyer.png`.
- **Phase 2 (Cave bridge) — DONE (branch `forge-elements`):** selecting an artist surfaces a **"From the Cave — tap to add"** strip of their SoundCloud **avatar + top-track cover-art**; tapping adds it as a reference (avatar→WHO, track art→STYLE).
  - **Backend:** `/api/artist/<username>` now returns `artwork` per top-track; new **`/api/proxy-image`** (auth + **host-whitelisted to `*.sndcdn.com`** for SSRF safety, 5MB cap) downloads a CDN image → data-URL, so Cave assets join the data-URL-only ref pipeline without CORS.
  - **Frontend:** `loadArtistAssets()` (firepit.js) fetches + renders the strip on artist `change`; `addForgeRefFromUrl()` (forge_refs.js) proxies the tapped image → pushes into `_forgeRefImages`. Display uses the CDN URL directly (cross-origin `<img>` is fine); only the *add* proxies. URLs upsized `-large`→`-t500x500`.
  - **Verified end-to-end on localhost:** picked "konzo" → 3 assets loaded (avatar t500x500 + 2 track arts) → tapped avatar → added as a **WHO** data-URL ref (`refs 0→1`, no error). `py_compile`+`node --check` clean, div 285/285. Shot: `scratch/forge_elements_p2_cavebridge.png`.
  - **Scope note:** the bridge is on the single-artist formats (Still/Carousel); Flyer uses a free-text lineup (could extend later).
- **Phase 3 (tracks as audio for the Animation Beat) — NEXT / follow-up.**
