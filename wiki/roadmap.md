# Roadmap — the Ages (macro map)

> The **era-level** view. [build_plan](build_plan.md) is the stage-level detail *inside* the current Age; [gtm.md](gtm.md) details the next one. Rule + rationale: [decision 0013](decisions/0013_version_ages.md). Version scheme: `Age.Milestone.Iteration` → git tag `vA.M.I`.

## 📍 WHERE WE ARE
**`v1.0.0` · First Age (The Studio) · Milestone `1.1` next.** The campaign studio is live in private beta (Railway + Vercel); the P0 baseline fired and passed ([build_plan](build_plan.md), [log 2026-06-22](log.md)). Current job: **prove the recipe across 3 tech-house looks** (`1.1`). The current number lives in the root [`VERSION`](../VERSION) file.

## How to read a version
`Age.Milestone.Iteration` — e.g. `1.2.3` = First Age, Milestone 2 (Etchings), Iteration 3.
- **Age** bumps only at a **graduation gate** (rare).
- **Milestone** bumps as roadmap milestones start / complete.
- **Iteration** bumps on each shipped release.

Walk it: today `1.0.0` → prove the recipe ships `1.1.0` → a tweak to it `1.1.1` → Etchings gallery `1.2.0` → studio gate cleared, Market era opens `2.0.0`.

## First Age — The Studio (now)
Nail the multi-format tech-house campaign studio. Milestones = [build_plan](build_plan.md) Stages 0–4.

| Version | Milestone | build_plan stage | Status |
|---|---|---|---|
| `1.0` | Baseline (P0) | Stage 0 | ✅ done — `v1.0.0` |
| `1.1` | Prove the recipe (3 looks) | Stage 1 | ← now |
| `1.2` | Etchings gallery | Stage 2 | |
| `1.3` | Refine loop | Stage 3 | |
| `1.4` | Scale to 20+ Etchings | Stage 4 | |

> **🚪 Gate → Second Age:** multiple formats proven · Etchings gallery live · refine loop working · design partners posting *real* assets "without embarrassment." When the studio is good enough to sell, the Market era opens.

## Second Age — The Market
Go-to-market + monetize; first 100 → first 1000 users. Detail: [gtm.md](gtm.md).

| Version | Milestone | Status |
|---|---|---|
| `2.0` | Design partners (invite-gated beta) | in motion now |
| `2.1` | First 100 (hand-to-hand, billing live) | |
| `2.2` | First 1000 (repeatable channels + referral loop) | |

> **🚪 Gate → Third Age:** ~1000 active users · proven retention · proven free→paid conversion.

## Third Age — The Platform
Multi-genre scale, un-park discovery, the discovery→studio round-trip, and the "learn from users" data flywheel — all currently *parked* per [decision 0008](decisions/0008_campaign_studio_first.md). Milestones get defined once the Second-Age gate is in sight.

## Tagging convention
- Bump root [`VERSION`](../VERSION) + add an annotated tag **in the same change**: `git tag -a v1.1.0 -m "Prove the recipe — see wiki/log.md 2026-..."`.
- Tag message points at the [log](log.md) entry (the changelog). Push tags: `git push origin v1.1.0`.
- `v1.0.0` = current beta baseline (`main` @ `ea343bc`).
