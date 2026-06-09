# Spec — Firepit-as-Headline Restructure

> Status: **Approved — 2026-05-28** by Doug. Build kicks off this session.
> Related: [`phase_2_3_pivot.md`](phase_2_3_pivot.md) (promoter-first pivot — still load-bearing), [`brand_aware_image_gen.md`](brand_aware_image_gen.md) (Firepit-as-factory reframe — this spec executes the nav side of that).

## Shift in one paragraph

Industry feedback (May 2026) said Sound Cave felt like 2–3 products in one. **Firepit is now the headline product** (broadest use case: media creation + scheduling + social publishing). **Events folds into Firepit as a sub-tab renamed "Summons"** (caveman brand law — see memory `feedback-soundcave-caveman-language`). **The Cave splits off as a separate product / premium tier** (artist discovery & tracking). Result: two top-level surfaces instead of five, clearer wedge, real tier story.

## Current nav (before)

**Top-level pills** (header):
- EVENTS · FIREPIT · THE CAVE · BRANDS · REFLECTION

**Firepit sub-tabs:** FORGE · STASH · TRAIL MAP
**Cave sub-nav:** DASHBOARD · FORAGING · ROSTER · FOOTPRINTS

## Target nav (after)

**Top-level pills** (header):
- **THE CAVE** · **FIREPIT** · REFLECTION  *(order updated 2026-05-28)*

**Firepit sub-tabs** (new order, left to right):
- **SUMMONS** (was top-level EVENTS — renamed)
- **FORGE** (existing)
- **TRAIL MAP** (existing)
- **STASH** (existing)
- **BRAND KITS** (was top-level BRANDS — folds in)

**Cave sub-nav:** unchanged — DASHBOARD · FORAGING · ROSTER · FOOTPRINTS

**Default landing tab:** **The Cave** (Doug's call 2026-05-28 — Cave is first in nav order, default-landing matches. Earlier this session he chose Firepit → Forge; that's been superseded.)

## Rationale per decision

1. **Why Firepit headline (not Events):** Firepit is the asset factory + scheduler — broader promoter wedge ("we make your content") vs. Events ("we run your gigs"). Industry feedback confirmed Firepit was the part promoters reacted to most.
2. **Why "Summons" (not Gatherings):** Doug's call 2026-05-28. Ritualistic, tribal, fits Forge / Stash / Roster pattern.
3. **Why Cave stays in-app (not split repo):** premium-tier hook is stronger when Cave is one upgrade-click away inside the same product. Splitting repos is a v1.1+ decision once tier data exists.
4. **Why Brands folds into Firepit:** the v0.6 spec already planned this ("Firepit becomes the home for all asset creation — brand kits, master event flyers, derivative post images"). This restructure executes it.
5. **Why Reflection stays top-level:** lightweight surface, doesn't belong inside Firepit's workflow. May fold elsewhere later but out of scope now.

## Scope

### In scope

- Top-level nav rewrite in `index.html` — remove EVENTS pill, remove BRANDS pill, reorder remaining.
- Add SUMMONS + BRAND KITS as new sub-tabs inside the existing `firepit-modes` strip.
- Re-parent the existing Events surface (`#tab-events` block + all `js/events_*.js` modules) so it renders inside Firepit instead of at top level. Mechanically: the `#tab-events` content is mounted into a `#firepit-summons` container when SUMMONS subtab is active.
- Re-parent the existing Brands surface similarly into `#firepit-brand-kits`.
- Rename every user-facing "Event" / "Events" UI string → "Summons" (singular and plural — keep grammar correct: "this Summons", "all your Summons" — Doug to verify reads OK).
- Default tab on load = `firepit`, with Firepit's internal mode = `summons`.
- Update `tab-home` (Overview) hero copy + button: button changes from "Enter The Cave" to "Enter Firepit"; description copy reframes Firepit as the headline.
- Update terminology grid cards on the Overview to add Summons + reorder so Firepit-related terms lead.
- Wiki updates: rename `features/events.md` → `features/summons.md`; update `features/firepit_forge.md` cross-refs; update `phase_2_3_pivot.md` banner to point to this spec; new log entry.

