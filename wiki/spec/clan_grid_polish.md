# Clan grid polish + star persistence fix (UI spec)

> Status: **SHIPPED 2026-06-18** (Playwright-verified incl. the star-vanish reproduction; 0 console errors). Doug-directed brief.
> Touches the Clan grid (`js/clan.js`) + the shared artist modal (`js/app.js renderPanel`) + the platform-icon component (both surfaces).

## Why (Doug, 2026-06-18 screenshots)
1. Platform icons should be a **grid**, with **SoundCloud always highlighted orange** (it's always present — the source); other platforms highlight orange when a link is populated.
2. Clan cards only show **5 of the platforms** (`PLATFORMS.slice(0,5)`) — show them all.
3. Remove the **"Tracked Xd"** line from clan cards.
4. **Star bug:** starring an artist doesn't persist its orange state, and **starred artists vanish on refresh**.
5. **Starred artists sort to the top** of the Clan grid.
6. The **sort buttons** (Name/Followers/Plays/Likes/Genre) and the **top-right trend label** need to be **UPPERCASE**.

## Root cause — star vanish (debug-one-hypothesis)
`toggleStar`/`togglePanelStar` write `starred` only to local `sc_favs`. On refresh, `roster_sync.loadRoster()` **overwrites `sc_favs` with the server roster** (line 47), and the backend roster (`_ARTIST_FIELDS`, roster_api.py) **doesn't persist `starred`** — so the star is wiped, and any artist not yet synced to the account vanishes entirely.

**Fix (migration-free, backend-free):** stars live in a **separate `sc_starred` localStorage key** (array of usernames), which `loadRoster` never overwrites. Starring also `pushArtist`s the artist so it's in the account roster and survives the overwrite. One-time seed of `sc_starred` from any legacy in-fav `starred` flags so current stars aren't lost. Trade-off: stars are **device-local** (not cross-device) until a backend column is added later — acceptable for now, and far safer than a `roster` table migration Doug must remember to apply.

## Scope
- **Platform grid (both surfaces):** SoundCloud first cell, **always orange** (links `artist_url`); then all 7 `PLATFORMS`, orange when linked, dim when not. Clan card = read-only grid (`repeat(4,1fr)`, all 8). Modal = interactive grid; SC chip opens `artist_url` (not editable), the 7 keep add/open/edit. SC shows even on read-only views (it's the universal identity link); the editable platforms stay clan-only.
- **Clan cards:** drop `.slice(0,5)`; remove "Tracked Xd" line.
- **Star:** `getStarred/saveStarred/isStarred` helpers; `toggleStar`/`togglePanelStar` use them + `pushArtist`; `renderClan`/`renderPanel` read `isStarred`.
- **Sort:** `getClanFiltered` — primary key `isStarred` desc, then the chosen `clanSortBy`.
- **Uppercase:** `.clan-sort-btn { text-transform:uppercase }` + `.clan-card-trend` uppercase (covers "Stable" → "STABLE").

## Constraints
Dark palette + mono only. Vanilla, no deps. Reuse `PLATFORMS`/`PLAT_ICONS`/`PLAT_LABELS` + the `scIcon('soundcloud')` mark added in v4. Keep the read-only gating for editable platform actions.

## Files
- `js/app.js` — star helpers; `togglePanelStar`; `renderPanel` (star read + platform grid w/ SC, read-only SC-only).
- `js/clan.js` — `getClanFiltered` (starred-top); `renderClan` (star, platform grid, drop tracked); `toggleStar`.
- `css/style.css` — `.plat-icon`/`.plat-chip` grid + `.soundcloud` always-orange; `.clan-sort-btn` + `.clan-card-trend` uppercase.
- `index.html` — remove separate `#panelSCLink` (SC moves into the grid).
- `wiki/log.md`, glossary if needed.

## Build notes
- **Star persistence (the headline fix):** new `getStarred/saveStarred/isStarred/toggleStarred` (app.js) over a `sc_starred` key. `toggleStar` (clan) + `togglePanelStar` (modal) call `toggleStarred` (which also `pushArtist`s so the artist survives loadRoster). `renderClan`/`renderPanel`/`getClanFiltered` read `isStarred()`. One-time seed of `sc_starred` from legacy in-fav flags. **Verified by reproducing the bug:** overwrote `sc_favs` with a starred-less "server" copy (exactly what loadRoster does) → BELFORT stayed starred + on top.
- **Starred-to-top:** `getClanFiltered` sort gets a primary `isStarred` desc key before `clanSortBy`.
- **Platform grid:** clan card `.plat-icon-row`→`.plat-icon-grid` (`repeat(4,1fr)`), SoundCloud first cell (always orange via `.plat-icon.linked.soundcloud`), then **all** `PLATFORMS` (dropped `.slice(0,5)`). Linked recoloured **green→orange** (`--red`). Modal `.platform-row`→grid; SC chip (`<a class="plat-chip linked soundcloud">` → `artist_url`, always orange) prepended; editable platform chips render **clan-only**; the separate `#panelSCLink` logo removed (SC now lives in the grid, visible on read-only views too). `scIcon('soundcloud')` icon reused.
- **Removed** the "Tracked Xd" line from clan cards. **Uppercased** `.clan-sort-btn` + `.clan-card-trend` via `text-transform` (covers "Stable"→"STABLE"). Clan star glyph `⭐`(emoji, gold)→`★`(text, CSS-orange).
- **Verified** (8 seeded clan): star→top + orange + survives the loadRoster overwrite, 8 platform icons/card, SC always orange + linked-orange, no Tracked label, uppercase buttons/trend, modal SC-first grid (8 chips) with no separate logo, 0 console errors. Screenshots `scratch/clan_grid_v2.png`, `scratch/modal_header_grid.png`.
- **Note — stars are device-local** (sc_starred not synced to account). Cross-device star sync would need a `roster.starred` column + backend round-trip (deferred; avoids a migration Doug must remember to apply).
