# Feature: Firepit — Trail Map

> Status: **NOT YET BUILT.** Phase 2 priority.

## What it does
Content calendar. Schedule Stash items for publication across platforms (Instagram, TikTok, X, etc.) on specific dates/times. Visual month/week views.

## Why it exists
Bulk content creation without a schedule is just a pile. Trail Map turns Forge output into a publishing plan — and is the **distribution** half of the product's elevator pitch (scout + create + distribute).

## Acceptance criteria
- [ ] Calendar UI (month + week views)
- [ ] Drag Stash items onto dates
- [ ] Per-platform scheduling (IG, TikTok, X, etc.)
- [ ] Platform API integrations for actual publishing
- [ ] Status: scheduled / posted / failed

## Dependencies
- `wiki/features/firepit_stash.md` — input
- Social platform API integrations (Phase 3 — none connected yet)
- Backend job runner for scheduled posts

## Open questions
- Which platforms first? IG + TikTok make sense for music.
- Self-host the scheduler or use a service (Buffer/Postiz API)?

## Related
- `wiki/features/firepit_forge.md`, `wiki/features/firepit_stash.md`
