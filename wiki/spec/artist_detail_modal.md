# Artist Detail — centered modal + compact platform links (UI spec)

> Status: **SHIPPED 2026-06-09** (live-fire screenshot-confirmed). Phase 2 of the Cave overhaul (plan: `~/.claude/plans/okay-i-want-okay-bright-cook.md`).
> Date: 2026-06-09

## Why
Doug: *"I don't like how the artist's bio is just a narrow column on the right. I want a window that pops up in the middle, sits on top of the back screen, wider than it is narrow. And the platform links take too much space — they should be much smaller, go left-to-right not top-to-bottom. Drop 'add link'; just click Spotify → option to add the link → in future it redirects straight away."*

Today the artist detail (`#artistPanel`) is a 500px **right-slide sidebar** (`css/style.css`), and platform links are a vertical list of `.plat-row`s each with a "+ ADD LINK" CTA and an edit panel (`js/app.js`).

## References / mood
- Same dark Sound Cave palette + mono type (standing rule `feedback_soundcave_palette`). **Reuse the `.stat-modal` language just shipped in P1d** (centered card, dim backdrop, Esc/click-to-close) so the app has one modal grammar, not two.
- Anti: no light theme, no Spotify-grid density, no full-screen takeover.

## Hero moment
The artist card **lands in the centre** of the screen as a wide, calm panel — feels like pulling a record off the shelf to inspect it, not a cramped inspector docked to the edge.

## 2a — Right-slide panel → centered modal
- `.artist-panel` becomes a centered modal: backdrop (`#panelOverlay`, already exists) dims + blurs the app; the panel is `transform: translate(-50%,-50%)` centered.
- **Wider than tall:** width ~`760px` (max ~92vw), `max-height: 86vh` with internal scroll. Landscape feel.
- Open/close animation: fade backdrop + scale-in the card (replaces the current slide-from-right). `openPanel()` / `closePanel()` JS logic is **unchanged** — only the CSS classes that position it change, so every caller (Mural stack, Foraging cards, Clan, Footprints) gets it for free.
- Close affordances: ✕ button (exists), click backdrop (exists), **Esc** (add).
- Header (avatar, name, genre, SoundCloud link, star, close) stays; body sections reflow to the wider column — the stats row and chart get more breathing room.

## 2b — Compact platform links (left → right)
Replace the vertical `.plat-row` list with a **single horizontal row of compact platform marks** (`PLATFORMS` / `PLAT_ICONS` / `PLAT_LABELS` reused; `savePlatform()` reused). Two states per mark:

- **Linked** → full-colour/active mark. **Click opens the URL** in a new tab (the "future redirect" Doug wants). A small `✎` appears on hover to edit.
- **Unlinked** → dimmed mark. **Click reveals a small inline input** right there to paste the URL; on blur/Enter it saves via `savePlatform` and the mark flips to linked. No "+ ADD LINK" text, no always-open edit panel.
- Marks wrap to a second line if needed; label shows under/after the icon small, or on hover (see decision Q below).

## Constraints
- Desktop-first; collapse gracefully under ~720px (modal goes near-full-width, links wrap).
- Vanilla HTML/CSS/JS. Reuse `.stat-modal`-style tokens; no new deps.
- Read-only (non-clan) artists from P1a: platform section stays hidden for them (unchanged) — links are a clan-member feature.

## Build notes
- **Modal:** `.artist-panel` is now `position:fixed` centred (`translate(-50%,-50%)`), `width:760px / max 92vw`, `max-height:86vh` with internal scroll, fade+scale-in. `#panelOverlay` gained a blur. `openPanel`/`closePanel` JS unchanged; Esc-to-close added in `js/app.js` (one document listener). Every caller (Mural / Foraging / Clan / Footprints) inherited the new geometry.
- **Platform marks:** `renderPanel()` now emits a `.platform-row` of 40×40 `.plat-chip` icon buttons + a shared `#platEdit` inline input below. Handlers wired via `addEventListener` (no inline JS with user data — same hardening as the P1d fix). `platformPrimary()` opens a linked mark's URL (prefixes `https://`) or opens the inline editor for an unlinked one; `openPlatformEdit()` shows one input, commits via existing `savePlatform()` on Enter/blur (guarded against double-commit) then `renderPanel()`. Old `togglePlatformEdit`/`refreshPlatformRow` + `.plat-row*` markup removed.
- Verified: centred 760px modal; 7 chips L→R (linked = orange/active, unlinked = dim); click dim → inline add → flips linked; click linked → opens `https://…`; hover linked → ✎ pencil → prefilled edit.

## Decisions (signed off 2026-06-09)
1. **Platform marks = icon-only**, name shown via `title` tooltip on hover. Linked = bright/active, unlinked = dimmed. Click dim → inline URL box; click bright → opens link.
2. **Edit a linked platform = hover pencil `✎`** (small badge on the chip; click it to edit inline). Plain click still opens the link.

## Files
- `css/style.css` — `.artist-panel` → centered modal; new `.platform-row` (horizontal marks + inline-edit state).
- `js/app.js` — `renderPanel()` platform block (the `platformRows` map); Esc-to-close.
- `index.html` — minor: panel header/markup only if structure must shift.
- `wiki/features/the_cave.md` / `clan.md`, glossary if any label changes; `wiki/log.md`.
