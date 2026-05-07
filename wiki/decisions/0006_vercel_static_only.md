# 0006 — Vercel hosts frontend only (static), backend stays on Railway

**Date:** 2026-05-07
**Status:** Accepted

## Context

When attempting first Vercel deploy of the Sound Cave repo, Vercel auto-detected `requirements.txt` (Flask in deps) and demanded a Flask entrypoint named `app.py` / `index.py` / `server.py`. Our Flask app is `content_api.py`, so the build errored.

Per `0002_architecture.md` and `0003_saas_architecture.md`: Vercel is for the static frontend, Railway is for the Flask backend. The auto-detection was trying to do something we never wanted.

## Decision

**Vercel hosts the static frontend only.** Framework auto-detection is explicitly disabled via `vercel.json`:

```json
{ "framework": null, "buildCommand": null, "outputDirectory": ".", "installCommand": null }
```

`.vercelignore` keeps Python files out of the deployment bundle (`*.py`, `requirements.txt`, `venv/`, `__pycache__/`, `data/snapshots/`, `scripts/`, `tests/`).

## Why this approach (not alternatives)

- **Rename `content_api.py` → `app.py`** — would let Vercel build it as Flask, but contradicts decisions 0002/0003 (backend belongs on Railway, where long-running jobs and APScheduler work). Don't bend architecture for a deploy quirk.
- **Move backend to `api/` subdir** (Vercel serverless convention) — viable for v2, but means refactoring the Flask app into per-route handlers and giving up APScheduler. Not today.
- **`framework: null` + `.vercelignore`** ✅ — single-commit fix, zero refactor, leaves backend deploy path open for Railway.

## Consequences

- Future Sound Cave Vercel deploys will not run any Python build steps. Faster builds (~5s vs Flask cold starts).
- Forge / scheduling / media-gen features remain non-functional in prod until backend is deployed to Railway. Frontend code already reads `sc_api_url` from localStorage with a `localhost:8000` default — needs to be repointed at the Railway URL when that's live.
- If we ever want serverless functions on Vercel for lightweight read-only endpoints, we'd need to revisit (`framework: null` opts out of the `api/` directory convention).

## Verified

- Deploy `ac967c0` → `thesoundcave-9k9k086px-douglaswoolfenden-bytes-projects.vercel.app` → status `READY`.
- Build duration ~2s (file upload only), no Flask error.
