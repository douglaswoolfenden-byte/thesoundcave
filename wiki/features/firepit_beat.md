# Feature: Firepit — Beat (rights-gated audio on posts)

> Status: **Spec — approved 2026-06-09, build not started.** Caveman name: a **Beat** = the audio clip a post carries. ("Add a Beat", "this post has a Beat.")
>
> Rides on the already-built video pipeline (`firepit_video.md`) — Beat is the **rights gate** + **clip picker** + Forge wiring, not new media plumbing.

## What it does
Lets a promoter attach music to a post. Because a scheduled/API post cannot use native platform music (see Hard constraints), the audio is **baked into a composite video** (AI cover image + Ken Burns + waveform + the audio) via the existing `/api/generate-media` Tier-1 pipeline, then flows through Stash → Trail Map → Ayrshare like any video.

The net-new part is a **rights gate**: every audio upload is classified into a rights category and must carry proof before it can be scheduled. This is what stops a campaign being muted/removed/struck weeks or months later.

## Why it exists
In music, a post without sound underperforms — the track *is* the product. But naive audio attachment is a time bomb: TikTok and Meta fingerprint the audio inside every uploaded video and enforce **retroactively**. A campaign that looks fine today dies in three months when the fingerprint matches unlicensed music. Beat makes attaching audio easy *and* makes it durable by enforcing the platforms' own rules at the point of scheduling.

## Hard constraints (these shape the whole design)
1. **No native music via a scheduler.** TikTok's Commercial Music Library and Meta's Sound Collection are only reachable inside the apps. Via Ayrshare/API the only knobs are TikTok `autoAddMusic` (vague) and Instagram `audioName` (a label only — audio still must be in the file). **So audio must be embedded in the uploaded MP4** — which means it gets fingerprinted.
2. **Fingerprinting can't tell ownership from theft.** It only matches a recording. Durability comes entirely from using rights-cleared audio and keeping proof on file to win a dispute / DMCA counter-notice.
3. **Snippet length is irrelevant.** US Copyright Office: there is no safe duration; a few seconds still infringes and is still fingerprinted. Promotional use is almost never fair use.

## The rights gate (the legal core → product logic)
At upload the promoter classifies the audio into exactly one category. The category sets whether it's postable and what proof must be on file. **Categories E–G are hard-blocked from scheduling** (Doug, 2026-06-09) — they may sit in the library flagged un-postable, but cannot go out. A blocked post can't die later.

| Category | TikTok | Meta | Proof required to survive takedown/DMCA |
|---|---|---|---|
| **A. Uploader owns the master** (own production) | ✅ | ✅ | Creation metadata / project files / signed authorship |
| **B. Lineup artist's own master + written permission** | ✅ | ✅ | Written permission (email ok) from a verifiable artist + identity link |
| **C. Royalty-free library w/ commercial social licence** (Epidemic, Artlist, Soundstripe) | ✅* | ✅ | Licence receipt + text naming "commercial social media / all platforms"; active at upload |
| **D. CC0 / public domain** | ✅ | ✅ | CC0 deed link / public-domain registry / pre-1928 |
| **E. Commercially-released / major-label recording** | ❌ | ❌ | Undefendable — block |
| **F. Trending app sound / ripped from streaming** | ❌ | ❌ | Undefendable — block |
| **G. Third-party track, no documented permission** | ❌ | ❌ | Undefendable — block |

\*Category C on TikTok is conditional on the licence explicitly naming commercial social use — surface this, don't assume it.

**"On my lineup" ≠ permission.** Category B always needs the written grant recorded against the artist Profile.

## Clip model (the "Beat")
- Audio is uploaded once into `audio_tracks` (private bucket, signed URLs) and reused across many posts — "one track → 30 reels" (`firepit_video.md`).
- A Beat is a **clip window** on that track: `stash_items.start_seconds` / `end_seconds`, capped at `MAX_VIDEO_DURATION_SECONDS = 10`. Slicing is stream-copy (bit-perfect; audio never re-encoded).
- The clip-picker is the **manual** version of the OpusClips-style auto-clipping flagged as Phase H in `firepit_video.md` — beat/drop auto-detection stays out of scope for v1.

