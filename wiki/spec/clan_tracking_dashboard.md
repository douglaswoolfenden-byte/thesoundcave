# Clan Tracking Dashboard — Spec

> Status: **Phase 1 SHIPPED 2026-05-12.** Phase 2 (drill-downs) still pending. Spec sections below reflect plan; the log entry has the actual delivered detail.

## Why
The Cave dashboard shows `+0 THIS WEEK` for Followers / Likes / Listens because the delta is calculated from `allReports` (the weekly *scout* feed, which only contains an artist when scout surfaces them that week) instead of from `data/snapshots/` (the per-artist daily timeseries that `clan_tracker.py` was built to produce). `data/snapshots/` is also empty — the tracker has never run here. Phase 1 fixes the source. Phase 2 adds drill-downs.

## Out of scope
- **Playlist Adds.** SoundCloud's public API doesn't expose playlist-add counts per artist. Panel stays visible but renders a "coming soon" empty state. Revisit when we have a real source (separate playlist-scrape job, or migrate to Spotify-side tracking later).

---

## Phase 1 — Data + delta (target: non-zero numbers on dashboard)

### 1.1 Seed the snapshot history
- Run `python clan_tracker.py` once locally. Verifies SoundCloud creds, hits live API, writes `data/snapshots/2026-05-12.json` + updates `data/manifest.json`.
- Confirm the daily GitHub Action (`.github/workflows/daily_tracker.yml`) is enabled + has the SoundCloud secrets. From day one + 7 days, every clan artist has a real 7-day delta.
- Do **not** backdate / fake baselines.

### 1.2 Verify the snapshot schema captures what we need
Per `clan_tracker.py:131` the snapshot stores per-artist:
- `followers` — required ✓
- `likes` (favoritings_count) — verify this is captured; add if missing.
- `plays` / `playback_count` — required ✓ (= "Listens")

If `likes` isn't currently stored per artist, edit `clan_tracker.py` to add it before the first run.

### 1.3 Switch dashboard to read snapshots
Rewrite `renderCaveStatPanels(clan)` in `js/cave.js`:
- Load `data/manifest.json` → resolve the **latest** snapshot file + the snapshot **closest to 7 days before that**.
- For each clan artist (`username`):
  - `delta_followers = latest.artists[username].followers − baseline.artists[username].followers`
  - same for `likes`, `plays`.
  - If artist missing in baseline → skip from delta (don't zero). Note count in tooltip text: `+1,240 across 18 of 22 clan artists`.
- Headline value = sum of per-artist deltas. Sign + arrow as today.
- Cache the per-artist delta map on `window._caveStatDeltas` so Phase 2 modals can read it without a recompute.

### 1.4 Empty / partial states
- Zero snapshots: panel renders `Tracking starts when the daily snapshot fires` (no `+0`).
- Exactly one snapshot: panel renders `Baseline set today — deltas appear in 7 days`.
- Two+ snapshots but <7 days apart: use the earliest, label `(over N days)`.

### 1.5 Files touched
- `clan_tracker.py` (verify likes captured)
- `data/snapshots/2026-05-12.json` (NEW — seed)
- `data/manifest.json` (updated by tracker)
- `js/cave.js` — `renderCaveStatPanels`, plus a small helper `loadSnapshotPair()` in `js/app.js`
- `wiki/log.md` + this spec

### 1.6 Phase 1 done = 
- Tracker run + commit, manifest references the snapshot
- Cave dashboard shows real numbers (or one of the explicit empty states) for Followers / Likes / Listens
- Playlist Adds panel shows "coming soon" rather than a misleading total

---

## Phase 2 — Drill-downs (unlocks after Phase 1 ships)

### 2.1 Hover preview
On any stat panel (`#caveFollowersPanel`, `#caveLikesPanel`, `#caveListensPanel`):
- Hover → tooltip listing **top 5 artists by delta** for that metric, descending. Format: `NIGHTKIN  +412`.
- Position: anchored below the panel, dark card matching the cave palette.
- Implementation: reuse `window._caveStatDeltas` cached in Phase 1. Single `.cave-stat-tooltip` element, repositioned on hover.

### 2.2 Click → modal
Click on any stat panel opens a modal:
- Full ranked list of clan artists for that metric.
- Each row: artist name, current value, delta, sparkline placeholder.
- Click row → existing artist detail panel opens.
- Sortable headers (Name / Current / Delta).
- Reusable `.stat-modal` element (dark, centered, click-backdrop-to-close, Esc closes).

### 2.3 Genre mix expansion
- Current: `top 5` (`js/cave.js:226`). Replace `.slice(0, 5)` with the top 5 inline AND a click target on the panel that opens the same `.stat-modal` with the **full** genre breakdown sorted by count.

### 2.4 New drops expansion
- Current: `slice(0, 4)` (`js/cave.js:262`). Same pattern — click panel → modal lists every clan drop this week, not just 4. Each row links to the SoundCloud URL.

### 2.5 Files touched (Phase 2)
- `js/cave.js` — hover handlers + modal opener + genre/drops expansion
- `css/style.css` — `.cave-stat-tooltip` + `.stat-modal` (new component, reusable)
- `index.html` — single `<div id="caveStatModal" class="stat-modal">` placeholder
- `wiki/features/the_cave.md` + `wiki/log.md`

### 2.6 Phase 2 done =
- Hover on each of the 4 panels surfaces the top-5 list
- Click opens the full modal; row click navigates to artist detail
- Genre mix + New drops click open the same modal pattern with full data
- Visually screenshot-confirmed against dark palette

---

## Open questions
None — three calls made on 2026-05-12 (ship without playlist-adds, seed via real tracker run, split phases).

## Related
- `wiki/features/the_cave.md` — dashboard feature page
- `wiki/features/footprints.md` — overlap: footprints already shows per-artist deltas in report form; this is the "at-a-glance" cousin
- `clan_tracker.py` — the data engine this depends on
