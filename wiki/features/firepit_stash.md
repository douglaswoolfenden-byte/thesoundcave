# Feature: Firepit — Stash

> Status: **Built (basic).** localStorage-backed library.

## What it does
Library of all content generated in Forge. User can browse, re-open, copy, and (future) push to Trail Map for scheduling.

## Why it exists
Generation without persistence is throwaway. Stash is the bridge between "I made something" and "I'm going to publish it" — the input to Trail Map and to multi-platform distribution.

## Acceptance criteria
- [x] Saves Forge output to library
- [x] Browse / re-open
- [ ] Filter by artist / type / date
- [ ] Push to Trail Map for scheduling
- [ ] Migrate from `localStorage` to server-side storage (SaaS prerequisite)

## Dependencies
- `js/firepit.js`
- `localStorage` (current); future: backend storage for multi-tenant

## Related
- `wiki/features/firepit_forge.md` — produces the content
- `wiki/features/firepit_trail_map.md` — consumes Stash items for scheduling
