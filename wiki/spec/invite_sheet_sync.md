# Spec — Sheet-Driven Invite Minting (one-way)

**Status:** Built 2026-06-27 · **Branch:** `claude/invite-code-lloyd-hugo-5kbtn5`
**Builds on:** [invite_codes_per_friend.md](invite_codes_per_friend.md) (the single-use code table + redeem flow). This spec only adds a **bulk minting path**; it does not change redemption or the schema.

## Why

Doug is inviting beta users in waves and wants one place to manage codes. Minting one at a time with `scripts/mint_invite.py` doesn't scale to "send the app to N friends this week." The fix: **a Google Sheet is the source of truth for minting** — Doug keeps the sheet up to date, and a sync pushes any new rows into the `invite_codes` table. No code values pass through chat (they live in the sheet + Supabase only).

## Decision (option A — one-way, in-session)

Of the options weighed with Doug (2026-06-27):
- **A (chosen):** in-session trigger, **one-way** sheet → Supabase. Zero Google Cloud setup. Redemption status is read from Supabase on demand, not written back into the sheet.
- B (deferred): a Google **service account** + GitHub Action for fully-automatic, **two-way** sync (status flows back into the sheet cells). Rejected for now because the connected Google Drive integration **can read a sheet but cannot edit its cells** — true write-back requires a service account, which Doug didn't want to set up for ~10 invitees. The sync script is written so B is a small additive upgrade later (swap the input source for a `gspread` read + add a write-back pass).

## The sheet

**"Sound Cave — Invite Codes & Promos Tracker"** (in Doug's Drive). Columns:

`Code · Type · Recipient · Email · Value · Status · Sent? · Redeemed By · Redeemed At · Date Created · Notes`

The sync reads only three: **`Code`** (required), **`Email`** (→ `label`, falling back to `Recipient`), **`Value`** (e.g. `"50 credits"` → the `credits` grant; defaults to `FREE_TRIAL_CREDITS`/50). The rest are Doug's own tracking columns and are ignored by the sync. `Status`/`Redeemed By`/`Redeemed At` are maintained by Doug (or eyeballed against `list_invites.py`) — the sync never writes them.

## How it works

`scripts/sync_invites_from_sheet.py` — reads the sheet text on **stdin** (or `--csv <file>`), auto-detecting **Markdown pipe-table** (what the Drive integration returns) or **CSV**. For each row with a code it builds `{code (UPPER), label, credits}` and does an **insert-only** batch upsert to `invite_codes` (`Prefer: resolution=ignore-duplicates`). Idempotent by construction:

- New code → minted.
- Existing code (incl. already-redeemed) → **left completely untouched**. Re-running is always safe.
- `--dry-run` parses and prints the plan without touching Supabase (and needs no credentials).

Changing an *existing* code's credits/label in the sheet does **not** propagate (insert-only by design — so a redeemed code can never be clobbered). To change a live code, edit it in Supabase directly. New codes are the common case.

### In-session flow (the everyday path)

1. Doug edits the tracker sheet (adds rows for new invitees) in Google Sheets.
2. Doug, in any Claude session: **"sync the invite codes."**
3. Claude reads the sheet via the Google Drive integration, pipes the content to `sync_invites_from_sheet.py`, and reports `N minted · M already existed`.
4. (Optional) Claude runs `scripts/list_invites.py` to show who's redeemed.

### One-time setup (required before step 2 works)

The Supabase **service key** is intentionally absent from cloud Claude sessions. For the in-session sync to write, add to the **Claude Code web environment** (not committed to the repo):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_KEY`

(Same values as the existing scout/tracker workflow secrets.) Running locally instead, the script picks these up from the workspace-root `.env` like the other scripts.

## Out of scope (→ option B if/when wanted)
- Writing redemption status back into the sheet (needs a Google service account).
- A scheduled/automatic sync (GitHub Action) — currently Doug-triggered in-session.
- Updating existing codes' grant size from the sheet (insert-only on purpose).

## Acceptance
- `--dry-run` on the real sheet lists every code with its parsed credits, skipping the header/rule rows. ✅ verified 2026-06-27.
- A sheet with a new row → run sync → new code appears in `invite_codes` (open); re-running mints nothing new. *(verified once SUPABASE creds are present in the run environment.)*
- Redeemed codes are never modified by a re-sync (insert-only).
- Missing creds on a real (non-dry) run fails loudly with a clear message, after parsing. ✅ verified 2026-06-27.
