# Spec — Per-User SoundCloud OAuth

> Status: **Approved 2026-06-26**

## Why

The liked-tracks feature (v1) used Doug's own SC account (duggom8) to find tracks he'd liked for artists in Clan. That's an admin-only view — not useful for other users. Per-user OAuth lets each Cave member connect their own SoundCloud account, so their likes, follows, and feed data personalise their experience.

SoundCloud's app registry closed July 2022 — no new apps can register. Sound Cave's credentials are grandfathered and this is a meaningful moat.

## What it unlocks

- **Liked tracks per user**: each user's ♥ badges in the artist modal reflect THEIR own SC likes, not Doug's.
- **Future**: pre-populate Clan from the user's SC follows (`/me/followings`); "from your feed" mode in Foraging.

## Flow

1. User opens Reflection tab → clicks **Connect SoundCloud**.
2. Frontend calls `GET /api/auth/soundcloud/connect` (auth header required) → gets back `{ url }`.
3. Frontend navigates to the SC authorize URL. User approves on SoundCloud.
4. SC redirects to `https://soundcave-api-production.up.railway.app/api/auth/soundcloud/callback?code=...&state=...`.
5. Backend validates state signature, exchanges code for tokens server-side (client_secret stays on server), stores in `user_soundcloud_connections`.
6. Backend redirects browser back to the app (`https://douglaswoolfenden-byte.github.io/thesoundcave/`).
7. Reflection tab now shows SC username + Disconnect option.

## State security

State param = `base64({"user_id":..., "ts":...}).HMAC_SHA256(payload, secret)`.
- Verified on callback: signature valid + ts within 10 minutes.
- No extra DB table — stateless.
- Secret derived from `SUPABASE_SERVICE_KEY` (already in Railway).

## DB

Table `user_soundcloud_connections` (migration `0022`):
- `user_id` → FK to `public.users.id`, unique (one SC account per Cave account)
- `sc_user_id` TEXT — numeric SC user id
- `sc_username` TEXT — SC permalink handle
- `access_token` TEXT — stored server-side only; never sent to frontend
- `refresh_token` TEXT
- `scope` TEXT
- `connected_at`, `updated_at`

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/api/auth/soundcloud/connect` | required | Returns SC authorize URL |
| GET | `/api/auth/soundcloud/callback` | none (SC redirect) | Exchanges code, stores tokens, redirects to app |
| GET | `/api/auth/soundcloud/status` | required | Returns `{ connected, sc_username, sc_user_id }` |
| DELETE | `/api/auth/soundcloud/disconnect` | required | Removes user's SC connection |

## UI (Reflection tab)

- Not connected: orange "Connect SoundCloud" button.
- Connected: `SOUNDCLOUD · @username` stat chip + "Disconnect" link.
- Post-login nudge: one-time banner (localStorage `sc_oauth_nudge_shown`) directing to Reflection tab.

## SC app settings

Redirect URI registered at `soundcloud.com/you/apps`:
```
https://soundcave-api-production.up.railway.app/api/auth/soundcloud/callback
```

## Out of scope (now)

- Per-user SC follows pre-populating Clan
- "From your feed" foraging mode
- Token refresh (SC access tokens are long-lived; refresh on 401)
