# Roadmap — the Ages (macro map)

> The **era-level** view. [decision 0013](decisions/0013_version_ages.md) = the versioning rule; [decision 0014](decisions/0014_age1_milestones_reframed.md) = the Age 1 milestones below. [gtm.md](gtm.md) details Age 2. Version scheme: `Age.Milestone.Iteration` → git tag `vA.M.I`.

## 📍 WHERE WE ARE
**`v1.2.2` · Age 1 (The Studio) · Milestone `1.2` (Forge formats).** The studio is live in private beta (Railway + Vercel): the **Cave** (`1.0`) and the **Firepit** (`1.1`) are built. We're now completing the **Forge's format set** (`1.2`) — Flyer ✅ · Animation ✅ · Still ⏳ · Carousel ⏳ — while hardening every page (that's the iteration digit ticking up). The current number lives in the root [`VERSION`](../VERSION) file.

## How to read a version
`Age.Milestone.Iteration` — e.g. `1.2.2` = Age 1, Milestone 2 (Forge formats), Iteration 2.
- **Age** = the strategic era. Bumps only at a **graduation gate** (rare).
- **Milestone** = a real segment/tool of the studio (see the table). Bumps as you move from one to the next.
- **Iteration** = each "make it work" release within a milestone — polish, a fix, or a finished format.

Walk it: Cave built `1.0` → Firepit built `1.1` → finishing the formats `1.2.x` → studio solid + all formats shipped, the gate clears and the Market era opens `2.0.0`.

## Age 1 — The Studio (now)
Build the studio broad, then make every part work. The milestones are the **real segments + tools** — how it was actually built — not an abstract ladder. Detail + rationale: [decision 0014](decisions/0014_age1_milestones_reframed.md).

| Version | Milestone | What's in it | Status |
|---|---|---|---|
| `1.0` | **The Cave** | Mural · Foraging · Clan · Footprints | ✅ built (Foraging search being smoothed) |
| `1.1` | **The Firepit** | Forge · Gatherings · Stash · Trail Map · Marks | ✅ built (Trail Map calendar parked) |
| `1.2` | **Forge formats** | Flyer ✅ · Animation ✅ · Still ⏳ · Carousel ⏳ | ← now — the only new builds left |

The iteration digit (`1.2.x`) is the **"make it all work"** pass — hardening every page, no new features beyond Still + Carousel.

> **🚪 Gate → Age 2 (The Market):** all four Forge formats shipped **+ the whole studio works solidly** (Cave + Firepit hardened) **+ ready to put in front of users.**

> _Etchings — the old curated style gallery that used to sit at `1.2` — is **retired**. See [decision 0014](decisions/0014_age1_milestones_reframed.md)._

## Age 2 — The Market
Go-to-market + monetize; first 100 → first 1000 users. Detail: [gtm.md](gtm.md).

| Version | Milestone | Status |
|---|---|---|
| `2.0` | Design partners (invite-gated beta) | in motion now |
| `2.1` | First 100 (hand-to-hand, billing live) | |
| `2.2` | First 1000 (repeatable channels + referral loop) | |

> **🚪 Gate → Age 3:** ~1000 active users · proven retention · proven free→paid conversion.

## Age 3 — The Platform
Multi-genre scale, un-park discovery, the discovery→studio round-trip, and the "learn from users" data flywheel — all currently *parked* per [decision 0008](decisions/0008_campaign_studio_first.md). Milestones get defined once the Age 2 gate is in sight.

## Tagging convention
- Bump root [`VERSION`](../VERSION) + add an annotated tag **in the same change**: `git tag -a v1.2.2 -m "Forge formats — see wiki/log.md 2026-..."`.
- Tag message points at the [log](log.md) entry (the changelog). Push tags: `git push origin v1.2.2`.
- `v1.0.0` = the first beta baseline tag (`main` @ `ea343bc`, 2026-06-27).
