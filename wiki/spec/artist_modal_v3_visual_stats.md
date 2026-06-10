# Artist modal v3 — visual stats, no manual entry (UI spec)

> Status: **SHIPPED 2026-06-10** (Playwright screenshot-confirmed, live API path fired)
> Date: 2026-06-10
> Builds on: [artist_detail_modal.md](artist_detail_modal.md) (shipped 2026-06-09)

## Why (Doug, 2026-06-10, from screenshot review)
1. *"Add the platform links to the top in line with the name. Tidied and centered."*
2. *"I don't want any of the data input to be manual at all. It really can't be manual at all."*
3. *"I want a graphic for each of followers, plays, likes, reposts — line graphs. Numbers can be there but data needs to be visually displayed so we can see it improving, decreasing or stagnating."*
4. *"Suggested tracks — only one there. Should be like top five."*
5. *"Don't like the big yellow gold star on favourite — needs the brand orange."*
6. *"This can be much more presentable and visually pleasing."*

## References / mood
Existing Sound Cave dark palette + `--red` (#ff4500) single accent — non-negotiable (`feedback_soundcave_palette`). Same `.stat-modal`/centered-card grammar already shipped. Feel: a label scout's intel dossier — calm, dense-but-readable, data as texture not spreadsheet.

## Hero moment
The four metric tiles: open any artist and instantly *see* the shape of their trajectory — four small ember-orange line charts breathing on dark, no reading required.

## Changes

### 1. Header reflow (platform links up top)
- `panel-head` becomes a centered stack: avatar → name → genre + SoundCloud link → platform chip row, all centre-aligned.
- Star and ✕ pin to the top-right corner (absolute), out of the flow.
- Platform chips reuse existing `.plat-chip` behaviour unchanged (click dim = inline add, click bright = open, hover = ✎). The old "Platform links" body section is removed.

### 2. Metric graphics (the hero)
- 4-up grid of **metric tiles**: Followers / Plays / Likes / Reposts.
- Each tile: small uppercase label, current value (compact, secondary to the graphic), delta-% tag (green up / red down), and a **sparkline** filling the tile from the backend daily snapshots (`data/snapshots/`, auto-collected daily by `clan_tracker.py` — zero manual input).
- `buildArtistPlaySeries()` gains `reposts` (already in snapshot JSON as `total_reposts`).
- **Click a tile → the full-width chart below switches to that metric** (tile shows active state). "Plays over time" section becomes "<Metric> over time", reusing `buildLineChart`.
- Fewer than 2 snapshot days → tile shows current value + "tracking builds daily" hint; chart keeps existing empty-state.

### 3. Manual data entry — deleted
- Remove the whole `panelManualSection` block, `saveManualData()`, `manualFollowers`/`manualPlaylists` inputs, and `followers_override` from display logic. Stats come only from live API + daily snapshots.

### 4. Suggested tracks — top 5
- `/api/artist/<username>` already fetches **all** the artist's own tracks for totals; it now also returns `top_tracks` (top 5 by plays: title, url, plays, likes, date) in the JSON response (not persisted to Supabase).
- Panel merges scout-discovered `tracks_seen` (score badge kept) with live `top_tracks`, dedupes by URL/title, caps at 5. Tracks render as tidy rows: title, date, plays, ▶.
- Offline/API-down → falls back to `tracks_seen` only (today's behaviour).

### 5. Star → brand orange
- Replace `⭐`/`☆` emoji (emoji can't be CSS-coloured — it's why it renders gold) with an inline SVG star: stroke `--red` when idle, filled `--red` when starred. Same toggle logic.

### Constraints
- Vanilla JS/CSS, tokens only (`var(--red)` etc.), no new deps.
- Desktop-first; tiles 4-up → 2×2 under ~720px.
- Read-only (non-clan) artists: tiles + chart + tracks still show; platforms/notes/actions stay clan-only (unchanged).

## Build notes
- **Header** (`index.html` + `css/style.css`): `panel-head` is a centered column (avatar → name → genre → SoundCloud → platform chips); star + ✕ sit in an absolute `.panel-head-corner`. The old "Platform links" body section is gone; `renderPanel` now toggles `platformGrid` (not the section) for non-clan views.
- **Metric tiles** (`js/app.js`): `PANEL_METRICS` drives 4 `.metric-tile` buttons; series from `buildArtistPlaySeries` (now also maps `total_reposts`). Tile click sets `activeMetric` + re-renders the big chart (`renderPlaysChart` → `renderMetricChart`, title follows). `buildSparkline` gained a `viewBox` so tiles can stretch it. Deltas suppressed on a zero baseline and capped at `+999%+`.
- **Number/chart consistency fix found in verification:** local scout snapshots store *single-track* stats, so tiles preferred them and disagreed with the chart (4.3K vs 6.7M). Tiles now prefer live API → backend series → local snapshot, same source as the charts.
- **Manual entry removed everywhere:** `saveManualData()`, the inputs, and all `followers_override` reads (also in `cave.js`, `clan.js`, `footprints.js`) + `playlist_adds` no longer written into new local snapshots. Legacy DB columns untouched (`roster_account_persistence.md` schema unchanged).
- **Top-5 tracks:** `content_api.py:artist_stats` returns `top_tracks` (top 5 by plays; response-only, never upserted — no schema change). Frontend caches per-artist in localStorage `sc_top_tracks` (the API only sends them on cache miss), merges scout `tracks_seen` (score badge) + live top tracks, dedupes by URL/title, caps 5. New `.track-row` classes replace inline styles.
- **Star:** inline SVG (outline idle → filled `--red` when starred), listener-wired, keyboard accessible. Emoji star removed — it's why it rendered gold.
- Verified via Playwright on a seeded clan artist (`dazegxd`, present in both snapshot days): centered header, 4 sparkline tiles agreeing with the chart, tile-click switch, real top-5 from the live API, read-only view hides platforms/notes/actions, 0 console errors.
