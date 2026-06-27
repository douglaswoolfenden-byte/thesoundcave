# Glossary — Sound Cave terminology (source of truth)

> **Why this exists:** the UI uses caveman-vernacular labels, and several internal code/table names differ from what's shown on screen (and from older labels). When Doug reads a term off the website, this page is how you map it to the concept *and* the code. **Keep this current:** any UI label rename must be reflected here in the same change. Caveman-language law lives in the global memory `feedback_soundcave_caveman_language`.

## How to read this
**UI label** = what Doug sees and says. **Internal key** = what the code/DB/API call it (often an older name — do NOT rename code to match the label unless explicitly asked; just map it here). **Was** = prior UI labels, so old wiki/log entries still resolve.

## Top-level navigation (groups)

| UI label | What it is | Internal key | Was |
|---|---|---|---|
| **THE CAVE** | The discovery **umbrella** — the whole section containing Mural · Foraging · Clan · Footprints. Also the brand + splash ("Enter the Cave"). **NOT the dashboard** — that's the Mural. | `data-group="cave"`, top `data-tab="cave"` | — |
| **FIREPIT** | The content-production group (headline product): Forge · Gatherings · Stash · Trail Map · Marks. | `tab-firepit` | — |
| **REFLECTION** | Reflection tab (top nav). | `tab-reflection` | — |

## The Cave — sub-nav

| UI label | What it is | Internal key | Was |
|---|---|---|---|
| **MURAL** | The **dashboard / overview** — "the cave wall where the whole picture lives". Diagonal-stack hero of Clan cards + stat panels + weekly chart strip. | `data-tab="cave"`, `#tab-cave`, `js/cave.js`, `css/dashboard.css` | **Dashboard** (→ Mural 2026-06-09) |
| **FORAGING** | Live + scheduled artist search — the hunt for new talent. | `tab-foraging`, `js/foraging.js` | — |
| **CLAN** | Your saved/tracked artist roster. Account-backed (follows your login). | `tab-clan`, `js/clan.js`, `getFavourites()`/`sc_favs`; account: `roster` + `roster_prefs` tables, `/api/roster`, `js/roster_sync.js` | **Clan → Roster** (2026-05) **→ Clan** (2026-06-09). The persistence layer kept the name `roster`. |
| **FOOTPRINTS** | Analytics & growth charts on tracked artists. | `tab-footprints`, `js/footprints.js` | — |

## Firepit — sub-nav

| UI label | What it is | Internal key | Was |
|---|---|---|---|
| **FORGE** | AI content generator (posts, carousels, posters, bios). | subtab `forge`, `js/firepit.js`, `content_api.py` | — |
| **GATHERINGS** | The promoter's events/campaigns. | subtab `summons`, `events` table, `events_api.py`, `js/events_*.js` | **Events → Summons** (2026-05-28) **→ Gatherings** (2026-06-09) |
| **STASH** | Content library (saved + campaign-block grid). | subtab `stash`, `js/stash.js` (view) + `js/firepit.js` (data), `stash_items` | — |
| **TRAIL MAP** | Content calendar / scheduler (drag-drop). | subtab `trailmap`, `js/trail_map.js`, `scheduled_posts` | — |
| **MARKS** | Brand kits — logos, palettes, reference imagery. | subtab `brandkits`, `brand_kits` table, `js/brands.js` | **Brand Kits → Marks** |

## Forge formats (content types)

| UI label | What it is | Internal key | Was |
|---|---|---|---|
| **FLYER** | Event flyer/poster — structured event facts overlay a styled backdrop. | `event_poster` | **Event Poster + Event Promo → Flyer** (2026-06-11; `event_promo` retired from picker, legacy Stash items keep their label) |
| **POST** | Single social image + caption. | `social_post` | — |
| **CAROUSEL** | Multi-slide social set. | `social_carousel` | — |
| *(retired)* | Artist Spotlight / Bio — folds into Post later as a Spotlight mode. | `artist_bio` (dormant) | retired from picker 2026-06-11 |
| **WHO / WHERE / WHAT / STYLE** | Role chips on uploaded reference images. **WHO = a real person; as of 2026-06-18 WHO flows INTO generation** — the edit model (Nano Banana Pro) integrates the real person into the STYLE ref with accurate likeness ([content_api.py:935](../../content_api.py#L935)). WHERE = place / WHAT = object / STYLE = look-to-copy. | `ref role` in forge ctx | **Carbon-copy law (2026-06-12):** WHO was cutout-composited from the photo, never AI-redrawn — governed the FLUX-era pipeline; **reversed 2026-06-18** once the edit model proved accurate likeness. |
| **SPIRIT** | An **animated cartoon-like character** (created persona/mascot) the engine may freely render in generated media; saved, reusable, attachable to an artist. NOT a real-person likeness — that's a WHO ref. (Redefined 2026-06-12; previously "avatar = face reference set".) | `avatars` table, `js/spirits.js` | Avatar |

## Other terms

| UI label | What it is | Internal key |
|---|---|---|
| **Cut** | Remove an artist from active tracking. Cut artists are preserved but hidden from the Mural & Footprints. | `status: 'cut'` on a Clan/`roster` row |
| **Beat** | Rights-gated audio attached to posts (clip picker + copyright gate). | `firepit_beat`, `hero_track_url` |
| **Summon / Gathering** | A single event/campaign. | a row in `events` |
| **Etchings / an Etching** | The curated style gallery inside Forge — pick a look ("an Etching") as a *starting anchor* for generation (deviate via refs + Additional Context). Each tile is backed by an owned "in-style-of" plate + fonts/palette; picking one injects a STYLE-role ref. | *(to build)* — Forge style picker; see [spec/style_gallery](spec/style_gallery.md) |

## Versioning terms (internal — not UI labels)

| Term | What it is | Notes |
|---|---|---|
| **Age** | A strategic **era** of the product — the 1st version digit. First Age = The Studio, Second = The Market, Third = The Platform. | The roadmap's top level. See [roadmap](roadmap.md), [decision 0013](decisions/0013_version_ages.md). **Not** a subscription tier. |
| **Milestone** | A roadmap step **within an Age** — the 2nd version digit. In the First Age, Milestone `1.N` = [build_plan](build_plan.md) Stage N. | |
| **Iteration** | A shipped release **within a milestone** — the 3rd version digit. | |
| **Version** | `Age.Milestone.Iteration` (e.g. `1.2.3`), git-tagged `v1.2.3`. Current number = root [`VERSION`](../VERSION) file. | |
| **Graduation gate** | The explicit checklist that must clear before the next Age starts (the Age digit bumps). | |
| **Tier** | **Subscription plan** (`tier_solo_monthly` — Solo/Label/Agency, [decision 0003](decisions/0003_saas_architecture.md)) **or** a video quality level (composite/standard/premium). **≠ Age** — eras are "Ages," never "Tiers." | Reserved word; don't reuse for eras. |

## Rename log (UI label history)
- **2026-06-27:** versioning vocabulary added — **Age / Milestone / Iteration** (eras are "Ages," not "Tiers"; "Tier" stays subscription/video). See [decision 0013](decisions/0013_version_ages.md).
- **2026-06-17:** new label **Etchings** (Forge style gallery, not yet built); "Markings"/"Cave Paintings"/"Totems" considered, **Etchings** chosen ("Markings" rejected — collides with "Marks").
- **2026-06-09:** Dashboard → **Mural**; Roster → **Clan** (reverted); Summons → **Gatherings**.
- **2026-05-28:** Events → Summons.
- Earlier: Clan → Roster; Brand Kits → Marks.
