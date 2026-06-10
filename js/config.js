// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// API base — single source of truth for the backend (content_api).
// Decisions: 0003 (Railway backend) + 0006 (Vercel static frontend).
// Resolution order:
//   1. localStorage 'sc_api_url' override — point at any backend (e.g. a branch)
//   2. localhost:8000 when developing locally
//   3. PROD_API (Railway) in production
// MUST load before every other app script (see index.html).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function () {
  // Set once the Railway service is live (Phase 3). e.g.
  //   'https://thesoundcave-api.up.railway.app'
  const PROD_API = '';

  function isLocalHost(h) {
    return h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0' || h === '';
  }

  // Returns the backend base URL with any trailing slash stripped.
  window.scApiBase = function scApiBase() {
    try {
      const override = localStorage.getItem('sc_api_url');
      if (override) return override.replace(/\/+$/, '');
    } catch (e) { /* localStorage may be blocked (private mode / sandbox) */ }

    if (isLocalHost(location.hostname)) return 'http://localhost:8000';
    if (PROD_API) return PROD_API.replace(/\/+$/, '');

    console.warn('[config] No production API URL set — backend calls will fail. Set PROD_API in js/config.js.');
    return 'http://localhost:8000';
  };
})();
