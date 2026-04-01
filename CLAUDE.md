# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

The Sound Cave is a music discovery platform that finds unsigned/emerging artists in European underground dance music via the SoundCloud API. It has two automated pipelines and a static frontend dashboard, all hosted on GitHub Pages.

## Architecture

Four Python scripts + one single-file HTML frontend:

- **`scout.py`** — Weekly artist discovery engine. Searches SoundCloud across 16 dance music genres, filters by follower/play thresholds, scores tracks by engagement-to-follower ratio with recency bonuses, deduplicates by artist, and saves a top-20 JSON report to `data/YYYY-MM-DD.json`.
- **`clan_tracker.py`** — Daily stats tracker. Reads all previously discovered artists from weekly reports (and optional `data/clan_artists.json`), fetches their current SoundCloud profiles and recent tracks, saves daily snapshots to `data/snapshots/YYYY-MM-DD.json`, then updates the manifest.
- **`update_manifest.py`** — Rebuilds `data/manifest.json` (index of all weekly reports and daily snapshots). The frontend reads this to know which data files exist.
- **`content_api.py`** — Flask server for AI content generation. Calls Claude API (Haiku) to produce social posts, event copy, press releases, etc. Run locally during dev, deploy to Vercel/Railway for prod.
- **`index.html`** — Single-file static dashboard (HTML/CSS/JS, no build step). Five tabs: The Cave (overview), Foraging (discovery), Clan (tracked artists), Footprints (analytics), Firepit (content production). Hosted via GitHub Pages.

## Data flow

```
SoundCloud API → scout.py → data/YYYY-MM-DD.json (weekly)
                 clan_tracker.py → data/snapshots/YYYY-MM-DD.json (daily)
                 update_manifest.py → data/manifest.json
                 index.html reads manifest.json → renders dashboard
Claude API     → content_api.py → index.html Firepit tab (real-time generation)
```

## Commands

```bash
# Setup
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Run scout (requires SOUNDCLOUD_CLIENT_ID + SOUNDCLOUD_CLIENT_SECRET in .env)
python scout.py

# Run daily tracker
python clan_tracker.py

# Run content generation API (for Firepit tab)
python content_api.py

# Rebuild manifest after manual data changes
python update_manifest.py
```

There are no tests or linting configured.

## Environment

- Python 3.11+ (GitHub Actions uses 3.11)
- Dependencies: `requests`, `python-dotenv`, `flask`, `flask-cors`, `anthropic`
- `.env` file lives one directory up (`../`) from the project root — this is the workspace-level master `.env`
- Required env vars: `SOUNDCLOUD_CLIENT_ID`, `SOUNDCLOUD_CLIENT_SECRET`, `ANTHROPIC_API_KEY`
- Optional: `SOUNDCLOUD_OAUTH_TOKEN` (skips client_credentials grant if set)
- Optional: `CONTENT_API_PORT` (defaults to 8000)

## GitHub Actions

- **Weekly Artist Scout** (`weekly_scout.yml`) — runs Mondays 8am UTC, or manual trigger. Runs `scout.py` then `update_manifest.py`, commits and pushes `data/`.
- **Daily Clan Tracker** (`daily_tracker.yml`) — runs daily 8am UTC, or manual trigger. Runs `clan_tracker.py`, commits and pushes `data/`.

Both workflows use repo secrets for SoundCloud credentials.

## Key design decisions

- The `.env` is loaded from `os.path.join(os.path.dirname(__file__), '..', '.env')` — one level above the project, at the workspace root. All scripts assume this path.
- Scout deduplicates by artist: only the highest-scoring track per artist makes the final report.
- `is_eligible()` does a secondary API call (`fetch_real_followers`) when the embedded follower count looks suspicious (0 or low relative to plays). This avoids false positives from SoundCloud's unreliable embedded user objects.
- `index.html` is entirely self-contained — no framework, no build, no external JS dependencies.
- `data/watchlist.json` has `watching` and `dismissed` arrays (currently empty) — intended for user-curated artist lists in the frontend.
- The Firepit tab has three sub-views: Forge (content generator), Stash (content library stored in localStorage), Trail Map (content calendar — Phase 2).
- `content_api.py` is a Flask server, not a batch script. It must be running for the Firepit's Forge to work. The frontend detects the API URL from localStorage key `sc_api_url` (defaults to `http://localhost:8000`).
- Content is generated via Claude Haiku for speed and cost. System prompt is tuned for underground electronic music culture. Each content type has its own instruction template in `content_api.py`.
