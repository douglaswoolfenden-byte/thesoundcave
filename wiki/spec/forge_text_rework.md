# Spec: Forge text rework — sharper prompts + 3 variants + manual edit/enhance

> Status: **DRAFT, 2026-05-12.** Phase A of a two-phase rework. Phase B (inline brand templates) is a separate spec.

## 1. Why

Doug ran the Forge for a Sound Cave event-promo and called the result "pathetic." Two stacked problems:

1. **Quality.** The current `SYSTEM_PROMPT` and per-content-type `TEMPLATES` in `content_api.py` describe the writer competently but generically. They don't *demand* concrete imagery, named textures, specific verbs. So Claude defaults to plausible-but-bland scene-writer prose.
2. **No choice.** Today the textarea shows one caption. To explore alternatives the user has to re-roll (REGENERATE) or click SHORTER / LONGER / CHANGE TONE — each a discrete reload, each one shot.

This phase fixes both. Phase B (templates) is separate.

## 2. Prompt direction (rewrite of `SYSTEM_PROMPT` + per-type instructions)

The rewritten system prompt demands:

- **Concrete sensory imagery.** Names of places, sounds (e.g. "508-line Romplers", "snare crack at 134bpm"), surfaces (concrete, perspex, fog), times of night.
- **Verbs over adjectives.** "Strobes claw the ceiling" beats "atmospheric strobes."
- **No marketing-speak filler.** Banned openers: "Join us…", "Get ready for…", "Don't miss…", "We're so excited…". Banned phrases: "absolute fire", "unmissable", "must-attend", "vibes", "energy" (as a standalone noun).
- **No hashtag spam.** 2-3 specific, scene-literate hashtags, not 7 generic ones. Reddit gets zero.
- **No influencer cringe.** No 🔥🔥🔥, no "the way I…", no "tell me you're…", no rhetorical "if you know, you know."
- **British English.** Realise/colour/grey/practise. No US idioms.
- **Mine the inputs.** If reference images are attached, name what's in them. If Additional Context names artists or specifics, use them by name, don't paraphrase generically.

Per-content-type instructions are sharpened (see `content_api.py:TEMPLATES`). Headlines:

- `social_post`: "scroll-stopping" replaced with "a sentence that earns the second sentence." Demands a specific concrete image in the first 10 words.
- `event_promo`: explicitly demands the venue and date if given, plus *one specific sensory detail* about the night (the kit, the BPM range, the room temperature). Bans every cliché opener.
- `lineup_poster`: very short copy. Headline + lineup + date/venue + one POSTER: direction line.
- `social_carousel`: each slide must do *one* job. No filler slides.
- `social_short`: ON-SCREEN beats must be readable in <1s each.
- `artist_bio` / `press_release`: long-form, single-shot (no variants — see § 4).

## 3. Three-angle output contract

When `/api/generate` is called with `n_variants: 3`, Claude returns **strict JSON** (no markdown, no preamble):

```json
{
  "variants": [
    {"angle": "PUNCHY",       "text": "...", "image_direction": "..."},
    {"angle": "ATMOSPHERIC",  "text": "...", "image_direction": "..."},
    {"angle": "PERSONAL",     "text": "...", "image_direction": "..."}
  ]
}
```

Default angles per content type:

| Content type | Angle 1 | Angle 2 | Angle 3 |
|---|---|---|---|
| `social_post`     | PUNCHY (one-liner, sharp)       | ATMOSPHERIC (mood, sensory)     | PERSONAL (first-person, intimate) |
| `social_carousel` | NARRATIVE (slide-by-slide arc)  | LISTICLE (numbered takeaways)   | NAMECHECK (artists/tracks foregrounded) |
| `social_short`    | HOOK (cold open, no setup)      | TEASE (cryptic, withhold info)  | COUNTDOWN (days/hours remaining) |
| `event_promo`     | SCENE-SETTER (paint the room)   | NAMECHECK (DJ-led)              | DARE (provocation / challenge) |
| `lineup_poster`   | SET-TIMES (functional)          | THEME (concept-led)             | NAMECHECK (headliner-first) |

