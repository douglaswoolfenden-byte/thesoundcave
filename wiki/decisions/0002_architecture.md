# Decision 0002 — Architecture: vanilla frontend, Flask backend, multi-provider AI

**Date:** 2026-04-28 (recorded retroactively)
**Status:** Accepted (current state of the code)

## Context
Sound Cave is heading toward hosted multi-tenant SaaS but is currently a single-user local tool with a static frontend on GitHub Pages and Python scripts.

## Decision
- **Frontend:** Vanilla HTML/CSS/JS, no framework, no build step. Multi-file (`index.html` + per-tab JS). All files under 500 lines.
- **Backend (current):** Flask (`content_api.py`, port 8000) — local dev only.
- **Data scripts:** `scout.py` (weekly), `clan_tracker.py` (daily), `update_manifest.py`. Run via GitHub Actions on schedule. Output JSON committed back to the repo.
- **AI providers:** Claude Haiku (text), Fal AI FLUX schnell (image, primary), Replicate (image, fallback).
- **Storage:** Static JSON files in `data/`; user state in `localStorage`.

## Why
- Vanilla frontend = zero build complexity, fast iteration, easy to host on GitHub Pages
- Flask = lowest-friction Python API for the AI proxy
- Multi-provider images = resilience (Fal goes down, fall back to Replicate) and cost flexibility
- JSON-on-disk = good enough for single-user; defers the database decision

## Consequences / what this blocks
- **SaaS migration (Phase 4) will need:** auth, a real database (Postgres likely), per-tenant data isolation, deploy target for Flask (Vercel/Railway/Fly), secrets per tenant, billing.
- `localStorage` state has to migrate to server-side storage when multi-tenant.
- `data/` committed to git stops scaling once there are multiple tenants — needs S3 or DB.

## Alternatives considered
- React/Next.js frontend — rejected: build step + framework overhead unjustified at this stage.
- Single AI provider — rejected: image gen reliability is too patchy to bet on one.
