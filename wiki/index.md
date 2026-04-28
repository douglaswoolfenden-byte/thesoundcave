# Sound Cave Wiki — Index

## Spec
- [Overview](spec/overview.md) — what Sound Cave is, who for, what it's NOT. **Approved 2026-04-28.**

## Features
- [The Cave](features/the_cave.md) — discovery dashboard. Built; print stylesheet pending.
- [Foraging](features/foraging.md) — manual + scheduled search. Live search exists; OAuth untested.
- [Clan](features/clan.md) — saved artist roster. Built; profile polish pending.
- [Footprints](features/footprints.md) — analytics & charts on tracked artists. Built.
- [Firepit — Forge](features/firepit_forge.md) — AI text + image generator. Code complete, untested.
- [Firepit — Stash](features/firepit_stash.md) — content library (localStorage).
- [Firepit — Trail Map](features/firepit_trail_map.md) — content calendar. **Not yet built.**

## Decisions
- [0001 — Pivot to content creation + distribution](decisions/0001_pivot_to_content_creation.md)
- [0002 — Architecture: vanilla frontend, Flask backend, multi-provider AI](decisions/0002_architecture.md)

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
