# Go-to-market — first 100 → first 1000 (the Second Age)

> Status: **plan, not yet executing** (updated 2026-06-27). The content of the **Second Age** ([roadmap](roadmap.md), [decision 0013](decisions/0013_version_ages.md)). It opens only when the First-Age studio gate is cleared. Grounded in what's already built: the invite-gate ([decision 0012](decisions/0012_invite_gate_launch_safety.md)), Starter/Pro plans ([decision 0003](decisions/0003_saas_architecture.md)), and the three [personas](personas/).

## The one-line strategy
**Land hand-to-hand in one scene, then make it repeatable.** Don't run broad paid acquisition for a product whose moat is niche-correct taste ([decision 0008](decisions/0008_campaign_studio_first.md)). Win tech-house promoters one real flyer at a time, turn them into proof + referrers, then systematise the channels that actually converted.

## Who we're selling to (first)
Tech-house **promoters first** (sharpest pain — a flyer for every night), then small **labels** and **DIY artists**. All three share the trait that matters: **no design team, everything outsourced.** Tech-house only until the studio's genre pack is proven; other scenes are a Third-Age clone.

## The north-star metric
**Assets actually posted to real channels** — not assets generated. A generated flyer that never gets posted is a failed unit. Everything below optimises for *posted, scene-credible* output, because that's also the organic-reach engine (every posted asset is a billboard in front of the next promoter).

---

## Phase A — Design partners (0 → ~20)  ·  version `2.0`
*Already in motion: the invite-gated beta to Doug's industry friends.*

- **Goal:** prove "a tech-house promoter would post this without embarrassment" with **real strangers**, not just Doug.
- **Tactics:** hand-deliver invite codes; sit with 3–5 partners while they make a real asset for a real upcoming night; record where they stall.
- **Harvest:** testimonials, screenshots of their posts in the wild, authentic reference flyers for the Etchings library, and the raw material to replace the [persona stubs](personas/) with real interviews.
- **Done when:** ≥5 partners have generated *and posted* an asset, and ≥3 say they'd be annoyed if it went away.

## Phase B — First 100 (hand-to-hand)  ·  version `2.1`
*Billing lights up here (Starter/Pro un-greyed — see Monetization below).*

- **Goal:** 100 signups, with a real activation rate, sourced by direct outreach — not ads.
- **The hook — "done-for-you first flyer":** find a target promoter's *actual* next event, generate a scene-correct flyer for it unprompted, send it in the DM. The product *is* the pitch. Invite code attached.
- **Channels (scene-native, in priority order):**
  1. **IG + SoundCloud DMs** to tech-house promoters/labels (where they already live).
  2. **Scene Discord / Telegram** servers and label group chats — warm, high-trust, referral-dense.
  3. **In person** at nights/clubs — Doug's home turf; the highest-conversion channel for a taste product.
  4. **Referrals from Phase-A partners** — "who else needs this?" baked into every partner call.
- **Invite codes as curation + scarcity:** the gate ([decision 0012](decisions/0012_invite_gate_launch_safety.md)) is a feature here — codes feel like access, not friction, and they cap fal spend.
- **Done when:** 100 signups, ≥40% activated (made ≥1 keeper), ≥1 unsolicited inbound ("a mate sent me this").

## Phase C — First 1000 (repeatable channels)  ·  version `2.2`
*Stop hand-delivering; turn the channels that worked in Phase B into a loop.*

- **Goal:** 1000 signups through channels that run without Doug in every DM.
- **Engines:**
  - **Founder-led build-in-public** on the scene's own platforms — show the output, the before/after, the gap-closing. Doug is credible *because* he's in the scene.
  - **The Etchings gallery as a public portfolio** — the style library doubles as the top-of-funnel ("look what it makes") and as SEO/social bait.
  - **A referral loop** — invite codes already exist; give each active user shareable codes so word-of-mouth (Phase B's best channel) becomes a built-in mechanic, not a manual ask.
  - **Partnerships** — promoter collectives, small labels, ticketing/listing communities; one deal puts the studio in front of a whole roster.
- **Done when:** 1000 signups, retention + free→paid conversion holding (the Third-Age gate).

---

## Funnel & target metrics *(hypotheses to validate, not commitments)*
| Stage | Metric | Starting target |
|---|---|---|
| Acquisition | signups | 20 → 100 → 1000 |
| **Activation** | % who make ≥1 *posted* keeper | ≥40% |
| **North star** | assets posted to real channels | grows every phase |
| Retention | users running a 2nd+ campaign | ≥30% monthly |
| Revenue | free-trial → paid (Starter/Pro) | ≥5–10% once billing on |

Instrument generation logging from day one ([decision 0008](decisions/0008_campaign_studio_first.md) already calls for this) so these are measured, not guessed.

## Monetization tie-in
- **Now:** invite-gated **free trial** (built — [decision 0012](decisions/0012_invite_gate_launch_safety.md)). New accounts = 0 credits until a code is redeemed.
- **Phase B on:** un-grey **Starter £79 / Pro £199** (current beta plan presentation). **Blocker:** Stripe price metadata is stale (grants old 500/2000/6000) — re-run `scripts/stripe_bootstrap.py` before turning paid on ([decision 0012](decisions/0012_invite_gate_launch_safety.md)).
- Keep credit costs honest — the `COST_ESTIMATES` / animation-credit re-pricing flagged in [decision 0010](decisions/0010_media_gen_cogs_verified.md) should be settled before paid launch so margins are real.

## Growth assets to build (small backlog)
- Shareable referral codes surfaced in-app (extends the existing invite mechanic).
- A public Etchings gallery page (portfolio = top-of-funnel).
- A one-tap "share this asset" with — *decide explicitly* — an optional, tasteful attribution.

## Risks / explicit decisions
- **"Made in Sound Cave" watermark = authenticity risk.** Free virality vs. looking un-scene. For a taste/credibility brand, default-on attribution can repel the exact promoter we want. **Decide deliberately; don't default to it.**
- **One-scene discipline.** The temptation to widen genres early is the old breadth failure mode ([decision 0008](decisions/0008_campaign_studio_first.md)). Hold tech-house until the gate.
- **Don't open paid acquisition** before activation is proven — paying to pour strangers into a leaky funnel burns cash and signal.
