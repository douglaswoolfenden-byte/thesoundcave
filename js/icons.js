// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ICONS — bespoke inline-SVG line-art set
// Mechanical / analog aesthetic. stroke="currentColor" so the
// host element's CSS colour governs (use color: var(--color-accent)
// to render in brand orange).
//
// Usage:  scIcon('foraging')  →  returns SVG markup string.
// All strings are static constants defined below — no user data.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

(function () {
  const WRAP = (paths) =>
    `<svg class="sc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true">${paths}</svg>`;

  const ICONS = {
    // ── Home/Overview terminology grid ─────────────────
    foraging: WRAP(`
      <circle cx="12" cy="12" r="8"/>
      <circle cx="12" cy="12" r="4"/>
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
      <circle cx="12" cy="12" r="0.8" fill="currentColor"/>
    `),
    clan: WRAP(`
      <circle cx="6" cy="7" r="2"/>
      <circle cx="18" cy="7" r="2"/>
      <circle cx="12" cy="18" r="2"/>
      <path d="M8 7h8M7.2 8.7l3.6 7.6M16.8 8.7l-3.6 7.6"/>
    `),
    cave: WRAP(`
      <path d="M3 20V12a9 9 0 0 1 18 0v8"/>
      <path d="M3 20h18"/>
      <path d="M8 20v-4M16 20v-4"/>
      <circle cx="12" cy="11" r="0.8" fill="currentColor"/>
    `),
    footprints: WRAP(`
      <path d="M7 4l1.2 4.5L7 13l-1.2-4.5z"/>
      <circle cx="5" cy="15.5" r="0.9"/>
      <circle cx="7.5" cy="17" r="0.7"/>
      <path d="M16 8l1.2 4.5L16 17l-1.2-4.5z"/>
      <circle cx="14" cy="19.5" r="0.9"/>
      <circle cx="16.5" cy="21" r="0.7"/>
    `),
    firepit: WRAP(`
      <path d="M12 3c1.5 3 3 4.5 3 7a3 3 0 0 1-6 0c0-1.2.6-2 1.5-3"/>
      <path d="M5 20h14"/>
      <path d="M6 20l3-4M18 20l-3-4M9 20l3-2.5L15 20"/>
    `),
    cut: WRAP(`
      <circle cx="6" cy="6" r="2.5"/>
      <circle cx="6" cy="18" r="2.5"/>
      <path d="M8 7.5l13 9M8 16.5l13-9"/>
    `),

    // ── Firepit content-type picker ─────────────────────
    event_promo: WRAP(`
      <rect x="3" y="7" width="18" height="12" rx="1"/>
      <circle cx="12" cy="13" r="3.5"/>
      <circle cx="12" cy="13" r="1.2"/>
      <path d="M8 7l1.5-2h5L16 7"/>
      <circle cx="18" cy="9.5" r="0.6" fill="currentColor"/>
    `),
    lineup: WRAP(`
      <circle cx="12" cy="12" r="8"/>
      <circle cx="12" cy="7" r="1.4"/>
      <circle cx="12" cy="17" r="1.4"/>
      <circle cx="7" cy="12" r="1.4"/>
      <circle cx="17" cy="12" r="1.4"/>
      <circle cx="12" cy="12" r="1.4"/>
    `),
    carousel: WRAP(`
      <rect x="3" y="6" width="6" height="12" rx="1"/>
      <rect x="9" y="4" width="6" height="16" rx="1"/>
      <rect x="15" y="6" width="6" height="12" rx="1"/>
      <path d="M11 8h2M11 16h2"/>
    `),
    artist_bio: WRAP(`
      <circle cx="12" cy="8" r="3.5"/>
      <path d="M5 20c1.5-4 4-6 7-6s5.5 2 7 6"/>
      <path d="M9 8h6"/>
    `),
    press_release: WRAP(`
      <rect x="4" y="4" width="16" height="16" rx="1"/>
      <path d="M7 8h10M7 11h10M7 14h7M7 17h5"/>
    `),

    // ── Utility ─────────────────────────────────────────
    restore: WRAP(`
      <path d="M4 12a8 8 0 1 0 2.3-5.6"/>
      <path d="M4 4v4h4"/>
    `),
    soundcloud: WRAP(`
      <path d="M4 15v2.5M7 12v5.5M10 10v7.5M13 9.5v8"/>
      <path d="M13 17.5h6a3 3 0 0 0 0-6 4.5 4.5 0 0 0-8.8-1"/>
    `),
    download: WRAP(`
      <path d="M12 3v12"/>
      <path d="M8 11l4 4 4-4"/>
      <path d="M5 20h14"/>
    `),
    location: WRAP(`
      <path d="M12 21s7-5.2 7-11a7 7 0 1 0-14 0c0 5.8 7 11 7 11z"/>
      <circle cx="12" cy="10" r="2.5"/>
    `),
    grip: WRAP(`
      <circle cx="9" cy="6" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="6" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="12" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="9" cy="18" r="1.6" fill="currentColor" stroke="none"/>
      <circle cx="15" cy="18" r="1.6" fill="currentColor" stroke="none"/>
    `),
    trash: WRAP(`
      <path d="M4 7h16"/>
      <path d="M9 7V4h6v3"/>
      <path d="M6 7l1 13h10l1-13"/>
      <path d="M10 11v6M14 11v6"/>
    `),
    note: WRAP(`
      <circle cx="9" cy="17" r="2.5"/>
      <circle cx="18" cy="15" r="2"/>
      <path d="M11.5 17V5l9-2v12"/>
    `),
    search: WRAP(`
      <circle cx="11" cy="11" r="6"/>
      <path d="M15.5 15.5L21 21"/>
    `),
    calendar: WRAP(`
      <rect x="3" y="5" width="18" height="16" rx="1"/>
      <path d="M3 10h18M8 3v4M16 3v4"/>
    `),
    bolt: WRAP(`
      <path d="M13 3L4 14h7l-1 7 9-11h-7z"/>
    `),
    chart: WRAP(`
      <path d="M4 4v16h16"/>
      <path d="M7 16l4-5 3 3 5-7"/>
    `),
    mail: WRAP(`
      <rect x="3" y="5" width="18" height="14" rx="1"/>
      <path d="M3 6l9 7 9-7"/>
    `),
    stash: WRAP(`
      <rect x="3" y="11" width="18" height="9" rx="1"/>
      <path d="M3 11l2-5h14l2 5"/>
      <path d="M9 15h6"/>
    `),
    regen: WRAP(`
      <path d="M21 12a9 9 0 1 1-3-6.7"/>
      <path d="M21 3v5h-5"/>
    `),
    refine: WRAP(`
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>
    `),
    beat: WRAP(`
      <circle cx="9" cy="18" r="2.5"/>
      <circle cx="18" cy="16" r="2"/>
      <path d="M11.5 18V6l9-2v12"/>
    `),
  };

  window.scIcon = function scIcon(name) {
    return ICONS[name] || '';
  };

  // Parses an SVG markup string into a real <svg> Node — used instead of
  // direct HTML assignment so the icon stays sanitised by the SVG parser.
  function parseSvg(markup) {
    const doc = new DOMParser().parseFromString(markup, 'image/svg+xml');
    return doc.documentElement;
  }

  // Hydrate any <element data-icon="name"> placeholders found in the DOM.
  function hydrate(root) {
    (root || document).querySelectorAll('[data-icon]').forEach(el => {
      if (el.querySelector('svg.sc-icon')) return;          // already hydrated
      const name = el.getAttribute('data-icon');
      const markup = ICONS[name];
      if (!markup) return;
      const svg = parseSvg(markup);
      if (svg && svg.nodeName.toLowerCase() === 'svg') el.appendChild(svg);
    });
  }
  window.scHydrateIcons = hydrate;

  document.addEventListener('DOMContentLoaded', () => hydrate());
})();
