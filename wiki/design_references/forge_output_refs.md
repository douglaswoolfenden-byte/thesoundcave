# Design References — Forge media output (per type)

**Captured:** 2026-06-09 · sourced + verified for the per-type output recipes
([`../spec/forge_output_recipes.md`](../spec/forge_output_recipes.md)).
**Palette law:** technique-only. Never flip the dark palette (`#0a0a0a` / `#e8e8e8` / single `#ff4500`)
to match a reference.

> Verification: Behance + Fonts-in-use links were fetch-verified (HTTP 200). Instagram + Dribbble
> resolve in a browser but are JS/auth-walled — eyeball before treating as canonical.

## POST
| Ref | Source | Lift | Skip |
|---|---|---|---|
| Possession | https://www.instagram.com/possessiontechno/ | one-accent discipline (accent on exactly one element); full-bleed oversized type; crushed-monochrome photo so any client image reads on-brand | fashion-editorial gloss, gradient experiments |
| Mord Records | https://mord.bandcamp.com/ · https://ra.co/labels/9839 | catalogue-number-as-design-element (`REL-014` in mono); one mark on void black | too austere for social — add more grain/texture |
| KHIDI | https://ra.co/labels/17881 · https://khidi.bandcamp.com/ | architectural grid + hard divider rules + grain-on-concrete | grey-leaning palette — push to true #0a0a0a |

## CAROUSEL (slide consistency is the problem — pick one lever)
| Ref | Source | Consistency lever | Use when |
|---|---|---|---|
| UNTZIG flyers (MA Cherry) | https://www.behance.net/gallery/220213139/Party-flyers-for-UNTZIG-techno-events | locked zone skeleton — header / metadata / accent in identical coordinates, swap content | lineup / announcement sets |
| WNTRGRND | https://www.behance.net/gallery/78016665/WNTRGRND | one repeated motif/device pinned identically slide-to-slide | mood / recap sequences |
| Submerge (XK studio) | https://www.behance.net/gallery/164152545/Submerge | shared baseline grid + `01/02/03` slide-numbers | EP tracklists, ordered reveals |

## EVENT PROMO (atmospheric teaser)
| Ref | Source | Lift | Skip |
|---|---|---|---|
| Julia Lutska "Techno" | https://www.behance.net/gallery/160514837/Techno | one focal image + minimal type; negative-space-as-tension | monochrome-cool bias — bring #ff4500 hot point |
| Full Scale | https://www.behance.net/gallery/175333903/Full-Scale-Visual-Identity-Vinyl-and-Merch | industrial texture-on-black; "two colours + type" discipline keeps teaser & poster siblings | merch/vinyl mockups |
| DARK FACES | https://www.instagram.com/_dark.faces_/ | real promoter teaser→reveal cadence; dark photographic mood | their specific brand marks |

## EVENT POSTER ★
| Ref | Source | Lift | Skip |
|---|---|---|---|
| Joe Prytherch / Boiler Room | https://fontsinuse.com/uses/17142/boiler-room-poster-series | fixed-square-frame system; type-as-hero, backdrop subordinate; "scan-and-stretch a clean grotesk" for cheap grit; backdrop+type as separable layers (validates our compositor) | font-tourism (new face per poster) — lock ONE mono+grotesk; playful faces (Cooper Black) |
| AFTERLIFE/BR posters (vesper 9_13) | https://www.behance.net/search/projects/boiler%20room%20poster | headliner→descending-supports hierarchy + small fixed date/venue footer band | verify in browser (direct gallery 404s; reach via search) |
| Dribbble dark-techno tag | https://dribbble.com/tags/dark_techno | comparative scan of lineup-hierarchy-over-grainy-dark layouts | Envato/PosterMyWall stock templates that bleed into the tag |

## ARTIST BIO (three face-dodge techniques — model renders faces badly)
| Ref | Source | Technique | Use when |
|---|---|---|---|
| Spotify Duotone Portraits | https://www.behance.net/gallery/48702241/Spotify-Duotone-Portraits | duotone/halftone crush — flatten portrait to 2 tones, face stops reading as "almost-right" | usable-but-imperfect AI portrait |
| WNTRGRND | https://www.behance.net/gallery/78016665/WNTRGRND | name-as-hero, no figure — heavy mono name on concrete/grain | portrait unusable (safe fallback) |
| Jessica Brankka | https://www.behance.net/gallery/170667407/Jessica-Brankka | portrait masked inside a bold letterform — figure present, face cropped | want human presence, hide face |

Cross-cutting: heavy condensed/mono display name as dominant element; texture (grain/halftone/concrete)
does the atmospheric work. Force #0a0a0a / off-white / single #ff4500 every time.

## Standing feeds to mine
- THE BRVTALIST — https://www.instagram.com/thebrvtalist/ (curated brutalist feed)
