# 0013 — Versioning by Ages (Age.Milestone.Iteration)

**Date:** 2026-06-27 · **Status:** accepted · **Branch:** `claude/version-tier-roadmap-l3nzhu`

## Context

~230 commits in, there's no written way to say *where the product is* or *when the next big step begins*. "We're in version one" is felt, not recorded. Doug wants development framed as **iterations inside larger eras**, so any commit/release maps to a place on the roadmap — and, critically, so the boundary between one era and the next is explicit (a **graduation gate**), not a vibe.

Two naming collisions had to be avoided: **Tier** already means subscription plan (`tier_solo_monthly`, decision [0003](0003_saas_architecture.md)) *and* video quality tier ([firepit_video](../features/firepit_video.md)). The era concept needed its own word.

## Decision

**Version = `Age.Milestone.Iteration`** (e.g. `1.2.3`), git-tagged `vMAJOR.MINOR.PATCH` (`v1.2.3`).

- **Age** (1st) — the strategic era. Bumps only when a **graduation gate** is cleared (rare).
- **Milestone** (2nd) — a roadmap milestone within the Age. Bumps when one is started/completed.
- **Iteration** (3rd) — a shipped iteration within a milestone. Bumps on each meaningful release.

**Eras are "Ages"** — caveman-vernacular, like Cave / Firepit / Forge / Etchings (see [glossary](../glossary.md)). `Tier` stays reserved for subscription/video. The current era is the **First Age**.

**Three Ages — Studio → Market → Platform:**

| Age | Name | Job | Graduation gate (→ next Age) |
|---|---|---|---|
| **1** | The Studio | multi-format tech-house campaign studio | formats proven · Etchings live · refine loop · partners post real assets "without embarrassment" |
| **2** | The Market | go-to-market + monetize, first 100→1000 users | ~1000 active · proven retention · proven free→paid conversion |
| **3** | The Platform | multi-genre, un-park discovery, discovery→studio round-trip, data flywheel | — (open horizon) |

Second Age milestones are detailed in [gtm.md](../gtm.md). The macro map lives in [roadmap.md](../roadmap.md); **this decision is the rule, the roadmap is the live position.**

> **Superseded (2026-06-27):** the Age 1 milestone content below (and the `Stage N = Milestone 1.N` / Etchings mapping) was reframed to the real build — Cave (`1.0`) · Firepit (`1.1`) · Forge formats (`1.2`). See [decision 0014](0014_age1_milestones_reframed.md). The `Age.Milestone.Iteration` scheme itself is unchanged.

**Anchors:**
- The root [`VERSION`](../../VERSION) file holds the current number — the single machine-readable source of truth.
- Tag every shipped version: `git tag -a v1.1.0 -m "<milestone> — see wiki/log.md <date>"`; the message points at the `log.md` entry, which stays the changelog (no separate CHANGELOG).
- `v1.0.0` is tagged retroactively on the current beta baseline (`main` @ `ea343bc`) — the campaign studio as it stands in private beta.

## Why

- **Names the boundary, not just the position.** "Where are we" was answerable (build_plan); "when does the next era start" was not. Graduation gates make it a checklist, not a feeling.
- **Iterations within eras** is exactly Doug's mental model — 3rd digit = iteration, 2nd = milestone, 1st = era.
- **No collision.** "Age" sidesteps both `tier_*` and the video tiers, and fits the brand voice.
- **Reuses what exists.** build_plan stages *become* First-Age milestones; nothing is re-planned, just framed.

## Consequences

- A root `VERSION` file + git tags now exist; future releases bump `VERSION` and add a tag in the same change.
- [roadmap.md](../roadmap.md) becomes the era-level map sitting above [build_plan.md](../build_plan.md) (stage-level) and [gtm.md](../gtm.md) (Second-Age detail).
- The Second Age is spec'd ahead of time ([gtm.md](../gtm.md)) so the studio→market hand-off isn't improvised.
- Glossary gains Age / Milestone / Iteration and an explicit "Tier ≠ Age" note.

## Alternatives considered

- **Keep "Tier"** (Doug's word) + rename subscription tiers to "Plans" — matches his phrasing but keeps a soft collision with `tier_*` code keys. Rejected.
- **Plain semver** (`1.x.x`, major = era) — familiar, but minor/patch carry no roadmap meaning. Rejected; the point is that *each digit* maps to the roadmap.
- **Named milestones only** (no numbers) — human-friendly but unsortable/untaggable. Rejected.
- **Stratum / Layer** for eras — on-brand but less intuitive than "Age". Rejected.
