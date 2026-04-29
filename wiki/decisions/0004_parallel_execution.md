# Decision 0004 — Parallel execution plan

> Status: **Approved 2026-04-28**. Companion to `0003_saas_architecture.md`.

Three independent streams across three terminals using git worktrees. Stream 1 is sequential (hard dependency chain). Streams 2 and 3 run fully in parallel with stream 1 and merge in when ready.

---

## Worktree setup (run once, in main worktree)

```bash
cd /Users/douglaswoolfenden/Documents/dwcw
git worktree add ../dwcw-media-gen -b feature/media-gen
git worktree add ../dwcw-trail-map -b feature/trail-map-ui
```

This creates two sibling folders next to `dwcw/`. Each is its own working copy on its own branch — edits in one don't clobber the others.

---

## Stream 1 — Backbone (sequential A → B → C → D → G)

**Worktree:** `/Users/douglaswoolfenden/Documents/dwcw` (main)
**Branch:** `main` (or feature branches per phase, your call)

**Kick-off prompt (paste into terminal 1):**

```
Resume Sound Cave SaaS build, Stream 1 (Backbone).

Read these in order:
1. wiki/decisions/0003_saas_architecture.md
2. wiki/decisions/0004_parallel_execution.md (this file)
3. wiki/log.md (latest entries)

You are on Stream 1, main worktree. Find the next unchecked item in the
Stream 1 checklist below. Execute it. When done: check the box, append a
wiki/log.md entry, commit. Then either continue to the next item or stop
and report progress.

Ask Doug before any action that needs an API key he hasn't provided yet.
```

**Stream 1 checklist (Resume here):**

Phase A — Foundations
- [x] Create Supabase project; save URL + keys to `.env`
- [x] Design schema: `users`, `artists`, `stash_items`, `credits_ledger`, `scheduled_posts`, `connected_accounts`
- [x] Apply schema via Supabase SQL editor (applied via psycopg + pooler — see `db/README.md`)
- [x] Enable Storage buckets: `generated_images`, `generated_videos` (public read)
- [x] Migrate `js/firepit.js` Stash from localStorage → Supabase `stash_items` (via `/api/stash` proxy)
- [x] Migrate `image_gen.py` to write to Supabase Storage instead of `data/generated_images/`

