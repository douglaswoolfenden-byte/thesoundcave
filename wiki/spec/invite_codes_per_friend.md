# Spec — Per-Friend Single-Use Invite Codes

**Status:** proposed 2026-06-26 (Doug) · **Branch:** `invite-codes`
**Supersedes:** the env `INVITE_CODES` shared-pool path in [free_trial_invite_gate.md](free_trial_invite_gate.md) (that gate ships the *frontend Claim flow + 0-credit signup*, which we keep — only the **server-side validation source** changes from an env set to a DB table).

## Why now

Doug is sending the live app to music-industry friends. The shipped gate validates a redeemed code against a **shared env set** (`INVITE_CODES`), where a code is redeemable **once per account** but **unlimited times across accounts**. Two gaps for a real rollout:

1. **Leak = drain returns.** One shared code pasted into a Discord → every new signup claims 100 credits (£6 fal each), unbounded — the exact risk [decision 0012](../decisions/0012_invite_gate_launch_safety.md) closed at signup reopens at the gift.
2. **No attribution.** Doug can't tell which friends actually redeemed / engaged.

## Goal

Issue a **unique, single-use code per friend**, tied to who it's for. A redeemed code is spent forever (a leak is already-claimed, harmless). Doug can see who redeemed what and when.

## Design

### Single-use, globally — the core change
A code lives in a DB table, not an env var. It is consumed by the **first account** that redeems it (`redeemed_by` set once, atomically). After that it's dead. This is what makes a leak harmless.

Two independent guards both still hold:
- **Per-code:** a code grants **exactly once, ever** (across all accounts).
- **Per-account:** an account can claim **at most one** trial (existing `users.trial_claimed`), so nobody stacks credits by collecting codes.

### Schema — `db/0021_invite_codes.sql`
```sql
create table if not exists public.invite_codes (
  code         text primary key,              -- stored UPPER-case; match is case-insensitive
  label        text,                          -- who it's for (email / name) — attribution
  credits      integer not null default 50,   -- grant size for THIS code (lets Doug vary it)
  redeemed_by  uuid references public.users(id) on delete set null,
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now()
);
alter table public.invite_codes enable row level security;
-- No policies → only the service key (which bypasses RLS) can read/write. Codes are
-- secrets; the browser anon client must never be able to list them.
```

### Backend — `content_api.py`, `POST /api/redeem-invite`
Keep auth + per-IP rate-limit. Replace the env-set check with a table transaction (all via the service-role `_stash_client`, ordered so a failed claim never burns a code or an account's one-shot):

1. **Claim the code** (atomic, single-use): `update invite_codes set redeemed_by=uid, redeemed_at=now() where code=? and redeemed_by is null` → returns the row (incl. `credits`). No row updated → code is **unknown or already used** → `403 invalid_code` (no distinction → no code-enumeration). Account untouched.
2. **Claim the account** (atomic, one-shot): `update users set trial_claimed=true where id=uid and trial_claimed=false`. No row → account already claimed → **roll back the code** (`redeemed_by=null, redeemed_at=null`) so it isn't wasted → `409 already_claimed`.
3. **Grant** `grant_credits(uid, code.credits, 'free_trial_invite')`. On failure → roll back **both** the code and the account flag → `500 grant_failed`.
4. Return `{ ok, granted, credits_balance }`.

`FREE_TRIAL_CREDITS` env constant stays as the **default grant**, now **50** (used by `/api/billing/plans` and as the mint default). The env `INVITE_CODES` set is no longer consulted by redeem — left defined but inert (documented as superseded).

### First codes
Two memorable codes minted for the first invitees — **George** (`georgeshipton8@gmail.com`) and **Josh** (`josh@grail-talent.com`). Doug chose name-based codes (memorable over random); they're guessable, accepted for a friends beta because single-use + per-IP rate-limit (8/hr) + per-account-once + £3 cap + revocable bound the blast radius. Future codes can default to random `CAVE-XXXXXX`.

> **The actual code strings are NOT recorded here — this repo is public.** They live only in the `invite_codes` table and Doug's own records (`scripts/list_invites.py`). Never commit a live code value to git.

**Frontend is untouched** — the existing Claim input still `POST`s `{code}`; only the backend's notion of a valid code changes.

### Issuing + tracking — local scripts (no new UI)
Codes are credentials → they must not pass through chat. Doug mints them himself; the value prints to **his** terminal.

- **`scripts/mint_invite.py "<email-or-name>" [credits]`** — generates an unguessable code (`CAVE-` + 6 chars from an unambiguous base32 alphabet via `secrets`), inserts a row (`label`, `credits`), prints the code once for Doug to send. Re-runnable per friend.
- **`scripts/list_invites.py`** — prints the ledger: `label · code · status (open/redeemed) · redeemed-by email · when`. Doug's at-a-glance "who's tried it."

Both load Supabase service creds from workspace `.env` (same pattern as other scripts).

## Out of scope
- Admin web UI to mint/list codes (scripts suffice for a handful of friends; revisit if it scales).
- Expiring codes / bulk batches (single-use already caps exposure; add later if needed).
- Per-endpoint generation rate-limits (unchanged from 0012 — the 0-credit gate is the real protection).

## Manual prod steps (Doug)
1. Apply `db/0021_invite_codes.sql` in the Supabase SQL editor (or via the deploy script).
2. `railway up` the backend (redeem now reads the table).
3. (Optional) set `FREE_TRIAL_CREDITS` in Railway to tune the default grant (code default is now 50).
4. Mint the first codes (use the codes Doug chose — not committed here):
   - `python scripts/mint_invite.py "georgeshipton8@gmail.com" --code <george-code>`
   - `python scripts/mint_invite.py "josh@grail-talent.com" --code <josh-code>`

## Acceptance
- Mint a code → row appears in `invite_codes` (open).
- Fresh signup (0 credits) → redeem that code → `credits` granted, balance shown; code now `redeemed_by` that user.
- **Same code, second account → `403 invalid_code`** (single-use proven — the headline guarantee).
- Same account, second code → `409 already_claimed`.
- Unknown/garbage code → `403`; endpoint still per-IP rate-limited.
- `list_invites.py` shows George's code flipped open → redeemed with his email + timestamp.
