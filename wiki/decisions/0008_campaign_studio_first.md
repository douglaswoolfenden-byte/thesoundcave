# 0008 — Campaign Studio leads (tech-house first)

**Date:** 2026-06-17
**Status:** Accepted
**Reframes the headline of:** [0001 — Pivot to content creation](0001_pivot_to_content_creation.md) and the promoter-first framing in [phase_2_3_pivot](../spec/phase_2_3_pivot.md). Those stay valid as history; this is the current north star.

## The decision
Sound Cave's headline is a **campaign studio** for underground music people with **no design team** — promoters, small boutique labels, DIY artists. It turns "I have an event / a release / a tour" into authentic, scene-correct campaign assets in minutes.

**Focus order:**
1. **Campaign studio leads.** Build the Forge into a studio that produces scene-native media.
2. **One scene first: tech-house.** Nail every format for tech-house before widening to other genres.
3. **Scouting/tracking stays, parked.** The Cave (discovery + tracking) is not removed and not touched for now.

**The long game (not now):** both engines, with a natural round-trip — find an artist in the intelligence tool → take them into the studio → produce their campaign. We build the studio half first; the data half already exists and becomes the on-ramp later.

## Why (the reasoning, June 2026)
- **The moat is encoded niche taste — not pixels, not data.** We don't out-generate Canva/CapCut/Higgsfield (we orchestrate their APIs as plumbing), and we can't out-data Chartmetric/Sony. What no horizontal tool will ever encode is *what an authentic tech-house flyer looks like vs. an indie-rock tour poster*. That curated, per-scene judgment is the defensible, compounding asset.
- **"Ahead of AI" is the losing bet.** A solo builder can't out-research the model labs. Win where AI won't go: a small, unsexy niche with real workflow and a relationship with a specific user doing a specific repeated job.
- **The target user is specific and underserved:** no marketing team, everything outsourced. The value is consolidation + niche-correctness + speed.
- **Breadth was the failure mode.** "Go-to media + campaign + tracking platform for all of music" = four products. Pick one job, one scene, nail it, then clone.

## What this changes
- **Positioning** across the wiki + root CLAUDE.md moves from "discovery platform" to "campaign studio."
- **Tracking/scouting** = parked complement, not co-headline. No build effort for now.
- **Artist profiles / network-effects idea** = parked (Phase 3+). Don't build a second user type before the first loves the tool. *But* instrument generation logging now so the "learn from users" dataset accrues from day one.
- **Genre selection** = visual, not a text dropdown. See [style_gallery spec](../spec/style_gallery.md).

## Build status when this was decided (2026-06-17)
~70% of the studio input architecture already exists on branch `forge-output-ux`: the Context Stack, WHO/WHERE/WHAT/STYLE role-tagged refs, three formats (Post / Carousel / Flyer), Spirits, and video. **None of it is live** — `main` is deployed; the branch was pushed to GitHub on 2026-06-17 for safety. The gap is the **curated style gallery** + the **tech-house pack content**. See [style_gallery](../spec/style_gallery.md).