### Out of scope (later)

- **Backend rename** — DB tables stay `events`, `lineup_slots` etc. API routes stay `/api/events/<id>`. Only user-facing labels change. Rationale: a schema rename is a migration storm with no user value; the word "Summons" is purely a UI affordance.
- **Cave splitting into its own repo / domain** — deferred to post-beta tier work.
- **Reflection tab restructure** — leave as-is.
- **Tier gating UI** (locking Cave behind a paid tier) — separate spec.
- **Renaming "voice preset" / "post" / other deep terms** — only "Event/Events" → "Summons" in this pass.
- **Splash + cave-entrance surfaces** — keep as-is; Cave entry is still meaningful for the Cave product surface.

## File-level change list

| File | Change |
|---|---|
| `index.html` | Remove EVENTS + BRANDS htabs; reorder remaining. Add SUMMONS + BRAND KITS to `firepit-modes` strip. Move `#tab-events` and `#tab-brands` content blocks inside `#tab-firepit` (or keep as siblings and toggle visibility via Firepit subtab state — TBD by implementation). Update Overview hero + terminology cards. |
| `js/app.js` (or wherever `switchTab` + default tab lives) | Default tab = `firepit`. New mapping: tabs `events`/`brands` redirect to `firepit` + set internal Firepit mode. |
| `js/firepit.js` | `setFirepitMode` gains `'summons'` and `'brandkits'` cases — shows/hides the right containers. |
| `js/events_*.js` (6 modules) | UI strings: `EVENTS` → `SUMMONS`, `Event` → `Summons`, `New event` → `New summons`, etc. Logic unchanged. |
| `js/brands.js` | UI strings: `BRANDS` → `BRAND KITS` where it appears as a top-level concept. Editor surface unchanged. |
| `wiki/features/events.md` → `summons.md` | Rename + replace "event" with "summons" in user-facing text; keep schema/API references as `events`. |
| `wiki/spec/phase_2_3_pivot.md` | Banner at top: "Nav restructure executed via [`firepit_headline.md`](firepit_headline.md), 2026-05-28." |
| `wiki/log.md` | New entry. |

**No backend changes. No schema migration.** This is purely UI/IA work.

## Risk + rollback

- **Risk:** moving `#tab-events` into Firepit may break CSS scoping (events styles may rely on being a top-level tab). Mitigation: keep events markup as a sibling, just toggle visibility based on Firepit's internal mode; don't physically re-parent the DOM if it costs us CSS rework.
- **Risk:** every test/dogfood from previous sessions assumed EVENTS was the default landing. Anyone returning to the app will be confused for ~5 seconds. Acceptable — it's a re-positioning, that confusion is the point.
- **Rollback:** the whole change is in `index.html` + a handful of JS modules + UI strings. If it feels wrong after a day's use, revert is `git revert <commit-sha>`.

## Definition of done

- Header has **two** primary pills: THE CAVE, FIREPIT (plus REFLECTION).
- Firepit's mode strip shows: FORGE · SUMMONS · TRAIL MAP · STASH · MARKS.
- App boots on Firepit → Summons.
- Every user-facing "Event(s)" label reads "Summons" (singular grammar intact).
- The Cave still works identically as a sibling product surface.
- Overview hero says "Enter Firepit" (not "Enter The Cave").
- Wiki: `features/summons.md` exists; `phase_2_3_pivot.md` banner updated; log entry written.
- Doug confirms visually via screenshot before "done".

## Sign-off

- [x] Doug — target nav structure approved (2 top-level pills + Firepit subtab order) — 2026-05-28
- [x] Doug — default landing = Firepit → **Forge** (overrode Summons-default) — 2026-05-28
- [x] Doug — Brand Kits folds into Firepit in this pass approved — 2026-05-28
- [x] Doug — backend tables/routes stay as "events" (UI-only rename, assumed from non-selection of rename-backend option) — 2026-05-28
