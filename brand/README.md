# Sound Cave — Brand Assets

**The one place to find every S0UNDCAV3 logo, icon, font, colour, and brand reference.**
Not code — just art and reference material. If you're looking for a logo to drop into a
deck, a poster, or a social post, it's here.

## Quick grab — "I just need the logo"

| You want… | Use this file |
|---|---|
| The logo (vector, transparent) | `logo/soundcave_logo_2026-05-11.svg` |
| The app icon / favicon (logo on dark square) | `icons/favicon.svg` |
| The alternate / boxed logo | `logo/dormant/soundcave_logo_alt_2026-05-11.svg` |
| The fonts | `fonts/DMSans-Regular.ttf`, `fonts/DMMono-Regular.ttf` |
| A Reddit profile banner (logo + wordmark) | `banners/soundcave_banner_reddit_1920x384_2026-06-29.png` |

## Structure

```
brand/
├── README.md                ← you are here (the index)
├── logo/                    active logo files (SVG preferred, dated filenames keep history)
│   ├── soundcave_logo_2026-05-11.svg
│   └── dormant/             alternates, drafts, retired logos — kept for reference / revival
│       └── soundcave_logo_alt_2026-05-11.svg
├── icons/                   app-icon / favicon set (reference copies — see note below)
│   ├── favicon.svg          512×512, logo on the dark rounded square
│   ├── favicon-32.png       32×32 PNG fallback
│   └── apple-touch-icon.png 180×180 home-screen icon
├── fonts/                   brand typefaces (TTF)
│   ├── DMSans-Regular.ttf
│   └── DMMono-Regular.ttf
└── banners/                 horizontal lockups for social profile headers
    └── soundcave_banner_reddit_1920x384_2026-06-29.png
```

## Full asset list

### Logos (vector)

| File | Format | What it is |
|---|---|---|
| `logo/soundcave_logo_2026-05-11.svg` | SVG, transparent | **Primary mark.** Off-white cave glyph, no background. Used in the splash, header tab, and hero. |
| `logo/dormant/soundcave_logo_alt_2026-05-11.svg` | SVG, 1024×1024 | Alternate — same glyph on a solid `#0A0A0A` square. Dormant; kept for possible revival. |

### App icons / favicons

These are the logo rendered as an app icon (mark on the brand dark rounded square).

| File | Size | Used as |
|---|---|---|
| `icons/favicon.svg` | 512×512 | Modern-browser favicon (`<link rel="icon" type="image/svg+xml">`) |
| `icons/favicon-32.png` | 32×32 | PNG favicon fallback |
| `icons/apple-touch-icon.png` | 180×180 | iOS/Android home-screen icon |

> **⚠ Deployed copies live at the repo root**, not here. `index.html` references
> `favicon.svg`, `favicon-32.png`, and `apple-touch-icon.png` with root-relative paths
> because GitHub Pages serves icons from the site root. The copies in `icons/` are the
> findable **reference masters** — if you change an icon, update **both** the root copy
> and the copy here so they don't drift.

### Banners / social

Lockups (logo + `S0UNDCAV3` wordmark, no glow) on cave-black, sized for social profile headers.

| File | Size | For |
|---|---|---|
| `banners/soundcave_banner_reddit_1920x384_2026-06-29.png` | 1920×384 (5:1) | Reddit profile banner — **stacked** (logo above wordmark) |

> **Reddit mobile crops the banner inward to ~the centre third**, so a wide horizontal
> logo-left/wordmark-right lockup loses its ends on a phone. The Reddit banner therefore
> uses a **stacked** lockup sized to sit inside the full safe zone — the art spans only
> x 832–1088 and y 108–274 of the 1920×384 canvas, i.e. inside both the centre-third
> width *and* the central ~200px height, so it stays whole on every viewport (Reddit crops
> inward on mobile both horizontally and vertically). Recommended size is 1920×384; keep
> key art inside the central 1300×200 px. Keep the PNG under ~400 KB or Reddit re-compresses it.
>
> Built from the master logo SVG + DM Mono wordmark via headless Chromium. For a wider
> header (e.g. X/Twitter 1500×500, which crops less aggressively) a horizontal lockup is
> fine — re-render keeping the group centred.

### Fonts

| File | Role |
|---|---|
| `fonts/DMMono-Regular.ttf` | **Display / logo** — DM Mono, monospace, wide tracking (`0.18em`), lowercase |
| `fonts/DMSans-Regular.ttf` | **Body** — DM Sans |

In the app these load via `--font-mono` / `--font-body` CSS variables (`css/style.css`).

## Palette (locked, from `tokens.css`)

| Hex | Role |
|---|---|
| `#0a0a0a` | Cave black (primary bg) |
| `#120e0c` | Warm cave black |
| `#e8e8e8` | Off-white (text / mark) |
| `#888888` | Muted grey |
| `#4a4a4a` | Faint grey |
| `#ff4500` | Orange-red accent (hero) |
| `#ff6a1f` | Hot orange (hover) |
| `#aa2a00` | Deep ember (shadow) |

## Type

- **Display / logo:** DM Mono (monospace, wide tracking `0.18em`, lowercase)
- **Body:** DM Sans

## Notes

- Logo filenames are **dated** (`_YYYY-MM-DD`) so we keep version history — add a new dated
  file rather than overwriting when the mark changes, and move the old one to `logo/dormant/`.
- This folder is the **single source of truth** for brand art. Related *spec/design* pages
  (the compositor, brand-kit UI, image-gen brand awareness) live in `wiki/spec/brand_*.md`.
