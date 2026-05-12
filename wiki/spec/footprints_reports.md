# Footprints — Report Builder (moved from Clan)

> Status: in-flight 2026-05-12. Doug-approved.

## Why
Report building belongs with growth tracking, not roster management. Clan is for managing the artists you track; Footprints is where you analyse their movement over time. Moving the CSV report builder to Footprints groups it with the data it summarises.

## Scope
- **Remove** from Clan tab: Report Builder button, export button, report notice, `reportMode` toggle, in-report card highlighting, `clanRowClick` selection logic.
- **Keep in app.js** (global): `reportMode` and `reportSelected` state variables — both Clan and Footprints used them; Footprints will reuse.
- **Add to Footprints tab:** Report Builder toggle button in the header; when enabled, the sidebar items become clickable selection chips (instead of view-switching). Export button appears when ≥1 artist is selected. Same CSV output as before.
- **Remove the count chip** from the CLAN nav pill (`#clanCount`). Subtitle inside the Clan page already shows "X artists in your roster" — that's enough.
- **Shrink foraging card text** (`.forage-name` 12→11px, `.forage-meta` 12→10, `.forage-track` 11→9). Keep proportions and hierarchy.

## Anti-examples
No new export format (just CSV like before). No new report types. Smallest possible move.

## Files
- edit: `index.html` — strip Clan report buttons; add Footprints report header
- edit: `css/style.css` — shrink `.forage-*` text + minor Footprints header tweaks
- edit: `js/clan.js` — strip `toggleReportMode`, `exportReport`, `reportMode` branches
- edit: `js/footprints.js` — add `toggleFpReportMode()`, `exportFpReport()`, selection mode in sidebar
- update: `wiki/features/footprints.md`, `wiki/features/clan.md`, `wiki/log.md`
