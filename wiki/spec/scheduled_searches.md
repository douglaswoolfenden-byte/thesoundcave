# Real weekly scheduled searches (spec)

> Status: **SHIPPED 2026-06-09** (live-fire verified). Phase 4 of the Cave overhaul (plan: `~/.claude/plans/okay-i-want-okay-bright-cook.md`).
> Date: 2026-06-09
> **Decision:** management is **API-backed** — manage in the Scheduled tab locally → content_api writes `data/scheduled_searches.json` → commit → weekly Action runs it; prod tab is read-only.

## Why
Doug: *"I want to understand if the scheduled searches are running. There aren't any set up, but every sign-in there's a search. I want it to run cleanly — set up searches to run weekly, manual searches populating, and it needs to be obvious which scheduled search a result is in based on the filters + a search name. I go through them, reject the ones I don't like, add the ones I do."*

Today scheduled searches are **fake**: stored in `localStorage` only (`sc_scheduled_searches`), nothing executes them, and the Running tab falsely claims *"These searches run automatically via GitHub Actions"* (`js/foraging.js:106`). `scout.py` runs a fixed genre list weekly and ignores them.

## What "real" means (Doug's signed-off direction)
A saved search persists to a **committed JSON**, a **GitHub Action runs it weekly**, results are **tagged with the search name + filters**, and Foraging shows them **grouped by search** for triage (keep → Clan / reject → dismiss).

## Architecture

```
Scheduled tab (UI) ──POST──> content_api /api/scheduled-searches ──writes──> data/scheduled_searches.json (committed)
                                                                                      │
GitHub Action (weekly) ── runs ──> scheduled_scout.py ──reads searches, runs each──┐  │
                                                                                   ▼  ▼
                                    data/searches/<id>.json  (tagged results)  +  updates last_run
                                                                                   │
Foraging "Running" tab <── fetch ── data/searches/* (grouped by search, each artist tagged)
```

