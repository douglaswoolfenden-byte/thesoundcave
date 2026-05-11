# Sound Cave Wiki — Index

## Spec
- [Overview](spec/overview.md) — what Sound Cave is, who for, what it's NOT. **Approved 2026-04-28.**
- [Splash + Cave Entrance](spec/splash_cave_entrance.md) — KVS×Augen redesign. **Doug-confirmed 2026-05-08.**
- [App-wide redesign v1](spec/redesign_v1.md) — KVS skin extended across the app. **Chrome shipped 2026-05-08, per-tab content awaits Doug's morning walkthrough.**

## Features
- [The Cave](features/the_cave.md) — discovery dashboard. Built; print stylesheet pending.
- [Foraging](features/foraging.md) — manual + scheduled search. Live search exists; OAuth untested.
- [Clan](features/clan.md) — saved artist roster. Built; profile polish pending.
- [Footprints](features/footprints.md) — analytics & charts on tracked artists. Built.
- [Firepit — Forge](features/firepit_forge.md) — AI text + image generator. Code complete, untested.
- [Firepit — Video](features/firepit_video.md) — 3-tier video generation (composite/standard/premium). Tiers 1 + 2 live-verified.
- [Firepit — Stash](features/firepit_stash.md) — content library (localStorage).
- [Firepit — Trail Map](features/firepit_trail_map.md) — content calendar. **Not yet built.**
- [Artist live stats](features/artist_live_stats.md) — fresh follower/play counts on view (10-min TTL). Shipped 2026-05-11.

## Decisions
- [0001 — Pivot to content creation + distribution](decisions/0001_pivot_to_content_creation.md)
- [0002 — Architecture: vanilla frontend, Flask backend, multi-provider AI](decisions/0002_architecture.md)
- [0003 — SaaS architecture (paid-only, three video tiers, Supabase backbone)](decisions/0003_saas_architecture.md)
- [0004 — Parallel execution plan (3 worktree streams)](decisions/0004_parallel_execution.md)
- [0005 — Media generation engine (image_gen → media_gen)](decisions/0005_media_gen.md)

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