## How it threads the pipeline
Forge (pick image + upload/select Beat + classify rights + set clip) → `POST /api/generate-media` (Tier-1 composite) → Stash item `media_type='video_composite'` with `audio_track_id` + clip bounds → Trail Map (drag to schedule) → **scheduling gate re-checks rights** → Ayrshare publishes the MP4.

## Acceptance criteria
- [ ] Upload audio in Forge, classify into A–G with the matching proof field/upload
- [ ] A–D with proof on file → audio is "postable"; E–G or missing proof → can't be scheduled (hard-block at `scheduled_posts` create), with a clear inline reason
- [ ] Set a clip window (start/end), capped at 10s; composite MP4 generated with the Beat baked in
- [ ] Beat-bearing post schedules + publishes via Ayrshare to IG/FB/TikTok (test profile)
- [ ] `events.hero_track_url` pre-fills the Beat picker for that Gathering
- [ ] Trail Map shows an audio badge on Beat-bearing posts; shows the block reason when held back

## Files (planned)
- `db/0018_audio_rights.sql` — extend `audio_tracks`: `rights_category`, `rights_proof_url`, `rights_attested_at`, `rights_attested_by`, `source_artist_profile_id`, `license_notes`
- `content_api.py` — require category+proof on the `/api/generate-media` audio upload path; add rights re-check in the `scheduled_posts` create path (~1426)
- `media_gen.py` — `upload_audio_track(...)` carries the new rights fields (no change to generation)
- `js/firepit.js` — "Add a Beat" control: upload + classify + clip; reuse `saveToStash` (~788–833) and the ref-image upload pattern (~635–701)
- `js/trail_map.js` — audio badge + block-reason surfacing

## Dependencies
- `wiki/features/firepit_video.md` — the composite/standard/premium generation engine Beat rides on
- `wiki/features/firepit_stash.md` — `audio_track_id` + clip columns live on `stash_items`
- `wiki/features/firepit_trail_map.md` — scheduling surface where the rights gate fires
- `wiki/features/events.md` — `hero_track_url`; Category B permission attaches to lineup Profiles
- Ayrshare publishing (Trail Map Stream 1 Phase G) — for the real publish leg

## Out of scope (v1)
- Royalty-free library integration at scale (Category C self-serve, e.g. Epidemic/Artlist API) — future phase
- OpusClips-style beat/drop auto-clipping — Phase H (`firepit_video.md`)
- SoundCloud-sourced audio files — SoundCloud's API returns metadata only, no stream/download URL, so the artist/promoter must upload the file (which is also the natural consent moment)

## Sources (platform rules + law behind the gate)
**TikTok:** [Music Terms (US)](https://www.tiktok.com/legal/page/global/music-terms-us/en) · [Commercial Music Library Terms](https://www.tiktok.com/legal/page/global/commercial-music-library-user-terms/en) · [Commercial use of music (help)](https://support.tiktok.com/en/business-and-creator/creator-and-business-accounts/commercial-use-of-music-on-tiktok) · [Copyright Policy](https://www.tiktok.com/legal/page/global/copyright-policy/en)
**Meta:** [Sound Collection / business music](https://www.facebook.com/business/help/402084904469945) · [Copyright Policy](https://www.meta.com/help/policies/2202628709913826/) · [Rights Manager](https://www.facebook.com/business/help/368793540292492)
**Law / fair use:** [US Copyright Office §512 (DMCA)](https://www.copyright.gov/512/) · [Copyright Alliance — DMCA counter-notice](https://copyrightalliance.org/education/copyright-law-explained/the-dmca/dmca-counter-notice-process/) · [Google/YouTube fair-use guidance](https://support.google.com/youtube/answer/9783148?hl=en)
**Enforcement reality (case law):** Sony Music v. DSW (Aug 2025, 170+ unlicensed promo clips) · Marriott/Sony (2024, 900+ influencer campaigns, $139M claim) — see [Music Business Worldwide](https://www.musicbusinessworldwide.com/sony-music-sues-retail-giant-dsw-over-massive-infringement-of-recordings-in-social-media-ads/)

## Related
- `wiki/features/firepit_forge.md`, `wiki/features/firepit_video.md`, `wiki/features/firepit_trail_map.md`
