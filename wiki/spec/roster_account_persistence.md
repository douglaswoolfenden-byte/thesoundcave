# Spec — Roster Account Persistence

> Status: **Approved — 2026-06-08** by Doug.
> **Terminology:** the UI label for this feature is **CLAN** (see [glossary](../glossary.md)). The persistence layer — table, API, and `js/roster_sync.js` — keeps the name `roster`. "Roster" in this spec = the Clan's data layer.
> Related: [`../features/clan.md`](../features/clan.md) (the Roster feature), [`auth_login_ui.md`](auth_login_ui.md) (Supabase auth this builds on), [`image_gen_v2.md`](image_gen_v2.md) (the `avatars` table/API pattern we copy).

## Problem

The Roster (a.k.a. Clan) — the user's curated working set of artists — lived **only in browser `localStorage`** (`sc_favs`, plus `sc_watching` / `sc_dismissed` for the Foraging curation state). `localStorage` is scoped to one origin **and** one browser profile, so a roster built in one place is invisible everywhere else and vanishes if that profile/origin is cleared. Doug curated a full roster and lost it: his signed-in account on `localhost:3000` held only the Supabase auth token, with no `sc_favs` on any origin.

The save path itself works (verified end-to-end: `addFavourite` → reload → roster shows it). This is an **architecture gap, not a bug**: now that the app has real Supabase accounts, the roster must follow the **login**, not the browser.

## Decision

Persist the roster to the user's Supabase account as the source of truth, with `localStorage` demoted to a local cache. Reuse the proven `avatars` pattern wholesale (RLS table + `sb_helpers` auth + owner-scoped blueprint + `scAuth.authedFetch` on the frontend).

## Approach — write-through cache

The frontend's roster reads (`getFavourites()` in `js/app.js`) are **synchronous** and called in many places. Rather than rewrite them all to async, treat the account as source of truth and `localStorage` as a hot cache:

1. **Load on init** (after auth): `GET /api/roster` → write results into `sc_favs` / `sc_watching` / `sc_dismissed`. All existing sync reads keep working unchanged.
2. **Write through on mutation**: after updating `localStorage` (optimistic UI), push the change to the API. Fire-and-forget with error logging.
3. **Reconcile on every load**: the next load overwrites the cache from the account, so a dropped write self-heals.
4. **One-time migration**: if the account roster is empty but `localStorage` already has favs, push them up first (rescues any surviving local-only roster, including Doug's if still in another browser).

Signed-out → every sync function is a no-op, so the app still runs offline against `localStorage` alone.

## Data model

**`public.roster`** — one row per saved artist, mirrors the `sc_favs` entry shape:

| column | type | notes |
|---|---|---|
| `id` | uuid pk | `gen_random_uuid()` |
| `user_id` | uuid | FK `public.users(id)`, RLS scope |
| `artist_username` | text | the `sc_favs` key |
| `display_name`, `genre`, `avatar_url`, `artist_url` | text | |
| `status` | text | `active` \| `cut`, default `active` |
| `notes` | text | |
| `platforms`, `preferred_tracks`, `snapshots`, `tracks_seen` | jsonb | |
| `playlist_adds` | int | |
| `added_date` | date | |
| `created_at`, `updated_at` | timestamptz | trigger on update |
| | | **`unique (user_id, artist_username)`** → clean upsert |

**`public.roster_prefs`** — one row per user for the two Foraging arrays:

| column | type |
|---|---|
| `user_id` | uuid pk, FK `public.users(id)` |
| `watching` | jsonb default `'[]'` |
| `dismissed` | jsonb default `'[]'` |
| `updated_at` | timestamptz |

Both RLS-scoped `auth.uid() = user_id`. Service-role client bypasses RLS; owner scoping applied in code (the house convention — see `sb_helpers.supabase()`).

## API — `/api/roster`

- `GET /api/roster` → `{ roster: [...], watching: [...], dismissed: [...] }`
- `POST /api/roster` → upsert one artist on `(user_id, artist_username)`
- `DELETE /api/roster/<username>` → remove that artist
- `PUT /api/roster/prefs` → upsert `{ watching, dismissed }`
- `POST /api/roster/import` → bulk upsert (migration); idempotent via the unique constraint

## Migration / manual op

`db/0017_roster.sql` (idempotent, follows `db/0016_avatars.sql`). **Doug applies it once** in Supabase → SQL Editor → Run. Until then `/api/roster` calls 500.

## Out of scope

- Wiring `clan_tracker.py` (daily GH Action) to read the account roster instead of `data/clan_artists.json` — natural follow-up now that the roster is server-side, tracked separately.