### 1. Store — `data/scheduled_searches.json` (committed, source of truth)
Schema per search (extends today's localStorage shape + a `keyword`):
`{ id, name, genre, keyword, min_followers, max_followers, frequency, limit, active, created, last_run }`.
This committed file is what CI runs. Seeded `[]`.

### 2. Manage — `content_api.py` endpoints + existing Scheduled tab UI
- `GET /api/scheduled-searches` → returns the JSON file.
- `POST /api/scheduled-searches` → writes it (create/update/delete/toggle all go through a full-list save).
- Frontend `getScheduledSearches`/`saveScheduledSearches` (`js/foraging.js`) **prefer the API when content_api is reachable**, falling back to localStorage offline. So Doug manages searches in a local dev session (`./run.sh`), the committed JSON updates, he commits it (or the Action commits), and CI runs them. In pure-prod (GitHub Pages, no API) the tab is read-only over the committed list.
- Add a **keyword** field to the create form (`index.html` Scheduled tab).

### 3. Run — `scheduled_scout.py` (new, standalone)
Reuses `scout.py`'s proven logic (genre fetch, `score_track`, follower re-fetch, `build_track_record`) but **per saved search** instead of the fixed genre list:
- For each `active` search: fetch tracks for its `genre` (or keyword search via `/tracks?q=`), apply the search's own `min_followers`/`max_followers` + recency, score, dedupe by artist, take top `limit`.
- Write `data/searches/<id>.json` = `{ search_id, search_name, filters, date, tracks:[ {…record, search_id, search_name} ] }`. Each result carries its search tag.
- Update `last_run` in `scheduled_searches.json`.
- Standalone (own OAuth) to avoid `scout.py`'s import-time side effects; small shared logic duplicated per the codebase's existing SC-helper pattern.

### 4. Automate — `.github/workflows/scheduled_searches.yml`
Weekly (Mondays, after the genre scout), or manual dispatch. Runs `scheduled_scout.py`, commits `data/searches/*` + `scheduled_searches.json`. Uses the existing SoundCloud repo secrets.

### 5. Show — Foraging "Running" tab = results grouped by search
- Fetch the result files (via a small `data/searches/index.json` the runner writes, or add a `searches` array to `manifest.json`).
- Render **one group per search**: header = search name + filter summary + last-run date; body = its result cards (`buildForageCard`), each already filtered against Clan/dismissed/watching.
- Triage reuses `forageAction` (Clan / Watch / Cut). Rejecting dismisses; keeping adds to Clan.
- **Remove the false "runs automatically via GitHub Actions" copy**; replace with honest status (last run, next run, active/paused).

### 6. Manual search — tag by filters
Minor: stamp `liveSearchResults` with the active filter summary so a manual result block shows *which* filters produced it (Doug: "obvious which search… based off the filters + a search name").

## Constraints
- Dark palette; reuse `buildForageCard` + existing `.schedule-item` styles.
- Bounded API usage in CI (cap searches × limit; reuse the pagination caps from P3).
- Don't disturb the weekly genre scout (`scout.py` / `weekly_scout.yml`) — this is additive.
- Static-prod safe: no API in prod → read-only display, no errors.

## Verification
- Create a search in the Scheduled tab (content_api running) → confirm it lands in `data/scheduled_searches.json`.
- Run `scheduled_scout.py` locally (live SoundCloud) → confirm `data/searches/<id>.json` with tagged results + `last_run` updated.
- Foraging "Running" shows results grouped by search; Clan/Cut triage works; no false claim.
- Trigger the GitHub Action (manual dispatch) → confirm it commits results.

## Open decision (sign-off)
**Search management model** — see question to Doug. Recommended: API-backed (manage locally via content_api → committed JSON → CI runs it; prod read-only).

## Files
- new: `data/scheduled_searches.json`, `scheduled_scout.py`, `.github/workflows/scheduled_searches.yml`, `data/searches/` (output).
- edit: `content_api.py` (CRUD endpoints), `js/foraging.js` (API-backed store, grouped results render, remove false claim, manual tagging), `index.html` (keyword field; Running tab container).
- wiki: `features/foraging.md`, `log.md`.

## Build notes (SHIPPED 2026-06-09)
- **Store + API:** `data/scheduled_searches.json` (seeded with one example, "Underground Tech House"). `content_api.py` adds `GET/POST /api/scheduled-searches` (path-safe file read/write; POST validates it's a JSON array, 400 otherwise).
- **Runner:** `scheduled_scout.py` (standalone) reads the JSON, runs each active search (genre and/or keyword query, the search's own follower range, recency≤365d, score, dedupe by artist, top `limit`), writes `data/searches/<id>.json` (each track tagged `search_id`/`search_name`) + `data/searches/index.json`, and persists `last_run`.
- **Action:** `.github/workflows/scheduled_searches.yml` — Mondays 08:30 UTC + manual dispatch; runs the runner, commits `data/searches` + `scheduled_searches.json`. Reuses the SoundCloud repo secrets (mirrors `weekly_scout.yml`).
- **Frontend:** `js/foraging.js` — `getScheduledSearches`/`loadScheduledSearches`/`saveScheduledSearches` are API-backed (POST whole list) with a localStorage fallback + in-memory cache so renders stay sync. Running tab (`renderRunningSearches`) fetches each `data/searches/<id>.json` and renders **results grouped per search** (name + filter summary + last-run), filtered against Clan/dismissed/watching, triaged via `forageAction`. Added a `keyword` field; manual search results now show a filter summary (`manualFiltersText`). **Removed** the false "runs automatically via GitHub Actions" copy.
- **Live verification:** seeded "Underground Tech House" → ran `scheduled_scout.py` → 12 results (all ≤5000 followers), tagged + `last_run` set; GET/POST round-trip + 400-on-bad-input confirmed via `content_api`; Running tab screenshot-confirmed (grouped, 12 cards, honest copy).
- The seeded example search + its results are committed as a working starting point — Doug can edit/delete in the Scheduled tab.