`image_direction` is one line, **never read by diffusion directly** (we don't pass raw text through). It seeds the image-generation step that fires AFTER the user picks a variant.

For `artist_bio` and `press_release`, `n_variants` is ignored — these are long-form and Claude returns a single block (the existing shape: `{content, content_type, tokens_used, model, credits_balance}`). Saves tokens, avoids three near-identical 600-word press releases.

**Fallback.** If Claude returns malformed JSON for a variant request, the server logs and degrades to single-block output. Frontend treats `variants` absence as "single-block mode" and renders the textarea directly.

## 4. Forge flow change

**Before (today):**

```
Generate Content → text generates → image gen auto-fires →
both visible → user edits text → SAVE TO STASH
```

**After (Phase A):**

```
Generate Content → 3 variant cards →
user picks one → text loads into textarea → image gen fires (with chosen text in image prompt) →
user can edit / ENHANCE / SHORTER / LONGER / CHANGE TONE → SAVE TO STASH
```

Behaviour notes:

- Variant cards are stacked vertically in the existing output column. Each shows angle label + truncated preview (~140 chars).
- Picking a variant: card highlights, full text loads into `#forgeOutputText`. Other cards stay visible but un-highlighted — you can switch.
- Switching variant mid-edit shows a "discard your edits?" confirm before clobbering.
- For text-only content types, the variant picker is skipped; the textarea renders directly.
- Image gen fires once on pick. Switching variant doesn't re-fire image gen automatically (avoid burning credits). REGENERATE on the image side is still there.

## 5. ENHANCE button

New action in the existing `#forgeActions` row, alongside SHORTER / LONGER / CHANGE TONE.

- Reads current textarea content + form context (artist / event / freeform / voice).
- Calls `POST /api/enhance` with `{text, ...context}`.
- Returns one refined version. Replaces the textarea content.
- Charges 1 text credit (same as a variation).
- Prompt: "Refine this draft. Keep the message, the voice, the references. Sharpen verbs, drop filler, name one more specific thing if you can. Don't add hashtags that weren't there."

## 6. Out of scope (deferred or rejected)

**Deferred to Phase B (separate spec):**
- Inline "Save as template for [brand]" button
- Template dropdown that loads brand-bound saved drafts
- `templates jsonb` column on `brand_kits`

**Out entirely for now:**
- Image quality improvements (separate concern; Doug hasn't complained about images this session)
- Per-slide variants for carousel
- Streaming variant output (all three arrive together)
- "Regenerate just this one variant" button
- Non-English voice

## 7. Schema / data changes

**None.** This phase only changes prompt strings and adds one new endpoint. No DB migrations.

## 8. API surface

- `POST /api/generate` — **changed**. Now accepts `n_variants: 3` (optional). When set and the content type supports it, returns `{variants: [...], content_type, tokens_used, model, credits_balance}`. Without it, returns the existing single-block shape.
- `POST /api/enhance` — **new**. Body: `{text, content_type, voice, freeform, artist_data?, event?, release?, reference_images?}`. Returns `{content, tokens_used, model, credits_balance}`. JWT-authed via `_resolve_user_id()` like the rest.

## 9. Verification

1. **Backend smoke:** call `/api/generate` with `{content_type: 'event_promo', n_variants: 3, event: 'Test Night, Folk Hall, 11pm', voice: 'underground'}` → response contains 3 variants with distinct angle labels.
2. **Fallback:** force Claude to break JSON (e.g. set a flag), confirm server returns `{content: ...}` single-block. Frontend renders textarea directly.
3. **Frontend:** open Firepit → S0UNDCAV3 brand → Event Promo → fill Event + Additional Context → Generate → see 3 variant cards. Pick one → loads into textarea → image generates → compositor view appears.
4. **Quality eyeball:** Doug reads three variants for an event_promo. Confirms they're distinct and not bland. If still bad → second prompt revision before declaring Phase A done.
5. **ENHANCE round-trip:** edit textarea → click ENHANCE → refined version returns → replaces content.
6. **Regression sweep:** `artist_bio` + `press_release` still return single block; SHORTER / LONGER / CHANGE TONE still work on the current draft; SAVE TO STASH still picks up textarea content; compositor still composites.

## Related

- `wiki/features/firepit_forge.md` (update after ship)
- `wiki/spec/brand_overlay_compositor.md` (Phase 3 shipped; this is independent)
- `wiki/spec/forge_input_redesign.md` (the earlier voice + ref-images change)
