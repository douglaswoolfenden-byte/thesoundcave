# Sound Cave — Spec Overview

> Status: **Approved 2026-04-28** by Doug.

## What it is
The Sound Cave is a **SoundCloud scouting tool** combined with a **bulk AI content creation and multi-platform distribution/scheduling tool** for music industry professionals. Find artists, generate content about them at scale, schedule and publish across platforms.

## Who it's for
- **Artists** — managing their own content output
- **Labels** — producing content across their roster at scale
- **Event promoters** — promoting line-ups and events

→ Detailed personas: `wiki/personas/`

## What it does (current scope)
1. **The Cave** — artist discovery dashboard (genre/date/name/follower filters, PDF export, email)
2. **Foraging** — three modes: Manual Search (live SoundCloud API), Scheduled Search, Running searches
3. **Clan** — saved artist roster with profiles, stats, growth sparklines, star/cut actions, platform links
4. **Firepit** — AI content layer:
   - **Forge** — AI content generator (text + image, toggle)
   - **Stash** — content library
   - **Trail Map** — content calendar (NOT YET BUILT)
5. **Footprints** — analytics & charts on tracked artists (growth over time, sparklines, comparisons)
6. **Home** — philosophy + terminology page

## What it explicitly is NOT
- A music streaming or playback service
- A social network
- A label/management CRM (no deal tracking, no contracts)
- A general-purpose AI tool — music-industry-specific only
- A free product — paid only, no free tier

## Business model
- **Pricing:** Paid only, no free version
- **Distribution:** Hosted web app
- **Architecture target:** Multi-tenant SaaS (currently single-user local; SaaS is the destination)

## Roadmap
- **Phase 2 (next):** Voice profiles — upload past campaigns to train style; Trail Map content calendar
- **Phase 3:** Social media connections (multi-platform distribution + scheduling); image generation _(image gen partially done)_
- **Phase 4 (implied by SaaS goal):** Auth, multi-tenant data isolation, billing

## Architecture (one-liner)
Vanilla HTML/CSS/JS frontend (no build step) → Flask backend (`content_api.py`, port 8000) → Claude Haiku for text + Fal AI FLUX schnell (primary) / Replicate (fallback) for images. SoundCloud API for discovery + tracking.

Detail: `wiki/decisions/0002_architecture.md`
