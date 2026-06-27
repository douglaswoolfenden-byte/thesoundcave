// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VERSION STAMP
// Surfaces the product version + Age in the bottom-left corner stamp —
// on the splash and on every app page. The version number is read from
// the root /VERSION file (single source of truth — wiki/decisions/0013);
// the Age is the current strategic era (bump only when it graduates —
// see wiki/roadmap.md, this is rare).
//
// Markup contract: any element with [data-version] gets "V<number>",
// any [data-age] gets the era label. Both the splash (#caveStamp) and the
// app shell (#appStamp) carry those slots, so one paint keeps them in sync.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  const FALLBACK_VERSION = '1.0.0';   // mirrors /VERSION if the fetch fails
  const AGE = 'First Age';            // First → Second → Third (the Studio now)

  function paint(version) {
    document.querySelectorAll('[data-version]').forEach(el => {
      el.textContent = 'V' + version;
    });
    document.querySelectorAll('[data-age]').forEach(el => {
      el.textContent = AGE.toUpperCase();
    });
  }

  function start() {
    paint(FALLBACK_VERSION);          // instant — no flash of stale text
    fetch('VERSION', { cache: 'no-cache' })
      .then(r => (r.ok ? r.text() : null))
      .then(t => { const v = (t || '').trim(); if (v) paint(v); })
      .catch(() => {});               // fallback already painted
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
