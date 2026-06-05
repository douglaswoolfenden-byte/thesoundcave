# The Sound Cave

> Scout. Forge. Summon. — a music-industry tool for finding emerging artists and creating content about them at scale.

**The Sound Cave** (wordmark: *S0UNDCAV3*) is a SoundCloud scouting tool fused with a bulk AI content-creation and multi-platform distribution engine, built for music-industry professionals. Find unsigned and emerging artists in European underground dance music, then generate, schedule, and publish content about them across platforms.

It is **not** a streaming service, a social network, or a label CRM. It is music-industry-specific by design.

---

## Who it's for

- **Artists** managing their own content output
- **Labels** producing content across a roster at scale
- **Event promoters** promoting line-ups and events

---

## Features

The app is organised around a caveman-themed set of tools:

| Area | What it does |
|------|--------------|
| **The Cave** | Artist discovery dashboard — filter by genre, date, name, and follower count. |
| **Foraging** | Three search modes: live manual SoundCloud search, scheduled search, and running searches. |
| **Clan / Roster** | Saved artist roster with profiles, stats, growth sparklines, and star/cut actions. |
| **Firepit** | The AI content layer — **Forge** (text + image generator), **Stash** (content library), **Trail Map** (content calendar). |
| **Footprints** | Analytics and charts on tracked artists: growth over time, comparisons, sparklines. |

---

## Architecture

A vanilla HTML/CSS/JS frontend (no build step) talking to a set of Python/Flask APIs, with automated discovery pipelines.

```
SoundCloud API ──► scout.py        ──► data/YYYY-MM-DD.json   (weekly discovery)
                   clan_tracker.py ──► data/snapshots/...     (daily stats)
                   update_manifest.py ─► data/manifest.json   (frontend index)

Claude (Haiku)        ──► content_api.py ──► Firepit · Forge   (text generation)
Fal AI / Replicate    ──► media_gen.py   ──► Firepit · Forge   (image generation)
```

- **Frontend** — `index.html` shell + modular `css/` and `js/` files, each kept under 500 lines. No framework, no bundler.
- **Backend** — Flask APIs (`content_api.py`, `events_api.py`, `campaigns_api.py`, and friends) on port 8000.
- **AI** — Claude Haiku for copy; Fal AI (FLUX schnell, primary) / Replicate (fallback) for images.
- **Discovery** — `scout.py` searches 16 dance genres and scores tracks by engagement-to-follower ratio with recency bonuses.

---

## Quickstart

```bash
# 1. Set up the Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 2. Run everything (API on :8000 + website on :3000)
./run.sh
```

Then open **http://localhost:3000** in your browser. `Ctrl+C` stops both servers.

To run the pipelines manually:

```bash
python scout.py            # weekly artist discovery
python clan_tracker.py     # daily stats snapshot
python update_manifest.py  # rebuild the data index
```

---

## Environment

API keys live in the workspace-root `.env` (never committed). Required and optional vars:

| Variable | Required | Purpose |
|----------|----------|---------|
| `SOUNDCLOUD_CLIENT_ID` | ✅ | SoundCloud discovery + tracking |
| `SOUNDCLOUD_CLIENT_SECRET` | ✅ | SoundCloud auth |
| `ANTHROPIC_API_KEY` | ✅ | Claude text generation |
| `SOUNDCLOUD_OAUTH_TOKEN` | optional | Skips the client-credentials grant if set |
| `CONTENT_API_PORT` | optional | Content API port (defaults to 8000) |
| `FAL_KEY` | optional | Fal AI image generation (primary) |
| `REPLICATE_API_TOKEN` | optional | Replicate image generation (fallback) |

---

## Automation

GitHub Actions keeps the discovery data fresh:

- **Weekly Artist Scout** — Mondays 08:00 UTC: runs `scout.py` + `update_manifest.py`, commits `data/`.
- **Daily Clan Tracker** — daily 08:00 UTC: runs `clan_tracker.py`, commits `data/`.

---

## Status

Active development. The product is pivoting toward a **promoter-first campaign engine** with Firepit as the headline. See `wiki/` for full intent, specs, and decision history — the wiki is the source of truth for *why* and *for whom*; this README and the code answer *what* and *how*.

---

*Built by [Doug Woolfenden](https://github.com/douglaswoolfenden-byte) (@DOUGAL_252).*
