# 0014 — Age 1 milestones reframed to the real build (Etchings retired)

**Date:** 2026-06-27 · **Status:** accepted · **Branch:** `claude/version-tier-roadmap-l3nzhu`
**Refines:** the Age 1 milestone table in [0013 — Versioning by Ages](0013_version_ages.md). The `Age.Milestone.Iteration` scheme in 0013 is unchanged; only Age 1's milestone *content* changes here.

## Context

[0013](0013_version_ages.md) mapped Age 1's milestones onto the old [build_plan](../build_plan.md) ladder — *Baseline → prove the recipe → Etchings gallery → refine loop → scale to 20+*. That ladder didn't match how the studio was actually built, and **Etchings (the curated style gallery) is no longer part of the plan.**

The real build was **breadth-first**: stand up the **Cave** (discovery), then the **Firepit** (creation) and its tools, then fill in the **Forge's output formats**. Doug's framing: *"each page within each segment — Forge, Gatherings, Trail Map — those are the milestones; the formats (Flyer → Animation → Still → Carousel) are the build steps; making everything work is the iteration."*

## Decision

**Age 1 milestones are the real segments + tools of the studio**, in build order:

| Version | Milestone | What's in it | Status |
|---|---|---|---|
| `1.0` | **The Cave** | Mural · Foraging · Clan · Footprints | ✅ built; Foraging search being smoothed |
| `1.1` | **The Firepit** | Forge · Gatherings · Stash · Trail Map · Marks | ✅ built; Trail Map calendar parked |
| `1.2` | **Forge formats** | Flyer ✅ · Animation ✅ · Still ⏳ · Carousel ⏳ | ← current — the only new builds left |

- **Iteration digit (`1.2.x`)** = the **"make it all work"** pass: harden + smooth every page (Foraging search, Mural, fixing what's flaky). **No new features beyond Still + Carousel.**
- **Etchings is retired** — the curated style-gallery concept is dropped from the roadmap. Its [spec](../spec/style_gallery.md) and [glossary](../glossary.md) entry are marked retired; historical log entries stay as-is (we don't rewrite history).
- **Current version: `1.2.2`** — Cave (`1.0`) and Firepit (`1.1`) built; in the Forge-formats milestone (`1.2`) with Flyer + Animation done and a couple of hardening iterations shipped.

## Graduation gate → Age 2 (The Market)

All four Forge formats shipped (Flyer · Animation · Still · Carousel) **+ the whole studio works solidly** (Cave + Firepit hardened) **+ ready to put in front of users.** This replaces the old "Etchings live + post-without-embarrassment" gate.

## Why

- **Honesty.** The version should describe what's actually built. The product grew broad (every tab stood up), so milestones = segments/tools, not a single linear recipe track.
- **Scope is closing, not opening.** The only remaining *new* work is Still + Carousel; everything else is hardening. The reframe makes that explicit so the build converges on the Age-2 gate.
- **Etchings no longer reflects the plan** — keeping it in the roadmap would misrepresent where effort is going.

## Consequences

- [roadmap.md](../roadmap.md) Age 1 section rewritten to this table; `VERSION` → `1.2.2`; site corner stamp shows `V1.2.2`.
- [build_plan.md](../build_plan.md) reframed: its old stage ladder is superseded by this table; the Etchings stage is marked retired. Tactical Forge-recipe notes stay as history.
- [glossary.md](../glossary.md): Etchings marked retired.
- [0013](0013_version_ages.md) gains a forward-link to this decision on its Age 1 milestone mapping.
