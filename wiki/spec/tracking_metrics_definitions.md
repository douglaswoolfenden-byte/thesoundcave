# Tracking Metrics — definitions & calculation contract

**Status:** Authoritative (Doug-requested, 2026-06-12). This is the single source of truth for *what each tracked number means and how it's computed*. Code in `tracking_collector.py` MUST match this page; if they ever disagree, this page wins and the code is the bug.

**Why this exists:** repeated "the data is wrong" pushback turned out to be the snapshot-vs-live distinction (see below), not calculation errors. This page ends the re-litigation: it defines each metric precisely, states the capture model, and gives the manual check anyone can run against a public SoundCloud page.

## The capture model (read this first)

- **A snapshot is a once-daily, point-in-time record** taken by the Railway scheduler at **~07:00 UTC** (plus an hourly catch-up if that run is missed). It is intentionally frozen — that's what lets us draw a trend line over time.
- **soundcloud.com shows the LIVE number**, updating continuously. So during the day the live page will read slightly higher than this morning's snapshot. **This is expected and is not an error.** Example verified 2026-06-12: 81zaki snapshot 830 followers / 26,395 plays at 07:00; live at ~17:00 was 831 / 26,411 — the artist gained 1 follower and 16 plays during the day.
- **Footprints headline = LIVE** (fetched on demand by stable id) so it matches soundcloud.com when you check. **The chart line = daily snapshots** (the history). They can differ by the day's growth — by design.
- **Identity is the numeric SoundCloud user id**, resolved once from the artist's profile URL. Never the display name (display-name resolve is the bug that put a different "SKH"/"Lucki" in early data).

## Metric definitions

| Metric | Definition | Source field | Notes |
|---|---|---|---|
| **Followers** | The follower count shown on the artist's profile homepage. | `GET /users/{id}` → `followers_count` | The single number top-right of their SoundCloud page. |
| **Following** | Accounts the artist follows. | `followings_count` | Captured, not charted by default. |
| **Track count** | Number of tracks the artist has **uploaded** (their own — includes their edits/remixes, which ARE their uploads). Reposts are NOT counted. | `track_count` | Reposts live under the Reposts tab and belong to other artists. |
| **Plays** | Sum of `playback_count` across **all of the artist's own uploaded tracks** (full catalogue, paginated). Excludes reposts. | Σ `playback_count` over `/users/{id}/tracks` | This is the catalogue total, not one track. Manual check: open the artist's Tracks tab, add up the play counts on every track they uploaded. |
| **Likes** | Sum of likes across their own tracks. | Σ (`likes_count` or `favoritings_count`) | Per-track likes, summed. NOT the "X LIKES" figure on their profile (that's tracks *they* liked). |
| **Reposts** | Sum of reposts across their own tracks. | Σ `reposts_count` | |
| **Comments** | Sum of comments across their own tracks. | Σ `comment_count` | Captured for future use. |
| **Playlist adds** | How many playlists the track/artist sits in. | — | **NOT exposed by the SoundCloud API.** Screenshot-lane only (Phase 3). Never invent it. |

## fetch_status — honesty flags (never store zeros for failures)

| Status | Meaning | Stored metrics |
|---|---|---|
| `ok` | Profile + full catalogue fetched cleanly. | Real values. |
| `partial` | Profile fetched but track pagination was truncated (a page failed after retries). Totals undercount. | Values present but flagged; **excluded from charts/gains** so they can't fake a jump. |
| `failed` | Profile fetch failed, OR catalogue fetch returned nothing for an artist who has tracks, OR a confirmed wrong-user row. | **NULL** — never 0. A gap, not a zero-dip. |

## Manual validation protocol (the bulletproof check)

To confirm a number, compare the snapshot to the **stable-id** live fetch (`/api/tracking/artist/<key>/live`) AND the public page, captured close in time:

1. **Followers** must match the profile-page number exactly (allowing for live drift since 07:00).
2. **Plays** must equal the hand-sum of `playback_count` across every track on the artist's Tracks tab (own uploads only). Verified exact 2026-06-11: Blam! = 437 + 370 = 807 = stored.
3. **Track count** must match the profile's Tracks figure exactly.
4. If a metric is wrong: check the registry `permalink` points at the right account (the wrong-user class of bug), not the calculation.

## Out of scope (don't confuse these)

- The "X LIKES" / "Following" blocks on a profile are about what the *user* follows/likes, not their tracks' performance. We track *track* performance.
- Spotlight/pinned tracks are a subset; plays = the WHOLE catalogue, not Spotlight.
