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

## Other terms

| UI label | What it is | Internal key |
|---|---|---|
| **Cut** | Remove an artist from active tracking. Cut artists are preserved but hidden from the Mural & Footprints. | `status: 'cut'` on a Clan/`roster` row |
| **Beat** | Rights-gated audio attached to posts (clip picker + copyright gate). | `firepit_beat`, `hero_track_url` |
| **Summon / Gathering** | A single event/campaign. | a row in `events` |

## Rename log (UI label history)
- **2026-06-09:** Dashboard → **Mural**; Roster → **Clan** (reverted); Summons → **Gatherings**.
- **2026-05-28:** Events → Summons.
- Earlier: Clan → Roster; Brand Kits → Marks.
