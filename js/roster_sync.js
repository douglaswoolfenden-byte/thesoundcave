// Sound Cave — Roster account sync (write-through cache).
//
// The Roster (Clan) is the source-of-truth on the user's Supabase account.
// localStorage (sc_favs / sc_watching / sc_dismissed) is a hot cache so the
// existing synchronous reads in app.js keep working. This module:
//   • loads the account roster into the cache on init / sign-in,
//   • writes each mutation through to the API (fire-and-forget),
//   • migrates a local-only roster up to the account on first sign-in.
//
// Spec: wiki/spec/roster_account_persistence.md. Exposes window.rosterSync.
// Signed-out → every function is a safe no-op (app runs localStorage-only).
(function () {
  const apiBase = () => scApiBase();

  let _loading = false;

  async function _authed() {
    if (!window.scAuth) return false;
    try { return !!(await scAuth.session()); } catch { return false; }
  }

  function _refresh() {
    try { window.updateCounts && window.updateCounts(); } catch (e) {}
    try { window.refreshCurrentTab && window.refreshCurrentTab(); } catch (e) {}
  }

  // Pull the account roster into the localStorage cache. Account wins, EXCEPT
  // the one-time migration: empty account + non-empty local → push local up.
  async function loadRoster() {
    if (_loading || !(await _authed())) return;
    _loading = true;
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/roster`);
      if (!r.ok) { console.warn('[roster] load failed', r.status); return; }
      const data = await r.json();

      const serverFavs = {};
      (data.roster || []).forEach(e => { if (e && e.username) serverFavs[e.username] = e; });

      const localFavs = JSON.parse(localStorage.getItem('sc_favs') || '{}');
      const serverEmpty = Object.keys(serverFavs).length === 0;
      const localHas = Object.keys(localFavs).length > 0;

      if (serverEmpty && localHas) {
        await migrateLocalToAccount(localFavs);   // rescue local-only roster
      } else {
        localStorage.setItem('sc_favs', JSON.stringify(serverFavs));
        localStorage.setItem('sc_watching', JSON.stringify(data.watching || []));
        localStorage.setItem('sc_dismissed', JSON.stringify(data.dismissed || []));
      }
      _refresh();
    } catch (e) {
      console.warn('[roster] load error', e);
    } finally {
      _loading = false;
    }
  }

  async function migrateLocalToAccount(localFavs) {
    const favs = localFavs || JSON.parse(localStorage.getItem('sc_favs') || '{}');
    const watching = JSON.parse(localStorage.getItem('sc_watching') || '[]');
    const dismissed = JSON.parse(localStorage.getItem('sc_dismissed') || '[]');
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/roster/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ favs, watching, dismissed }),
      });
      if (r.ok) {
        const { imported } = await r.json();
        console.log(`[roster] migrated ${imported} local artist(s) to account`);
      }
    } catch (e) {
      console.warn('[roster] migration failed', e);
    }
  }

  // Upsert a single sc_favs entry (add to Clan, status flip, notes/platform edit).
  async function pushArtist(entry) {
    if (!entry || !(await _authed())) return;
    try {
      await scAuth.authedFetch(`${apiBase()}/api/roster`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry),
      });
    } catch (e) { console.warn('[roster] push failed', e); }
  }

  async function deleteArtist(username) {
    if (!username || !(await _authed())) return;
    try {
      await scAuth.authedFetch(`${apiBase()}/api/roster/${encodeURIComponent(username)}`, { method: 'DELETE' });
    } catch (e) { console.warn('[roster] delete failed', e); }
  }

  // Register an artist for daily tracking (Clan Data Tracking v2) — the
  // backend resolves the stable numeric SoundCloud id from artist_url once.
  async function registerTracking(entry) {
    if (!entry || !entry.username || !(await _authed())) return;
    try {
      await scAuth.authedFetch(`${apiBase()}/api/tracking/artists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username:     entry.username,
          artist_url:   entry.artist_url || '',
          display_name: entry.display_name || '',
          genre:        entry.genre || '',
          avatar_url:   entry.avatar_url || '',
        }),
      });
    } catch (e) { console.warn('[tracking] register failed', e); }
  }

  // Sync the foraging watching/dismissed arrays from the cache up to the account.
  async function pushPrefs() {
    if (!(await _authed())) return;
    const watching = JSON.parse(localStorage.getItem('sc_watching') || '[]');
    const dismissed = JSON.parse(localStorage.getItem('sc_dismissed') || '[]');
    try {
      await scAuth.authedFetch(`${apiBase()}/api/roster/prefs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ watching, dismissed }),
      });
    } catch (e) { console.warn('[roster] prefs push failed', e); }
  }

  // Catch sign-ins that happen without a page reload (password login).
  if (window.scAuth && scAuth.onChange) {
    scAuth.onChange((event, session) => {
      if (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) loadRoster();
    });
  }

  window.rosterSync = { loadRoster, pushArtist, deleteArtist, pushPrefs, registerTracking, migrateLocalToAccount };
})();
