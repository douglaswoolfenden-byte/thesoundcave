// Sound Cave — Supabase client + auth helpers (Phase B).
// Loaded as a classic <script> in index.html. Exposes window.scAuth.
//
// Loads SDK from CDN, fetches public config from /api/config, then exposes:
//   scAuth.ready              - Promise<void> resolved once client is initialised
//   scAuth.client             - the supabase-js client
//   scAuth.session()          - Promise<Session|null>
//   scAuth.user()             - Promise<User|null>
//   scAuth.token()            - Promise<string|null>  (current access JWT)
//   scAuth.signInWithEmail(e) - calls signInWithOtp; returns {error?: string}
//   scAuth.signOut()          - signs out + reloads page
//   scAuth.onChange(cb)       - subscribes to auth state changes
(function () {
  const SDK_URL = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
  const apiBase = (typeof localStorage !== 'undefined' && localStorage.getItem('sc_api_url')) || 'http://localhost:8000';

  let client = null;
  const subscribers = new Set();

  // Hardcoded public Supabase config. Anon key is safe to expose — RLS is the
  // security layer. Avoids dependency on /api/config (Flask) when the frontend
  // is deployed on Vercel without the backend.
  const SUPABASE_URL = 'https://agmmdrqmjywggtsycsri.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFnbW1kcnFtanl3Z2d0c3ljc3JpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczOTIyMTYsImV4cCI6MjA5Mjk2ODIxNn0.-POHp0618Sz1Rd0yb1_cqPyNNtHqpzeCBvqJYCTeC_E';

  async function init() {
    const { createClient } = await import(SDK_URL);
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
    client.auth.onAuthStateChange((event, session) => {
      subscribers.forEach(cb => { try { cb(event, session); } catch (e) { console.error(e); } });
    });
    return client;
  }

  const ready = init().catch(err => {
    console.error('scAuth init failed', err);
    throw err;
  });

  async function session() {
    await ready;
    const { data } = await client.auth.getSession();
    return data.session;
  }

  async function user() {
    const s = await session();
    return s ? s.user : null;
  }

  async function token() {
    const s = await session();
    return s ? s.access_token : null;
  }

  async function signInWithEmail(email) {
    await ready;
    const redirectTo = window.location.origin + window.location.pathname;
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } });
    return error ? { error: error.message } : {};
  }

  async function signOut() {
    await ready;
    await client.auth.signOut();
    sessionStorage.removeItem('sc_splash_done');
    window.location.reload();
  }

  function onChange(cb) {
    subscribers.add(cb);
    return () => subscribers.delete(cb);
  }

  // Convenience: authed fetch that auto-attaches the JWT.
  async function authedFetch(url, opts = {}) {
    const t = await token();
    const headers = new Headers(opts.headers || {});
    if (t) headers.set('Authorization', `Bearer ${t}`);
    return fetch(url, { ...opts, headers });
  }

  window.scAuth = {
    get ready() { return ready; },
    get client() { return client; },
    session, user, token, signInWithEmail, signOut, onChange, authedFetch,
  };
})();
