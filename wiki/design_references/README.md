# Design References — Sound Cave

A library of websites, products, and visual systems we're using as **mood + technique references** for Sound Cave UI work.

## How to use this folder

**When starting any UI/visual work** (new feature, redesign, landing page), read this index first and pull the relevant reference(s) into the spec page (`wiki/spec/<feature>.md`). The `ui-change-protocol` Q1 ("got 1-3 references?") is answered from here, not from scratch each time.

**Don't copy wholesale.** Each reference page calls out *which ingredients to lift* and *which to skip* for Sound Cave specifically. Sound Cave is a product, not a one-page studio site.

## How to save a new reference

Just say to Claude: *"save [URL] as a Sound Cave design reference"*.

Claude will:
1. Fetch the page (and/or take screenshots — Doug can drop a screen recording, Claude extracts keyframes)
2. Create `<name>.md` using the template structure below
3. Save assets to `<name>_assets/`
4. Add a one-liner to this index
5. Append to `wiki/log.md`

## Template structure (each reference page)

Every entry should answer:

1. **Source + captured date** — URL, why-saved-now context (e.g. "FWA of the Day winner")
2. **Why this is a reference** — which Sound Cave audience/mood it maps to
3. **The aesthetic in one line** — forces a tight summary
4. **Visual ingredients** — table: element / what it is / where seen (with frame refs)
5. **Color palette** — concrete hex values
6. **Typography** — font stack, sizes, treatment
7. **Replication tiers** — Easy / Medium / Hard / Skip — what's actually buildable
8. **How to apply to Sound Cave** — which surfaces it fits (marketing vs app vs dashboard)
9. **Open questions for Doug** — decisions to lock next time we touch this

See [`kvs_studio.md`](./kvs_studio.md) for the canonical example.

## The library

| Reference | Source | Captured | One-line hook |
|---|---|---|---|
| [KVS Studio](./kvs_studio.md) | [kvs.services](https://www.kvs.services/) | 2026-04-29 | CRT monitor + VHS tape + occult sigil, rendered in monospace. Black + white + single orange accent. The bar for "premium, weird, unmistakably *for music people*." |

<!-- Add new entries above this line, newest first -->

## Related

- **`tokens.css`** lives in the project root — colors/fonts/motion locked there before component work
- **`wiki/spec/<feature>.md`** — per-feature spec pages reference entries from this library
- **UI Change Protocol** — workspace-level skill that requires references before any visual code
