# Sound Cave — Spec Overview

> Status: **Essence updated 2026-06-17** — see [decision 0008 — Campaign Studio leads (tech-house first)](../decisions/0008_campaign_studio_first.md). That is the current north star; read it first.
>
> History: approved 2026-04-28 (discovery + bulk content) → repositioned promoter-first 2026-05-13 ([phase_2_3_pivot](phase_2_3_pivot.md)) → **campaign-studio-first 2026-06-17** (0008). The "What it is / Who it's for / Roadmap" below are updated to 0008. "What it explicitly is NOT", business model, and architecture remain valid throughout.

## What it is
The Sound Cave is a **campaign studio** for underground music people with **no design team** — promoters, small boutique labels, DIY artists. It turns "I have an event / a release / a tour" into authentic, **scene-correct** campaign assets (flyers, posts, carousels) in minutes — orchestrating best-in-class AI generation behind a layer of curated niche taste. **Tech-house is the first scene.**

It also carries a **discovery + tracking** layer (unsigned-artist scouting + stats via the SoundCloud API), kept but **parked** while the studio leads (see [0008](../decisions/0008_campaign_studio_first.md)). Long term the two join up: find an artist → take them into the studio.

## Who it's for
The user with **no marketing team — everything outsourced**:
- **Event promoters** — flyers and campaigns for their nights (primary)
- **Small boutique labels** — release + roster campaigns without a designer
- **DIY artists** — their own tour / release / bio assets

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

## Roadmap (per [0008](../decisions/0008_campaign_studio_first.md) — studio first, tech-house first)
- **Now:** nail the **tech-house Flyer** end-to-end — curated [style gallery](style_gallery.md) over the existing role-tagged STYLE pipeline; eye-test to the "a promoter would post this" bar.
- **Next:** clone the format set (Post, Carousel) for tech-house; then clone the whole pack to a second genre.
- **Parked:** tracking/scouting (kept, untouched); artist profiles + the "learn from users" data flywheel (instrument logging now, build later); multi-platform scheduling (Trail Map); SaaS billing/multi-tenant.

## Architecture (one-liner)
Vanilla HTML/CSS/JS frontend (no build step) → Flask backend (`content_api.py`, port 8000) → Claude Haiku for text + Fal AI FLUX schnell (primary) / Replicate (fallback) for images. SoundCloud API for discovery + tracking.

Detail: `wiki/decisions/0002_architecture.md`
