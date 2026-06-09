# Feature: Firepit — Stash

> Status: **Campaign-block grid (2026-06-09).** Supabase-backed (`stash_items` table) via `/api/stash` service-role proxy. Frontend keeps an in-memory cache; one-shot `migrateLocalStorageStash()` ports legacy `sc_content_library` rows on first load, then clears localStorage. The view layer now lives in `js/stash.js` (firepit.js retains the data layer + Forge-coupled mutations).

## What it does
Library of all content generated in Forge or by a campaign. User can browse, re-open, copy, and schedule (via Trail Map).

### Campaign-block layout (2026-06-09)
The stash is a **grid of blocks**, not a flat list:
- **Campaign tiles** — a campaign produces 6–14 posts for one Gathering (event). They cluster into a single tile (cover + post-count badge + date range). Clicking drills into that campaign's posts only.
- **Single tiles** — loose Forge items (no campaign) sit alongside as their own tiles; clicking opens the item in the Forge. They look identical to campaign tiles but don't drill in (no children).
- **Identity + countdown** — every tile shows a title and, for campaign posts, a countdown label (`7-DAY`, `3-DAY`, `DAY OF`, `ANNOUNCEMENT`…) derived from `post_type` via `postTypeLabel()`.
- **Count** — shown inside the panel header (`STASH · N pieces`), not on the top FIREPIT pill or subnav (those badges were removed).

**Keystone:** grouping required no backend change. Campaign posts already store `campaign_id`/`event_name`/`post_type`/`scheduled_for` at the top level of `stash_items.metadata` (`_upsert_post_into_stash` in `campaigns_api.py`); `_stashRowToItem` was extended to carry them through to the UI item shape.

### Schedule-lock (sync with Trail Map)
A stash item placed on the Trail Map is *derived* as `scheduled` (its id appears in the shared `/api/scheduled_posts` cache). **It stays visible** in the Stash with a clear `scheduled` badge — Doug's call (2026-06-09): clarity over hiding. In the **Trail Map drawer** the scheduled card is shown dimmed + non-draggable so it can't be double-scheduled. Deleting the calendar entry returns it to drafts/draggable automatically. No write on schedule, no new endpoint, two-way auto-sync derived from the cache.

### Campaign management (2026-06-09)
- **Hover settings** on a campaign tile: **Open Gathering** (`openGathering` → `switchTab('events')` + `openEvent(eventId)`) and **Delete campaign** (`deleteStashCampaign` → confirm, bulk-`DELETE /api/stash/<id>` for every post in that `campaignId`; clears the stash only, the Gathering/campaign record stays).
- **Action icons** are Cave-style inline line-art (matching clan/watch/cut), not emoji — edit / copy / delete, each with a tooltip.
- **Proposed dates**: every drill-in post tile shows small-print `Proposed · <date>` (from `scheduledFor`) so the campaign reads as a timeline; loose items show `Saved · <date>`.
- **Lifecycle (parked):** `posted`/`archived` badge styles exist; auto-archive-after-post and auto-delete-after-N-days are deferred — to be designed.

## Why it exists
Generation without persistence is throwaway. Stash is the bridge between "I made something" and "I'm going to publish it" — the input to Trail Map and to multi-platform distribution.

## Acceptance criteria
- [x] Saves Forge output to library
- [x] Browse / re-open
- [x] Filter by type / status (search + type + status filters)
- [x] Group campaign posts into campaign blocks; drill in — done 2026-06-09
- [x] Push to Trail Map for scheduling (drag-drop; schedule-lock sync)
- [x] Migrate from `localStorage` to server-side storage (SaaS prerequisite) — done 2026-04-29

## Dependencies
- `js/stash.js` (view layer: grid, campaign grouping, drill-in, `postTypeLabel`, scheduled-set)
- `js/firepit.js` (data layer: `_stashCache`, `_stashRowToItem`, `loadStash`, `saveToStash`, Forge-coupled `editStashItem`/`copyStashItem`/`deleteStashItem`)
- `content_api.py` `/api/stash` + `/api/scheduled_posts` endpoints (service-role; Phase B replaces with per-user JWT)
- Supabase `stash_items` (RLS scoped on `user_id`); campaign linkage from `campaigns_api.py` bridge

## Related
- `wiki/features/firepit_forge.md` — produces the content
- `wiki/features/firepit_trail_map.md` — consumes Stash items for scheduling
