# Sound Cave — Phase 2 & 3 Pivot Spec

> **2026-05-28 nav restructure:** the IA in this spec (Events as a top-level tab alongside Firepit) is superseded by [`firepit_headline.md`](firepit_headline.md). Firepit is now the headline product; Events folds in as a Firepit sub-tab renamed "Summons"; Brands folds in too; Cave splits off as a premium tier. Backend / data model in this spec stays valid.
>
> Status: **Proposed 2026-05-13.** Awaiting Doug sign-off before any code lands.
>
> **Source:** `/Users/douglaswoolfenden/Downloads/Soundcave Phase 2.3 Mission.md` (mission brief, the authoritative spec).
> **Execution plan:** `~/.claude/plans/the-sequenced-roadmap-to-floofy-bonbon.md`
>
> This page supersedes the noted sections of `overview.md`. Decisions in `wiki/decisions/` remain valid unless explicitly overridden here.

---

## What's changing (one paragraph)

Sound Cave is pivoting from "AI tools for the music industry" to a focused wedge: **a campaign engine for independent promoters running events on thin budgets.** Tagline: *"Turn one event into a month of content."* The three-pillar structure (Cave / Firepit / Footprints) remains; the user-facing priority changes. **Firepit becomes the headline product** (campaign generation from Events); **a new Profiles layer** is introduced (artist EPKs, claimable, the source of truth for assets pulled into campaigns); **The Cave is demoted** from new-user front door to a paid layer for labels/managers (Phase 7+, not in this scope); Footprints stays in place.

---

## Users (long-run)

1. **Promoters** — primary, paying. Sole focus of Phases 2 + 3.
2. **Artists** — secondary, free, invited by promoters. Phase 4 (claim flow).
3. **Labels / managers** — tertiary, later. Phase 7+.

---

## Sections of `overview.md` superseded by this page

| Overview.md section | Status | New version |
|---|---|---|
| "What it is" | **Superseded** | Campaign engine for promoters; Cave-as-discovery is a later-tier layer. |
| "Who it's for" (list of 3) | **Superseded** | Promoters first; artists second (free); labels third (later). |
| "What it does (current scope)" item #3 "Clan" | **Renamed** | **Roster** — promoter's artist Profiles linked to their events. |
| "What it does (current scope)" item #4 "Firepit" | **Reframed** | Firepit = event-aware campaign generator. Old free-prompt mode survives as "Quick post". |
| "Roadmap" (Phase 2 = voice profiles + Trail Map; Phase 3 = social distribution) | **Superseded** | See `## New roadmap` below. |

Unchanged in overview.md: business model (paid only), architecture one-liner, "what it explicitly is NOT".

---

## New roadmap (6 phases, ~10–12 weeks to closed beta)

1. **Reframe** (week 1) — copy, nav, rename Clan→Roster.
2. **Event as a first-class object** (weeks 2–3) — `events`, `lineup_slots`, `artist_profiles` tables; Create Event flow; lineup matching pipeline.
3. **Campaign generation** (weeks 4–6) — Event → 4-week sequenced post timeline with real Profile assets, voice presets, server-side composed images.
4. **Profile claim flow** (weeks 7–8) — artist magic-link claim of stub Profile (Phase 2 sets the table; Phase 4 lights it up).
5. **Trail Map + publishing** (weeks 9–10) — Ayrshare wired; drag-schedule from generated campaigns.
6. **Beta launch** (weeks 11–12) — 5–10 promoters, real events, founding-member pricing.

This page covers **Phases 2 + 3** in detail. The mission brief at `~/Downloads/Soundcave Phase 2.3 Mission.md` is the authoritative spec for data models, flows, and definitions of done.

---

## Decisions locked (2026-05-13)

| Decision | Choice | Reason |
|---|---|---|
| Auth timing | **Build Supabase magic-link login at the start of Phase 2** | RLS real from day one; no `owner_id` hardcoding to retrofit. |
| Async job runner (Phase 3 generation) | **Python background thread + Supabase row updates polled by frontend** | Zero new infra. Revisit if Phase 5 publishing needs durability. |
| Image composition stack | **Python + Pillow (server-side)** | Brief default. Konva-headless / satori reserved as fallback if text rendering looks cheap. |
| Pricing for beta | **Single Promoter tier (~£39/mo) + one-off campaign pack** | Solo/Label/Agency tiers deferred until we know who's paying. |
| Video generation | **Deferred post-beta** | Spotlight posts ship as "reel-ready" vertical stills with attached track. |

---

## What stays untouched (Phase 2/3 non-goals)

- `scout.py` weekly sweep — keeps running; one-off backfill into `artist_profiles` later.
- `clan_tracker.py` daily snapshots — keeps running on JSON; Supabase migration is a Phase 5 concern.
- `update_manifest.py` — runs until verified the frontend no longer needs it.
- Foraging, Footprints, current Forge "Quick post" — no behaviour change.
- The Cave — visual demotion only (nav reorder); the feature still works.

---

## Definition of done (end of Phase 3)

A promoter friend uploads a flyer. Within 3 minutes the Event exists with the correct lineup linked. They click "Generate campaign". Within 90 seconds, a 4-week timeline of posts appears — announcement, spotlights for each artist with real photos, countdown posts, a recap template. They click through, swap one image, edit one caption, and say: *"I would have spent four hours making this. Send me the invoice."*

That's the bar.

---

## Sign-off

- [ ] Doug — Phase 2/3 pivot approved
- [ ] Doug — decisions table locked
- [ ] Doug — new roadmap accepted as plan-of-record

Once all three are ticked, this page becomes the live spec and Day 2 of the execution plan begins.
