# Feature — Events

> Status: **Shipped 2026-05-13** (Phase 2). Authoritative spec: [`phase_2_3_pivot.md`](../spec/phase_2_3_pivot.md). Mission brief: `~/Downloads/Soundcave Phase 2.3 Mission.md`.

## What it is

The first-class container for a promoter's night. An **Event** has a name, date/time, venue, ticketing link, voice preset, and a **lineup** of linked artist Profiles. Every campaign attaches to exactly one Event.

## Why it exists

Phase 2 pivot: Sound Cave's wedge is "turn one event into a month of content." Without an Event entity, the system can't sequence campaigns, link assets to artists, or measure follow-through. Events make the whole platform make sense.

## Entry points

- **Top-nav `EVENTS` pill** — first position (signals promoter-first). Lands on the events list (upcoming + past cards). The default landing tab on app load.
- **Flyer drop** — drag any event poster (PNG/JPG/WEBP ≤10MB) onto the dashed card above the list. Claude Sonnet 4.6 vision extracts `{name, event_date, venue_name, venue_city, ticketing_url, lineup[]}` in ~15s. The new-event form opens pre-filled.
- **`{NEW EVENT}` button** — same form, blank.

## Lineup matching pipeline

For each name in the lineup textarea (one per line), `POST /api/artist-profiles/match` returns:

1. **Local profiles** — exact-then-fuzzy `ilike` against `artist_profiles.display_name` (already in our DB from past scout reports or events).
2. **SoundCloud candidates** — top 3 hits from `/users?q=<name>` plus the artist's top track for instant audio confirmation.

The promoter picks one card per artist (local / SoundCloud / manual stub / skip). On save:
- SoundCloud picks → `POST /api/artist-profiles/scrape` upserts a stub Profile (`claimed: false`).
- Manual picks → `POST /api/artist-profiles` creates a name-only stub.
- Local picks → linked as-is.

## Data model

- `events` — `owner_id`, `name`, `event_date`, `venue_name`, `venue_city`, `ticketing_url`, `flyer_image_url`, `hero_track_url`, `status` enum, `voice_preset` enum, `brand_color_primary/secondary`.
- `lineup_slots` — `event_id` (cascade), `artist_profile_id` (FK), `billing_position` enum, `billing_order`, `set_time`, `set_notes`.
- RLS: owner-only on `events`; lineup_slots scoped via parent event.

Migration: `db/0012_events_lineup.sql` + FK backfill in `db/0013_artist_profiles.sql`.

## Code map

| Layer | Path |
|---|---|
| Frontend module | `js/events.js` (list / new-form / match-review / detail / campaign timeline) |
| Tab panel | `index.html` `#tab-events` |
| Backend | `events_api.py` |
| Vision extraction | `events_api.py` `extract_flyer()` (Sonnet 4.6) |
| Match pipeline | `artist_profiles_api.py` + `soundcloud_helpers.py` |
| Shared auth + supabase | `sb_helpers.py` |

## API surface

| Verb | Path | Purpose |
|---|---|---|
| GET | `/api/events` | List owner's events |
| POST | `/api/events` | Manual create (+ inline lineup) |
| GET | `/api/events/<id>` | Detail with joined lineup + artist profile data |
| PATCH | `/api/events/<id>` | Edit name / date / venue / voice |
| DELETE | `/api/events/<id>` | Cascade delete |
| POST | `/api/events/extract-flyer` | Flyer upload + vision extraction |
| POST | `/api/events/<id>/generate-campaign` | Phase 3 — see [`campaigns.md`](campaigns.md) |

## What's NOT here (yet)

- Multi-day or recurring events
- Co-promoter / shared ownership
- Event-level analytics (Footprints wires in Phase 5)
- Edit lineup post-save (today: edit the row by deletion+recreation)
- Auto-disambiguation by city/genre beyond what SoundCloud surfaces

## Known debt

- `js/events.js` exceeds the project's 500-line file limit (563 lines as of 2026-05-13). Pending split into `events_list.js` / `events_form.js` / `events_match.js` / `events_detail.js`.
- Lineup edit UX — currently no "edit lineup" button on event detail.
- "Roster" cosmetic rename done in subnav + welcome card; `tab-clan` ID and `js/clan.js` keep their old names for now (full data-layer migration is later).
