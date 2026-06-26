-- 0021 — per-friend single-use invite codes
-- Supersedes the env INVITE_CODES shared-pool path from 0020. A code now lives in
-- a table and is consumed by the FIRST account that redeems it (redeemed_by set
-- once, atomically), so a leaked code is already-spent = harmless. The frontend
-- Claim flow + 0-credit signup from 0020 are unchanged.
-- Spec: wiki/spec/invite_codes_per_friend.md
-- Idempotent — safe to re-run.

create table if not exists public.invite_codes (
  code         text primary key,              -- stored UPPER-case; redeem match is case-insensitive
  label        text,                          -- who it's for (email / name) — attribution
  credits      integer not null default 50,   -- grant size for THIS code (lets the grant vary per friend)
  redeemed_by  uuid references public.users(id) on delete set null,
  redeemed_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Codes are secrets: only the service-role key (which the Flask backend uses and
-- which bypasses RLS) may read/write. RLS on + no policies = the browser anon
-- client can never list or probe codes.
alter table public.invite_codes enable row level security;

-- Helpful for the open-vs-redeemed ledger view (scripts/list_invites.py).
create index if not exists invite_codes_redeemed_by_idx on public.invite_codes (redeemed_by);
