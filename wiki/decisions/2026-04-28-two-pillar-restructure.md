# Decision: Two-pillar restructure (Cave + Firepit)

**Date:** 2026-04-28
**Status:** Accepted

## Context
Original UI exposed six top-level tabs: Home, The Cave (dashboard), Foraging, Clan, Footprints, Firepit. Discovery and creation features sat at the same hierarchy level, hiding the product's real shape.

## Decision
Restructure to two pillars under one roof:

- **The Cave** = artist scouting and tracking. Contains sub-sections: Dashboard, Foraging, Clan, Footprints.
- **Firepit** = media creation and scheduling. Standalone.

Top-level navigation reduces to three tabs: Home, The Cave, Firepit.

## Rationale
- Matches the mental model of the product: "find artists" vs "make content."
- Firepit is being expanded into a Metricool-style creation + scheduling platform — it deserves its own pillar, not to be buried alongside artist tools.
- Reduces top-nav noise from 6 → 3 entries.

## Implementation
- `index.html` header reduced to 3 tabs.
- Cave sub-nav rendered above cave-section panels (Dashboard / Foraging / Clan / Footprints).
- `app.js` `switchTab` extended to handle the cave group: clicking "The Cave" defaults to Dashboard; sub-nav switches between the four cave panels.
- Tab containers (`tab-cave`, `tab-foraging`, `tab-clan`, `tab-footprints`) kept as-is to avoid touching feature code.
