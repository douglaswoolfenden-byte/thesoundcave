# Sound Cave Wiki — Index

## Terminology
- [Glossary](glossary.md) — **source of truth** for UI labels ↔ what they mean ↔ internal code names ↔ old aliases. Read this when a term on the website doesn't match the code. Keep current on every rename.

## Stack
- [Stack & Integrations](stack.md) — every tool, API & model the product uses (text-gen, image-gen, video-gen, infra). **Reviewed 2026-06-09.**

## Spec
- [Overview](spec/overview.md) — what Sound Cave is, who for, what it's NOT. **Essence updated 2026-06-17 — campaign studio first (decision 0008).**
- [Splash + Cave Entrance](spec/splash_cave_entrance.md) — KVS×Augen redesign. **Doug-confirmed 2026-05-08.**
- [App-wide redesign v1](spec/redesign_v1.md) — KVS skin extended across the app. **Chrome shipped 2026-05-08, per-tab content awaits Doug's morning walkthrough.**
- [Forge output recipes](spec/forge_output_recipes.md) — per-type media generation spec (Post / Carousel / Event Promo / Event Poster / Artist Bio): format, composition, style, model. **Approved 2026-06-09.**
- [Forge context pipeline](spec/forge_context_pipeline.md) — every generation digests ALL context; WHO/WHERE/WHAT/STYLE role-tagged refs + the Context Stack. **Signed off 2026-06-11.**
- [Style gallery](spec/style_gallery.md) — "pick a look" curated STYLE tiles (visual genre selection) over the role-tagged pipeline. **DRAFT — pending sign-off (2026-06-17).**

## Features
- [The Cave](features/the_cave.md) — the discovery **umbrella** (Mural · Foraging · Clan · Footprints). The **Mural** is its dashboard scene (UI label was "Dashboard"). Built; print stylesheet pending.
- [Foraging](features/foraging.md) — manual + scheduled search. Live search exists; OAuth untested.
- [Clan](features/clan.md) — your saved artist roster (UI label is **CLAN**; briefly "Roster"). Account-backed. Built; profile polish pending.
- [Footprints](features/footprints.md) — analytics & charts on tracked artists. Built.
- [Firepit — Forge](features/firepit_forge.md) — AI text + image generator. Code complete, untested.
- [Firepit — Video](features/firepit_video.md) — 3-tier video generation (composite/standard/premium). Tiers 1 + 2 live-verified.
- [Firepit — Stash](features/firepit_stash.md) — content library (localStorage).
- [Firepit — Trail Map](features/firepit_trail_map.md) — content calendar. **Not yet built.**
- [Firepit — Beat](features/firepit_beat.md) — rights-gated audio on posts (clip picker + copyright gate). **Spec approved 2026-06-09, build not started.**
- [Artist live stats](features/artist_live_stats.md) — fresh follower/play counts on view (10-min TTL). Shipped 2026-05-11.

## Decisions
- [0001 — Pivot to content creation + distribution](decisions/0001_pivot_to_content_creation.md)
- [0002 — Architecture: vanilla frontend, Flask backend, multi-provider AI](decisions/0002_architecture.md)
- [0003 — SaaS architecture (paid-only, three video tiers, Supabase backbone)](decisions/0003_saas_architecture.md)
- [0004 — Parallel execution plan (3 worktree streams)](decisions/0004_parallel_execution.md)
- [0005 — Media generation engine (image_gen → media_gen)](decisions/0005_media_gen.md)
- [0006 — Vercel static-only deploy](decisions/0006_vercel_static_only.md)
- [0007 — Backend live on Railway](decisions/0007_backend_live_on_railway.md)
- [0008 — Campaign Studio leads (tech-house first)](decisions/0008_campaign_studio_first.md) — **current north star (2026-06-17).**

## Personas
- [Artist](personas/artist.md) — stub
- [Label](personas/label.md) — stub
- [Promoter](personas/promoter.md) — stub

## Research
- _none yet — competitor teardowns needed (other artist content tools, label content workflows, scheduling tools like Buffer/Postiz)_

## Raw sources
- _none yet_

## Known gaps (for next session)
- Real persona interviews to replace the stubs
- Decision: image gen provider strategy (why Fal primary, Replicate fallback?) — currently lives in decision 0002 as a sentence; promote if it grows
- Decision: which social platforms first for Trail Map (IG + TikTok likely)
- Decision: SaaS migration plan (auth, DB, deploy target, billing)
- Pricing tier breakdown (what does "paid only" actually cost?)
