# Decision 0001 — Pivot from pure discovery to content creation + distribution

**Date:** ~2026-04 (recorded retroactively from memory)
**Status:** Accepted, in progress

## Context
The Sound Cave originally focused on artist discovery (The Cave, Foraging, Clan). Discovery alone doesn't generate enough user value or differentiation — there are existing tools for this.

## Decision
Add a content production + distribution layer (Firepit) on top of discovery. Users find artists *and* immediately create high-quality, high-volume content about them, then distribute and schedule across platforms.

## Why
- Music industry people (artists, labels, promoters) need to constantly produce content; current tools are slow and generic
- Sound Cave already has the artist context layer (Clan, Foraging) that makes content gen *better* than ChatGPT-from-scratch
- Defensible differentiation: discovery + creation + distribution in one loop, not three disconnected tools

## Consequences
- Roadmap now prioritises content + distribution features over more discovery polish
- Backend complexity grows: Claude Haiku, Fal AI, Replicate, plus future social platform APIs
- Must avoid creep into "general AI tool" — keep music-industry-specific
- Paid-only model raises the bar: every feature must justify the price

## Alternatives considered
None — no other paths were on the table at the time of the pivot. Doug's stance: stay open to pivoting whenever a clearly better path presents itself, rather than pre-listing alternatives for their own sake.