Phase B — Auth + tenancy
- [x] Add Supabase auth client to frontend (email magic link) — `js/lib/supabase.js`
- [x] Login / logout UI — splash-gate login + nav account dropdown with sign-out
- [x] Add Row Level Security policies on every table (`user_id = auth.uid()`) — done in Phase A; backend uses service role + JWT-resolved user_id
- [x] Account/settings page — minimal nav dropdown (email, tier, credits, sign out)
- [x] Sync trigger `auth.users` → `public.users` on signup (`db/0004_auth_sync.sql`)
- [x] Drop dev user `00000000-…0001` + re-add `users.id → auth.users.id` FK (applied 2026-04-29 after Doug's first real sign-in)

Phase C — Credits engine
- [x] `credits_ledger` table with append-only ledger pattern (Phase A schema)
- [x] `debit_credits(user_id, amount, reason)` and `refund_credits(...)` helpers — `db/0005_credits.sql` (atomic via SELECT FOR UPDATE; raises `insufficient_credits`)
- [x] Middleware on `content_api.py`: debit before call, refund on failure (`/api/generate` 1cr, `/api/generate-image` 5cr)
- [x] Frontend widget: "You have X credits" in nav (account dropdown updates live from gen response)

Phase D — Stripe
- [x] Create products in Stripe (Solo £29, Label £79, Agency £199, credit packs) — `scripts/stripe_bootstrap.py`, run 2026-04-29 against test mode
- [x] Stripe Checkout integration — `/api/billing/checkout` + pricing modal in account dropdown (with `[hidden]` CSS fix on 2026-04-29)
- [x] Webhook handler → top up credits on subscription create + `invoice.payment_succeeded` (renewal). Fixed 2026-04-29 after first live test surfaced `StripeObject.get()` AttributeError + API `2026-04-22.dahlia` `current_period_end` move-to-item.
- [x] Customer portal link for cancellations — `/api/billing/portal`, "Manage billing" link in dropdown

Phase G — Ayrshare integration (depends on B)
- [ ] Ayrshare account + dev API key
- [ ] OAuth dance to connect IG/TikTok/X/LinkedIn per user → save to `connected_accounts`
- [ ] Post executor: reads `scheduled_posts`, calls Ayrshare with media URLs
- [ ] Inngest job to fire posts at scheduled time
- [ ] Status updates: scheduled / posted / failed (with retry)

---

## Stream 2 — Media engine (Phase E, independent)

**Worktree:** `/Users/douglaswoolfenden/Documents/dwcw-media-gen`
**Branch:** `feature/media-gen`

**Kick-off prompt (paste into terminal 2):**

```
Resume Sound Cave SaaS build, Stream 2 (Media engine).

Read:
1. wiki/decisions/0003_saas_architecture.md (especially the Video tiers section)
2. wiki/decisions/0004_parallel_execution.md (this file)
3. Current image_gen.py and content_api.py

You are on Stream 2, worktree dwcw-media-gen, branch feature/media-gen.
Pure Python work — no DB, no auth. Find the next unchecked item in the
Stream 2 checklist. When done: check the box, append wiki/log.md, commit.

Final step is a PR back into main — do NOT merge yourself; report ready
for review.

Ask Doug before any action that needs an API key he hasn't provided.
```

**Stream 2 checklist (Resume here):**
- [ ] Rename `image_gen.py` → `media_gen.py`; preserve image gen behaviour
- [ ] Add `MediaType` enum: `image`, `video_composite`, `video_standard`, `video_premium`
- [ ] Tier 1 — `generate_video_composite()` using FFmpeg: image + audio waveform + Ken Burns
  - [ ] Add ffmpeg to Railway buildpack notes
  - [ ] Detect waveform from any uploaded audio file
- [ ] Tier 2 — `generate_video_standard()` via Fal AI (LTX or Hunyuan)
- [ ] Tier 3 — `generate_video_premium()` via Fal (Kling) with Replicate (Veo) fallback
- [ ] Update `content_api.py` `/api/generate-image` → `/api/generate-media` with `type` param
- [ ] Update health check to report video provider status
- [ ] Test each tier locally with sample inputs
- [ ] Open PR to main: "feat(firepit): video generation tiers 1-3"

---

## Stream 3 — Trail Map calendar UI (Phase F, independent)

**Worktree:** `/Users/douglaswoolfenden/Documents/dwcw-trail-map`
**Branch:** `feature/trail-map-ui`

**Kick-off prompt (paste into terminal 3):**

```
Resume Sound Cave SaaS build, Stream 3 (Trail Map calendar UI).

Read:
1. wiki/decisions/0003_saas_architecture.md
2. wiki/decisions/0004_parallel_execution.md (this file)
3. wiki/features/firepit_trail_map.md
4. wiki/features/firepit_stash.md
5. Current js/firepit.js for Stash patterns

You are on Stream 3, worktree dwcw-trail-map, branch feature/trail-map-ui.
Pure frontend work — use mock data for stash items and scheduled posts.
DO NOT wire to a real backend; the backbone stream will wire it later.

IMPORTANT: This is a UI build. Per CLAUDE.md UI Change Protocol, before
writing any visual code, ask Doug the 5 framing questions and save answers
to wiki/spec/firepit_trail_map_ui.md. Get sign-off before coding.

Final step is a PR back into main — do NOT merge yourself; report ready
for review.
```

**Stream 3 checklist (Resume here):**
- [x] Run UI Change Protocol with Doug; save answers to `wiki/spec/firepit_trail_map_ui.md`
- [x] Confirm `tokens.css` exists (create if not) — vars live in `css/style.css :root`, reused not duplicated
- [x] Build month view (grid of days, current month + nav)
- [x] Build week view (7-day strip)
- [x] View toggle (month / week)
- [x] Stash sidebar (list with thumbnails) — reads live `getContentLibrary()` (not mocks)
- [x] Drag stash item onto a date cell
- [x] Per-platform slot picker on a scheduled item (IG / TikTok / X / LinkedIn)
- [x] Status pill on scheduled items: scheduled / posted / failed
- [x] Edit / delete scheduled item
- [x] Mobile responsive
- [x] Define mock-data shape that backbone stream will fulfil (`wiki/features/firepit_trail_map.md` + `wiki/spec/firepit_trail_map_ui.md`)
- [x] Open PR to main: "feat(firepit): Trail Map calendar UI" — landed direct on main as part of commit `ca30c31` (post repo-extraction); no separate PR opened. Stream 3 closed 2026-04-29.

---

## Stream 4 — Dashboard work (no terminal needed, Doug-led)

While agents code, Doug handles in browser:
- [ ] Sign up Fal AI, get `FAL_KEY`, paste to `.env`
- [ ] Sign up Replicate, get `REPLICATE_API_TOKEN`, paste to `.env`
- [ ] Sign up Supabase, create project (Stream 1 needs URL + keys)
- [ ] Sign up Stripe (test mode), grab keys
- [ ] Sign up Inngest, grab keys
- [ ] Sign up Ayrshare dev tier
- [ ] Confirm `ANTHROPIC_API_KEY` is in `.env`
- [ ] Set up GitHub remote on workspace repo and push

---

## How to resume from any new terminal

1. `cd` into the right worktree (see the table at the top)
2. Open Claude Code in that directory
3. Paste the matching kick-off prompt
4. The agent reads this file, finds the first unchecked box, executes

That's it. State lives in the checkboxes here. Update them on every commit.

---

## Coordination rules

- Streams 2 and 3 must NOT touch `content_api.py` or `js/firepit.js` until merged in. They use mocks/forks.
- After streams 2 or 3 PR into main, Stream 1 picks up the wiring as part of its current phase.
- Stream 1 owns `wiki/log.md`; streams 2 and 3 append their own entries with `[stream-2]` / `[stream-3]` prefixes to avoid conflicts.
- Conflict on `MEMORY.md`-style index files: last-merged wins, no big deal.
