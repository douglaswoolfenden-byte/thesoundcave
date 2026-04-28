# Feature: Firepit — Forge

> Status: **Code complete, untested end-to-end.** Image gen layer added 2026-04-03 (commit `0374539`).

## What it does
AI content generator inside the Firepit tab. User toggles between Text mode and Image mode. Backend dispatches to Claude Haiku (text) or Fal AI / Replicate (image).

## Why it exists
Sound Cave's pivot is from pure discovery to content creation. Forge is the entry point for users to actually *produce* content about the artists they discover. Without Forge, the discovery engine has no payoff loop.

## Acceptance criteria
- [ ] User can generate text content from an artist context (artist name, genre, recent releases)
- [ ] User can toggle to image mode and generate cover/promo art
- [ ] Image gen falls back from Fal → Replicate on Fal failure
- [ ] Generated content can be saved to Stash
- [ ] Errors surface clearly in UI (API key missing, rate limit, timeout)

## Dependencies
- `ANTHROPIC_API_KEY` (text)
- `FAL_KEY` (image, primary)
- `REPLICATE_API_TOKEN` (image, fallback)
- `content_api.py` running on port 8000
- `image_gen.py` for image dispatch

## What's left
- **Blocker:** confirm all three API keys are in workspace `.env`
- End-to-end test: artist context → text gen → save to Stash
- End-to-end test: artist context → image gen → fallback path → save to Stash
- Error UI states
- Decide: do we want streaming text output, or wait-for-full-response?

## Related
- `wiki/decisions/image_gen_provider.md` _(TODO — write when picking primary vs fallback strategy)_
- `wiki/features/firepit_stash.md` _(TODO)_
- `wiki/features/firepit_trail_map.md` _(TODO — not yet built)_
