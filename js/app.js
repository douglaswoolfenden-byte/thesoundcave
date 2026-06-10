// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CAVE ENTRANCE (unified splash + reveal + auth gate)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function initCaveEntrance() {
  const cave    = document.getElementById('caveEntrance');
  const appWrap = document.getElementById('appWrap');

  // Public: brand pill click re-shows the splash overlay (logo + pulse).
  // Dismiss = scroll/swipe progressively zooms INTO the logo as if diving
  // through it. Click/keypress = instant finish. After login, the form
  // never re-appears — brand pill is only visible inside the app shell,
  // which means the user is already authenticated.
  window.scShowSplash = function showSplash() {
    if (!cave) return;
    cave.classList.remove('hidden', 'entering', 'mouth-open', 'diving');
    cave.classList.add('revisit');                     // minimalist re-show
    cave.style.setProperty('--dive-progress', '0');
    cave.style.setProperty('--dive-scale', '1');
    document.body.style.overflow = 'hidden';

    // Always hide login form on re-show — brand pill only exists post-login.
    const loginForm = document.getElementById('caveLogin');
    if (loginForm) loginForm.hidden = true;

    const DIVE_BUDGET = 900;            // px of accumulated scroll = full dive
    let progress = 0;
    let finished = false;
    let lastTouchY = null;

    function apply() {
      const eased = Math.min(1, progress / DIVE_BUDGET);
      // Scale 1 → 8 with ease-in curve so the last bit accelerates.
      const scale = 1 + Math.pow(eased, 1.6) * 7;
      cave.style.setProperty('--dive-progress', eased.toFixed(3));
      cave.style.setProperty('--dive-scale', scale.toFixed(3));
      if (eased >= 1) finish();
    }

    function bump(deltaPx) {
      if (finished) return;
      progress = Math.max(0, progress + deltaPx);
      apply();
    }

    function finish() {
      if (finished) return;
      finished = true;
      cave.classList.add('entering');
      setTimeout(() => {
        cave.classList.add('hidden');
        cave.classList.remove('diving', 'entering', 'revisit');
        cave.style.removeProperty('--dive-progress');
        cave.style.removeProperty('--dive-scale');
        document.body.style.overflow = '';
      }, 500);
      cleanup();
    }

    // Reversed: gesture goes top → bottom (scroll up / swipe down) dives in.
    function onWheel(e)  { bump(-e.deltaY); }
    function onTouchStart(e) { lastTouchY = e.touches[0]?.clientY ?? null; }
    function onTouchMove(e)  {
      const y = e.touches[0]?.clientY;
      if (lastTouchY != null && y != null) bump((y - lastTouchY) * 2.5);
      lastTouchY = y;
    }
    function onClick()   { progress = DIVE_BUDGET; apply(); }
    function onKeydown() { progress = DIVE_BUDGET; apply(); }

    function cleanup() {
      cave.removeEventListener('click', onClick);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKeydown);
      window.removeEventListener('touchstart', onTouchStart);
      window.removeEventListener('touchmove', onTouchMove);
    }

    setTimeout(() => {
      cave.classList.add('diving');
      cave.addEventListener('click', onClick);
      window.addEventListener('wheel', onWheel, { passive: true });
      window.addEventListener('keydown', onKeydown);
      window.addEventListener('touchstart', onTouchStart, { passive: true });
      window.addEventListener('touchmove', onTouchMove, { passive: true });
    }, 150);
  };
  const form     = document.getElementById('caveLogin');
  const emailEl  = document.getElementById('caveLoginEmail');
  const pwdEl    = document.getElementById('caveLoginPassword');
  const btnEl    = document.getElementById('caveLoginBtn');
  const toggleEl = document.getElementById('caveLoginToggle');
  const forgotEl = document.getElementById('caveLoginForgot');
  const msgEl    = document.getElementById('caveLoginMsg');
  let mode = 'magic'; // 'magic' | 'password'

  function reveal() {
    cave.classList.add('mouth-open');
    // Halftone overlay snaps on, then resolves to clean as cave opens.
    appWrap.classList.add('halftoning');
    setTimeout(() => {
      cave.classList.add('entering');
      appWrap.classList.add('revealed');     // also fades halftone out (CSS)
      setTimeout(() => {
        cave.classList.add('hidden');
        appWrap.classList.remove('halftoning');
      }, 2600);
      sessionStorage.setItem('sc_splash_done', '1');
    }, 700);
  }

  function showLoginForm() {
    cave.classList.add('mouth-open');     // peephole stays open, no further animation
    form.hidden = false;
    setTimeout(() => emailEl.focus(), 50);
  }

  async function start() {
    try {
      await window.scAuth.ready;
      const session = await window.scAuth.session();
      if (!session) {
        showLoginForm();
        return;
      }
      if (sessionStorage.getItem('sc_splash_done')) {
        cave.classList.add('hidden');
        appWrap.classList.add('revealed');
      } else {
        reveal();
      }
    } catch (e) {
      console.error('auth init failed', e);
      // Fail-open: show the login form so user can at least try.
      showLoginForm();
      msgEl.textContent = 'Auth service unreachable — is content_api running?';
    }
  }

  toggleEl.addEventListener('click', () => {
    mode = mode === 'magic' ? 'password' : 'magic';
    pwdEl.hidden = mode !== 'password';
    forgotEl.hidden = mode !== 'password';
    btnEl.textContent = mode === 'password' ? '{SIGN IN}' : '{ENTER THE CAVE}';
    btnEl.dataset.glitchText = btnEl.textContent;
    toggleEl.textContent = mode === 'password' ? '{USE MAGIC LINK}' : '{USE PASSWORD}';
    msgEl.textContent = '';
    msgEl.className = 'cave-login-msg';
    if (mode === 'password') setTimeout(() => pwdEl.focus(), 50);
  });

  forgotEl.addEventListener('click', async () => {
    const email = emailEl.value.trim();
    if (!email) { emailEl.focus(); msgEl.textContent = 'Enter your email above first.'; msgEl.className = 'cave-login-msg error'; return; }
    forgotEl.disabled = true;
    msgEl.textContent = 'Sending reset link…';
    msgEl.className = 'cave-login-msg';
    const { error } = await window.scAuth.sendPasswordReset(email);
    forgotEl.disabled = false;
    if (error) {
      msgEl.textContent = error;
      msgEl.className = 'cave-login-msg error';
    } else {
      msgEl.textContent = `Reset link sent to ${email}. Click it, then set a new password from the account menu.`;
      msgEl.className = 'cave-login-msg success';
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = emailEl.value.trim();
    if (!email) return;
    const password = pwdEl.value;
    if (mode === 'password' && !password) { pwdEl.focus(); return; }
    btnEl.disabled = true;
    const originalLabel = btnEl.textContent;
    // Glitch the CTA while we wait — KVS-style scramble before the resolve.
    if (window.caveGlitch) window.caveGlitch(btnEl, mode === 'password' ? '{SIGNING IN…}' : '{SENDING…}');
    else btnEl.textContent = mode === 'password' ? '{SIGNING IN…}' : '{SENDING…}';
    msgEl.textContent = '';
    const { error } = mode === 'password'
      ? await window.scAuth.signInWithPassword(email, password)
      : await window.scAuth.signInWithEmail(email);
    btnEl.disabled = false;
    if (window.caveGlitch) window.caveGlitch(btnEl, originalLabel);
    else btnEl.textContent = originalLabel;
    if (error) {
      msgEl.textContent = error;
      msgEl.className = 'cave-login-msg error';
    } else if (mode === 'magic') {
      msgEl.textContent = `Check ${email} — click the link to enter.`;
      msgEl.className = 'cave-login-msg success';
      emailEl.disabled = true;
    }
    // password success path: SIGNED_IN event fires reveal() via onChange below
  });

  // When the magic link returns, Supabase JS auto-detects the URL hash and
  // fires SIGNED_IN. At that point reveal the app.
  window.scAuth.ready.then(() => {
    window.scAuth.onChange((event) => {
      if (event === 'SIGNED_IN' && cave && !cave.classList.contains('hidden')) {
        sessionStorage.removeItem('sc_splash_done');
        form.hidden = true;
        reveal();
      }
    });
  }).catch(() => {});

  start();
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let allReports  = [];
let currentData = null;
let currentTab  = 'cave';
let activeArtist = null;
let reportMode  = false;
let reportSelected = [];
let filtersOpen = true;
let searchMode  = 'quick';

// Daily snapshots (loaded from data/snapshots/)
let allSnapshots = []; // [{date, artists: {username: {followers, plays, ...}}}]

// Foraging state
let forageDismissed = []; // cut from foraging
let forageWatching  = []; // watching list

// Footprints state
let fpSelectedArtist = null;
let fpActiveMetric   = 'followers';

// Clan detail
let clanSelectedId = null;

const PLATFORMS = ['spotify','youtube','instagram','tiktok','beatport','bandcamp','discogs'];
const PLAT_LABELS = { spotify:'Spotify', youtube:'YouTube', instagram:'Instagram', tiktok:'TikTok', beatport:'Beatport', bandcamp:'Bandcamp', discogs:'Discogs' };
// Mono brand marks — canonical 24×24 paths (simple-icons style). Stroke/fill = currentColor so CSS controls state.
const PLAT_ICONS = {
  spotify:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
  youtube:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>',
  tiktok:    '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.84-.1z"/></svg>',
  beatport:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M7.197 0c-.234 0-.444.13-.55.33-.106.2-.094.443.034.633L9.95 6.075a.626.626 0 0 0 1.05 0L14.27.963a.625.625 0 0 0-.522-.965zM12 9.001a7.499 7.499 0 1 0 .002 14.998A7.499 7.499 0 0 0 12 9zm0 11.249a3.75 3.75 0 1 1 0-7.5 3.75 3.75 0 0 1 0 7.5z"/></svg>',
  bandcamp:  '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M0 18.75l7.437-13.5H24l-7.438 13.5H0z"/></svg>',
  discogs:   '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm0 3.6a8.4 8.4 0 1 1 0 16.8 8.4 8.4 0 0 1 0-16.8zm0 3.6a4.8 4.8 0 1 0 0 9.6 4.8 4.8 0 0 0 0-9.6zm0 1.8a3 3 0 1 1 0 6 3 3 0 0 1 0-6z"/></svg>'
};
const GENRE_COLORS = ['#e63946','#d62839','#c1121f','#a4161a','#850e14','#6a0b10','#54080c','#3d0508'];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOCALSTORAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function getFavourites()  { return JSON.parse(localStorage.getItem('sc_favs') || '{}'); }
function saveFavourites(d){ localStorage.setItem('sc_favs', JSON.stringify(d)); }
function getDismissed()   { return JSON.parse(localStorage.getItem('sc_dismissed') || '[]'); }
function saveDismissed(d) { localStorage.setItem('sc_dismissed', JSON.stringify(d)); }
function getWatching()    { return JSON.parse(localStorage.getItem('sc_watching') || '[]'); }
function saveWatching(d)  { localStorage.setItem('sc_watching', JSON.stringify(d)); }

function isFavourited(username) { return !!getFavourites()[username]; }
function isCut(username) {
  const favs = getFavourites();
  return favs[username] ? favs[username].status === 'cut' : false;
}
function isWatching(username) { return getWatching().includes(username); }
function isDismissedForage(username) { return getDismissed().includes(username); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FAVOURITES MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function addFavourite(track) {
  const favs = getFavourites();
  const user = track.user || {};
  const username = track.artist_username || user.username || track.artist || '';
  if (!username) return;
  if (!favs[username]) {
    favs[username] = {
      username,
      display_name: track.artist || username,
      genre:        track.genre || '',
      avatar_url:   track.avatar_url || user.avatar_url || '',
      artist_url:   track.artist_url || user.permalink_url || '',
      added_date:   today(),
      status:       'active',
      notes:        '',
      platforms:    { spotify:'', youtube:'', instagram:'', tiktok:'', beatport:'', bandcamp:'', discogs:'' },
      playlist_adds:     null,
      preferred_tracks:  [],
      snapshots:    [],
      tracks_seen:  [],
    };
  }
  addSnapshot(favs, username, track);
  addTrackSeen(favs, username, track);
  saveFavourites(favs);
  // Remove from watching if present
  const w = getWatching().filter(u => u !== username);
  saveWatching(w);
  updateCounts();
  // Write through to the account (no-op when signed out).
  window.rosterSync?.pushArtist(favs[username]);
  window.rosterSync?.pushPrefs();
}

function addSnapshot(favs, username, track) {
  const snap = {
    date:          today(),
    followers:     track.followers || 0,
    plays:         track.plays || 0,
    likes:         track.likes || 0,
    reposts:       track.reposts || 0,
    score:         track.score || 0,
    source:        'scout',
  };
  const snaps = favs[username].snapshots;
  if (!snaps.find(s => s.date === snap.date)) snaps.push(snap);
}

function addTrackSeen(favs, username, track) {
  const seen = favs[username].tracks_seen;
  if (!seen.find(t => t.url === track.url)) {
    seen.push({ title: track.title, url: track.url, date: today(), score: track.score });
  }
}

function removeFavourite() {
  if (!activeArtist) return;
  if (!confirm(`Remove ${activeArtist} from favourites?`)) return;
  const username = activeArtist;
  const favs = getFavourites();
  delete favs[username];
  saveFavourites(favs);
  closePanel();
  updateCounts();
  refreshCurrentTab();
  window.rosterSync?.deleteArtist(username);
}

function toggleCut() {
  if (!activeArtist) return;
  const favs = getFavourites();
  if (!favs[activeArtist]) return;
  favs[activeArtist].status = favs[activeArtist].status === 'cut' ? 'active' : 'cut';
  saveFavourites(favs);
  document.getElementById('cutBtn').textContent = favs[activeArtist].status === 'cut' ? 'RESTORE TO TRACKING' : 'CUT FROM TRACKING';
  refreshCurrentTab();
  window.rosterSync?.pushArtist(favs[activeArtist]);
}

function savePlatform(username, platform, value) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].platforms[platform] = value.trim();
  saveFavourites(favs);
  window.rosterSync?.pushArtist(favs[username]);
}

// Click a platform mark: open its URL if linked, else start adding one.
function platformPrimary(username, platform) {
  const favs = getFavourites();
  const a = favs[username];
  if (!a) return;
  const url = (a.platforms || {})[platform] || '';
  if (url) {
    const full = url.startsWith('http') ? url : 'https://' + url;
    window.open(full, '_blank', 'noopener');
  } else {
    openPlatformEdit(username, platform);
  }
}

// Reveal a single inline URL input below the marks (one at a time).
function openPlatformEdit(username, platform) {
  const box = document.getElementById('platEdit');
  if (!box) return;
  const favs = getFavourites();
  const cur = (favs[username]?.platforms || {})[platform] || '';
  box.hidden = false;
  box.innerHTML = `<label class="plat-edit-label">${esc(PLAT_LABELS[platform] || platform)} link</label>
    <input class="plat-input" id="platEditInput" placeholder="Paste ${esc(PLAT_LABELS[platform] || platform)} URL" value="${esc(cur)}">`;
  const input = document.getElementById('platEditInput');
  if (!input) return;
  input.focus();
  let done = false;
  const commit = () => { if (done) return; done = true; savePlatform(username, platform, input.value); renderPanel(username); };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commit(); }
    else if (e.key === 'Escape') { box.hidden = true; box.innerHTML = ''; }
  });
  input.addEventListener('blur', commit);
}

function saveNotes() {
  if (!activeArtist) return;
  const favs = getFavourites();
  if (!favs[activeArtist]) return;
  favs[activeArtist].notes = document.getElementById('artistNotes').value;
  saveFavourites(favs);
}

// Live top-tracks cache — the artist API only returns top_tracks on a cache
// miss (the Supabase row has no column for them), so we keep the last-fetched
// set per artist here and the panel always has a top 5 to show.
function getTopTracksCache()  { return JSON.parse(localStorage.getItem('sc_top_tracks') || '{}'); }
function saveTopTracksCache(d){ localStorage.setItem('sc_top_tracks', JSON.stringify(d)); }

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// UTILITIES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function today() { return new Date().toISOString().slice(0,10); }
function fmt(n) {
  if (n == null || isNaN(n)) return '0';
  n = Number(n);
  if (n >= 1000000) return (n/1000000).toFixed(1)+'M';
  if (n >= 1000) return (n/1000).toFixed(1)+'K';
  return String(n);
}
function esc(s) {
  if (!s) return '';
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function daysBetween(d1, d2) {
  return Math.round((new Date(d2) - new Date(d1)) / (1000*60*60*24));
}
function getTrend(first, latest) {
  if (first == null || latest == null || first === latest) return { cls:'flat', arrow:'→', label:'Stable', pct:0 };
  const pct = ((latest - first) / Math.max(first, 0.001)) * 100;
  if (pct > 5)  return { cls:'up',   arrow:'↑', label:`+${pct.toFixed(0)}%`, pct };
  if (pct < -5) return { cls:'down', arrow:'↓', label:`${pct.toFixed(0)}%`,  pct };
  return { cls:'flat', arrow:'→', label:'Stable', pct };
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SVG CHART BUILDERS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function buildSparkline(data, w=80, h=28, color='#e63946') {
  if (!data || data.length < 2) return '';
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pad = 3;
  const pts = data.map((v,i) => {
    const x = pad + (i/(data.length-1))*(w-pad*2);
    const y = h-pad - ((v-min)/range)*(h-pad*2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const uid = 'sp'+Math.random().toString(36).slice(2,8);
  const first = pts[0].split(','), last = pts[pts.length-1].split(',');
  const area = `M ${first[0]},${h} L ${pts.join(' L ')} L ${last[0]},${h} Z`;
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="display:block">
    <defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${uid})"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function buildLineChart(datasets, labels, width=600, height=220) {
  const pl=52, pr=16, pt=12, pb=32;
  const cw=width-pl-pr, ch=height-pt-pb;
  const all = datasets.flatMap(d=>d.data);
  if (!all.length) return '';
  const maxV = Math.max(...all), minV = Math.min(...all)*0.92;
  const range = maxV-minV||1;
  const toX = i => pl+(i/(labels.length-1))*cw;
  const toY = v => pt+ch-((v-minV)/range)*ch;
  const uid = 'lc'+Math.random().toString(36).slice(2,8);

  let svg = `<svg viewBox="0 0 ${width} ${height}" style="width:100%;height:auto;display:block">`;
  svg += '<defs>';
  datasets.forEach((ds,di) => {
    svg += `<linearGradient id="${uid}-a${di}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${ds.color}" stop-opacity="0.18"/>
      <stop offset="100%" stop-color="${ds.color}" stop-opacity="0.01"/>
    </linearGradient>`;
  });
  svg += '</defs>';

  // Y grid (5 lines)
  for (let i=0; i<5; i++) {
    const v = minV + (range*i)/4;
    const y = toY(v).toFixed(1);
    svg += `<line x1="${pl}" y1="${y}" x2="${pl+cw}" y2="${y}" stroke="#3a3a3a" stroke-width="1"/>`;
    svg += `<text x="${pl-6}" y="${parseFloat(y)+4}" fill="#888" font-size="9" text-anchor="end" font-family="DM Mono,monospace">${fmt(Math.round(v))}</text>`;
  }
  // X labels
  labels.forEach((l,i) => {
    svg += `<text x="${toX(i).toFixed(1)}" y="${pt+ch+18}" fill="#aaa" font-size="9" text-anchor="middle" font-family="DM Sans,sans-serif">${esc(l)}</text>`;
  });
  // Area + line + dots
  datasets.forEach((ds,di) => {
    const pts = ds.data.map((v,i) => `${toX(i).toFixed(1)},${toY(v).toFixed(1)}`);
    const areaD = `M ${toX(0).toFixed(1)},${(pt+ch).toFixed(1)} L ${pts.join(' L ')} L ${toX(ds.data.length-1).toFixed(1)},${(pt+ch).toFixed(1)} Z`;
    svg += `<path d="${areaD}" fill="url(#${uid}-a${di})"/>`;
    const lineD = ds.data.map((v,i) => `${i===0?'M':'L'} ${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ');
    svg += `<path d="${lineD}" fill="none" stroke="${ds.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    ds.data.forEach((v,i) => {
      svg += `<circle cx="${toX(i).toFixed(1)}" cy="${toY(v).toFixed(1)}" r="3" fill="#545454" stroke="${ds.color}" stroke-width="1.5"/>`;
    });
  });
  svg += '</svg>';
  return svg;
}

// Build an artist's play timeseries from the backend daily snapshots
// (data/snapshots/*, loaded into allSnapshots) — the real series, ascending.
function buildArtistPlaySeries(username) {
  const snaps = (typeof allSnapshots !== 'undefined' ? allSnapshots : []);
  return [...snaps]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(s => {
      const rec = (s.artists || {})[username];
      return rec ? { date: s.date, plays: rec.total_plays || 0, followers: rec.followers || 0, likes: rec.total_likes || 0, reposts: rec.total_reposts || 0 } : null;
    })
    .filter(Boolean);
}

// The four auto-tracked panel metrics. Tiles + the big chart both key off this.
const PANEL_METRICS = [
  { key: 'followers', label: 'Followers' },
  { key: 'plays',     label: 'Plays' },
  { key: 'likes',     label: 'Likes' },
  { key: 'reposts',   label: 'Reposts' },
];
let activeMetric = 'plays';

// Render the <metric>-over-time chart into #playsChart (raw series, dips and all).
function renderMetricChart(username) {
  const el = document.getElementById('playsChart');
  if (!el) return;
  const m = PANEL_METRICS.find(m => m.key === activeMetric) || PANEL_METRICS[1];
  const titleEl = document.getElementById('metricChartTitle');
  if (titleEl) titleEl.textContent = `${m.label} over time`;
  const series = buildArtistPlaySeries(username);
  if (series.length < 2) {
    const tail = series.length === 1 ? ` Latest: ${fmt(series[0][m.key])} ${m.label.toLowerCase()}.` : '';
    el.innerHTML = `<div class="chart-empty">Tracking builds daily — charts appear after a couple of days of snapshots.${tail}</div>`;
    return;
  }
  const labels = series.map(s => (s.date || '').slice(5));   // MM-DD
  const datasets = [{ label: m.label, color: '#ff4500', data: series.map(s => s[m.key] || 0) }];
  el.innerHTML = buildLineChart(datasets, labels, 660, 200);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB SWITCHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const CAVE_TABS = ['cave','foraging','clan','footprints'];
// Tabs that live inside the Firepit pill — switching to any of these keeps
// the FIREPIT top-pill active and the firepit subnav visible.
const FIREPIT_TABS = ['firepit','events','brands'];

document.querySelectorAll('.htab[data-tab], .cave-subtab, .corner-link').forEach(btn => {
  // Firepit subnav buttons use data-subtab instead of data-tab — handled below.
  if (btn.dataset.subtab) return;
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Firepit subnav dispatch: SUMMONS→events, FORGE/STASH/TRAILMAP→firepit+mode,
// BRAND KITS→brands. Each click routes to switchTab + optionally sets the
// firepit internal mode.
document.querySelectorAll('#firepitSubnav .cave-subtab').forEach(btn => {
  btn.addEventListener('click', () => {
    const sub = btn.dataset.subtab;
    if (sub === 'summons')         { switchTab('events'); }
    else if (sub === 'brandkits')  { switchTab('brands'); }
    else { // forge | stash | trailmap
      switchTab('firepit');
      if (typeof setFirepitMode === 'function') setFirepitMode(sub, null);
    }
  });
});

// Brand pill (top-left) → re-show the splash overlay (logo + pulse).
// Any click/scroll/keypress on the splash dismisses it back to the dashboard.
document.querySelectorAll('.htab[data-action="splash"]').forEach(btn => {
  btn.addEventListener('click', () => {
    if (typeof window.scShowSplash === 'function') window.scShowSplash();
  });
});

function switchTab(name) {
  currentTab = name;
  ['home','events','cave','foraging','clan','footprints','firepit','brands','reflection','index'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
  // Top-level nav: Cave group stays "active" for any cave sub-section.
  // Firepit group keeps FIREPIT pill active for events + brands subtabs too.
  // Home/Index are reached via the bottom-right corner-nav, not the top pills.
  const TOP_TABS = ['cave','firepit','reflection'];
  const topGroup = CAVE_TABS.includes(name) ? 'cave'
                  : FIREPIT_TABS.includes(name) ? 'firepit'
                  : (TOP_TABS.includes(name) ? name : null);
  document.querySelectorAll('.htab[data-tab]').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === topGroup);
  });
  // Corner-nav active state
  document.querySelectorAll('.corner-link').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === name);
  });
  // Cave sub-nav visibility + active state
  const subnav = document.getElementById('caveSubnav');
  if (subnav) {
    subnav.style.display = CAVE_TABS.includes(name) ? 'flex' : 'none';
    subnav.querySelectorAll('.cave-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.tab === name);
    });
  }
  // Firepit sub-nav visibility + active state.
  // SUMMONS=events, BRAND KITS=brands; FORGE/STASH/TRAILMAP all map to firepit
  // (the specific mode is set by setFirepitMode).
  const fpsub = document.getElementById('firepitSubnav');
  if (fpsub) {
    fpsub.style.display = FIREPIT_TABS.includes(name) ? 'flex' : 'none';
    const subFor = name === 'events' ? 'summons'
                 : name === 'brands' ? 'brandkits'
                 : (window._firepitMode || 'forge');
    fpsub.querySelectorAll('.cave-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.subtab === subFor);
    });
  }
  if (name === 'home')       renderHome();
  if (name === 'cave')       renderCave();
  if (name === 'foraging')   renderForaging();
  if (name === 'clan')       renderClan();
  if (name === 'footprints') renderFootprints();
  if (name === 'firepit')    renderFirepit();
  if (name === 'events' && typeof window.renderEvents === 'function') window.renderEvents();
  if (name === 'brands' && typeof window.refreshBrands === 'function') window.refreshBrands();
  if (name === 'reflection' && typeof window.refreshReflection === 'function') window.refreshReflection();
}

function renderHome() {
  // Static page — content is in HTML
}

function refreshCurrentTab() {
  switchTab(currentTab);
}

function updateCounts() {
  const favs = Object.values(getFavourites());
  const active = favs.filter(a => a.status !== 'cut');
  const el = document.getElementById('clanCount');
  if (el) el.textContent = active.length || '';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// DATA LOADING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function fetchJSON(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(r.status);
  return r.json();
}

async function init() {
  let manifest = null;
  try { manifest = await fetchJSON('data/manifest.json'); } catch(e) {}

  // Load weekly reports
  if (manifest && manifest.weeks && manifest.weeks.length) {
    for (const file of [...manifest.weeks].reverse()) {
      try { const d = await fetchJSON(`data/${file}`); if (d) allReports.push(d); } catch(e) {}
    }
  }
  // Pull the roster from the account into the localStorage cache (no-op when
  // signed out). Source of truth lives on the account — see roster_sync.js.
  await window.rosterSync?.loadRoster();

  if (allReports.length) {
    currentData = allReports[0];
    syncFavouriteSnapshots();
  }

  // Load daily snapshots
  if (manifest && manifest.snapshots && manifest.snapshots.length) {
    for (const file of manifest.snapshots) {
      try { const d = await fetchJSON(`data/snapshots/${file}`); if (d) allSnapshots.push(d); } catch(e) {}
    }
    if (allSnapshots.length) {
      syncDailySnapshots();
      console.log(`Loaded ${allSnapshots.length} daily snapshot(s)`);
    }
  }

  // Populate genre filter
  const genres = new Set();
  allReports.forEach(r => (r.tracks||[]).forEach(t => { if (t.genre) genres.add(t.genre); }));
  const sel = document.getElementById('filterGenre');
  [...genres].sort().forEach(g => {
    sel.innerHTML += `<option value="${esc(g)}">${esc(g)}</option>`;
  });
  updateCounts();
  // Default landing comes from `currentTab` (line 217 — promoter-first = events).
  const cornerNav = document.getElementById('cornerNav');
  if (cornerNav) cornerNav.hidden = false;
  switchTab(currentTab);
}

function syncFavouriteSnapshots() {
  const favs = getFavourites();
  if (!Object.keys(favs).length) return;
  for (const report of allReports) {
    for (const track of (report.tracks||[])) {
      const u = track.artist_username;
      if (favs[u]) {
        addSnapshot(favs, u, track);
        addTrackSeen(favs, u, track);
      }
    }
  }
  saveFavourites(favs);
}

function syncDailySnapshots() {
  const favs = getFavourites();
  if (!Object.keys(favs).length) return;

  for (const snapshot of allSnapshots) {
    const date = snapshot.date;
    const artists = snapshot.artists || {};

    for (const [username, data] of Object.entries(artists)) {
      if (!favs[username]) continue;
      const snaps = favs[username].snapshots;

      if (snaps.find(s => s.date === date)) continue;

      snaps.push({
        date:          date,
        followers:     data.followers || 0,
        plays:         data.total_plays || 0,
        likes:         data.total_likes || 0,
        reposts:       data.total_reposts || 0,
        playlist_adds: favs[username].playlist_adds || null,
        score:         0,
        source:        'daily',
      });
    }

    for (const a of Object.values(favs)) {
      if (a.snapshots) {
        a.snapshots.sort((a, b) => a.date.localeCompare(b.date));
      }
    }
  }
  saveFavourites(favs);
}

function getArtistTimeSeries(username) {
  return allSnapshots
    .filter(s => s.artists && s.artists[username])
    .map(s => ({ date: s.date, ...s.artists[username] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ARTIST DETAIL PANEL (slide-out)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// When viewing a non-clan artist we hold a transient (unsaved) object here so
// the panel can render read-only WITHOUT writing to the Clan. Cleared on add.
let _panelTransient = null;

// Resolve the source track for a username from live search results (foraging)
// first, then the weekly scout reports.
function findReportTrack(username) {
  try {
    if (typeof liveSearchResults !== 'undefined' && Array.isArray(liveSearchResults)) {
      const lt = liveSearchResults.find(t => t.artist_username === username);
      if (lt) return lt;
    }
  } catch (e) { /* foraging.js not loaded */ }
  for (const r of (allReports || [])) {
    const t = (r.tracks || []).find(t => t.artist_username === username);
    if (t) return t;
  }
  return null;
}

// Build a read-only artist object from a track — mirrors the favourites shape
// enough for renderPanel, but is never persisted unless the user adds to Clan.
function transientArtistFromTrack(username, track) {
  const t = track || {};
  const user = t.user || {};
  return {
    username,
    display_name: t.artist || username,
    genre:        t.genre || '',
    avatar_url:   t.avatar_url || user.avatar_url || '',
    artist_url:   t.artist_url || user.permalink_url || '#',
    platforms:    {},
    snapshots:    [],
    tracks_seen:  t.title ? [{ title: t.title, url: t.url, date: today(), score: t.score }] : [],
    starred:      false,
    status:       'active',
    notes:        '',
    _transient:   true,
    _track:       t,
  };
}

function openPanel(username) {
  const favs = getFavourites();
  // Opening a panel must NEVER add to the Clan (was the auto-add bug). A
  // non-clan artist renders from a transient object; adding is a deliberate
  // click on the "Add to Clan" button only.
  _panelTransient = favs[username] ? null : transientArtistFromTrack(username, findReportTrack(username));
  activeArtist = username;
  activeMetric = 'plays';
  renderPanel(username);
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById('artistPanel').classList.add('open');
  refreshArtistLive(username);
}

// The ONLY UI path that writes a viewed artist into the Clan.
function addArtistToClan(username) {
  const track = (_panelTransient && _panelTransient._track) || findReportTrack(username) || { artist_username: username };
  addFavourite(track);
  _panelTransient = null;
  renderPanel(username);
  refreshCurrentTab();
}

async function refreshArtistLive(username) {
  const apiBase = scApiBase();
  try {
    const r = await fetch(`${apiBase}/api/artist/${encodeURIComponent(username)}`);
    if (!r.ok) return;
    const live = await r.json();
    const liveObj = {
      followers: live.follower_count,
      plays: live.play_count,
      likes: live.like_count,
      track_count: live.track_count,
      avatar_url: live.avatar_url,
      updated_at: live.updated_at,
      age_seconds: live.age_seconds || 0,
    };
    // top_tracks only arrives on an API cache miss — persist the latest set so
    // the panel always has a top 5 between refreshes.
    if (Array.isArray(live.top_tracks) && live.top_tracks.length) {
      const cache = getTopTracksCache();
      cache[username] = live.top_tracks;
      saveTopTracksCache(cache);
    }
    const favs = getFavourites();
    if (favs[username]) {
      favs[username].live = liveObj;          // clan member (in-memory only)
    } else if (_panelTransient && _panelTransient.username === username) {
      _panelTransient.live = liveObj;          // transient view
    } else {
      return;
    }
    // In-memory only — don't persist live values to localStorage (they expire).
    if (activeArtist === username) renderPanel(username);
  } catch (e) {
    // Silent fail — panel stays on cached values.
  }
}

function closePanel() {
  document.getElementById('panelOverlay').classList.remove('open');
  document.getElementById('artistPanel').classList.remove('open');
  activeArtist = null;
}

// Esc closes the artist modal (registered once at load).
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && document.getElementById('artistPanel')?.classList.contains('open')) closePanel();
});

function renderPanel(username) {
  const favs = getFavourites();
  const isClan = !!favs[username];
  const a = isClan ? favs[username] : _panelTransient;
  if (!a) return;

  // Editable / clan-only sections are hidden for read-only (non-clan) views.
  ['platformGrid','panelNotesSection','panelActionRow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isClan ? '' : 'none';
  });
  const addSec = document.getElementById('panelAddClanSection');
  if (addSec) addSec.style.display = isClan ? 'none' : '';

  const avatarHTML = a.avatar_url
    ? `<img src="${a.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.textContent='·'">`
    : '·';
  document.getElementById('panelAvatar').innerHTML = avatarHTML;
  document.getElementById('panelName').textContent = a.display_name;
  document.getElementById('panelGenre').textContent = a.genre;
  document.getElementById('panelSCLink').href = a.artist_url;

  // Star toggle — inline SVG so it takes the brand orange (emoji stars render
  // gold and can't be CSS-coloured). Wired via listener, no inline JS.
  const starEl = document.getElementById('panelStar');
  if (starEl) {
    const starSvg = `<svg viewBox="0 0 24 24" width="20" height="20" fill="${a.starred ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l2.95 6.1 6.55.83-4.82 4.52 1.25 6.55L12 17.3l-5.93 3.2 1.25-6.55L2.5 9.43l6.55-.83z"/></svg>`;
    starEl.innerHTML = `<span class="panel-star ${a.starred?'starred':''}" role="button" tabindex="0" title="Star this artist" aria-pressed="${!!a.starred}">${starSvg}</span>`;
    const star = starEl.firstElementChild;
    star.addEventListener('click', () => togglePanelStar(username));
    star.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); togglePanelStar(username); } });
  }

  // Metric tiles — one auto-tracked graphic per metric (spec:
  // artist_modal_v3_visual_stats.md). Series come from the backend daily
  // snapshots; "now" values prefer the live API, never manual input.
  const snaps = a.snapshots||[];
  const latest = snaps[snaps.length-1]||{};
  const daysTracked = a.added_date ? daysBetween(a.added_date, today()) : 0;
  const live = a.live || null;
  const bkSeries = buildArtistPlaySeries(username);
  const bk = bkSeries.length ? bkSeries[bkSeries.length - 1] : null;
  // Prefer live API, then the backend daily series (same source as the charts
  // — keeps tile numbers and chart in agreement). Local snapshots last: scout
  // entries hold single-track stats, not artist totals.
  const nowVals = {
    followers: live ? live.followers : (bk?.followers ?? latest.followers ?? 0),
    plays:     live ? live.plays     : (bk?.plays     ?? latest.plays     ?? 0),
    likes:     live ? live.likes     : (bk?.likes     ?? latest.likes     ?? 0),
    reposts:   bk?.reposts ?? (latest.reposts || 0),
  };
  const syncedHint = live
    ? `<span class="panel-growth-tag" style="background:#1a4d2e;color:#a7f3d0">● Live · synced ${live.age_seconds < 60 ? 'just now' : Math.floor(live.age_seconds/60)+'m ago'}</span>`
    : '';

  const growthEl = document.getElementById('panelGrowth');
  if (growthEl) {
    const tiles = PANEL_METRICS.map(m => {
      const data = bkSeries.map(s => s[m.key] || 0);
      // No delta from a zero baseline (the % is meaningless); cap runaway ones.
      let t = (data.length >= 2 && data[0] > 0) ? getTrend(data[0], data[data.length-1]) : null;
      if (t && t.pct > 999) t = { ...t, label: '+999%+' };
      return `<button type="button" class="metric-tile ${m.key === activeMetric ? 'active' : ''}" data-metric="${m.key}" title="Show ${m.label.toLowerCase()} over time">
        <span class="metric-tile-top">
          <span class="metric-tile-label">${m.label}</span>
          ${t ? `<span class="metric-tile-delta ${t.cls}">${t.arrow} ${t.label}</span>` : ''}
        </span>
        <span class="metric-tile-val">${fmt(nowVals[m.key])}</span>
        <span class="metric-tile-spark">${data.length >= 2 ? buildSparkline(data, 150, 34, '#ff4500') : '<span class="metric-tile-flat"></span>'}</span>
      </button>`;
    }).join('');

    growthEl.innerHTML = `
      <div class="metric-tiles">${tiles}</div>
      <div class="panel-growth-row">
        ${syncedHint}
        ${daysTracked > 0 ? `<span class="panel-growth-tag">TRACKED ${daysTracked} DAYS</span>` : ''}
        ${bkSeries.length < 2 ? '<span class="panel-growth-tag">CHARTS BUILD DAILY — AUTO-TRACKED, NO MANUAL ENTRY</span>' : ''}
      </div>`;

    growthEl.querySelectorAll('.metric-tile').forEach(tile => {
      tile.addEventListener('click', () => {
        activeMetric = tile.dataset.metric;
        growthEl.querySelectorAll('.metric-tile').forEach(t => t.classList.toggle('active', t === tile));
        renderMetricChart(username);
      });
    });
  }

  // Platform links — compact horizontal marks (icon-only, name on hover).
  // Click a dim mark to add a URL inline; click a bright (linked) mark to open
  // it; hover a linked mark for a ✎ pencil to edit. Handlers are wired via JS
  // (not inline onclick) so usernames never sit inside attribute-embedded JS.
  const platformChips = PLATFORMS.map(p => {
    const url = (a.platforms||{})[p] || '';
    const linked = !!url;
    const shown = linked ? url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'add link';
    return `<span class="plat-chip ${linked ? 'linked' : ''}" data-platform="${p}" title="${esc(PLAT_LABELS[p])} · ${esc(shown)}">
      <span class="plat-chip-ico" data-act="primary" role="button" tabindex="0" aria-label="${esc(PLAT_LABELS[p])}">${PLAT_ICONS[p]}</span>
      ${linked ? `<span class="plat-chip-edit" data-act="edit" role="button" tabindex="0" aria-label="Edit ${esc(PLAT_LABELS[p])} link">✎</span>` : ''}
    </span>`;
  }).join('');
  const grid = document.getElementById('platformGrid');
  grid.innerHTML = `<div class="platform-row">${platformChips}</div><div class="plat-edit" id="platEdit" hidden></div>`;
  grid.querySelectorAll('.plat-chip').forEach(chip => {
    const p = chip.dataset.platform;
    const primary = chip.querySelector('[data-act="primary"]');
    primary.addEventListener('click', () => platformPrimary(username, p));
    primary.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); platformPrimary(username, p); } });
    const ed = chip.querySelector('[data-act="edit"]');
    if (ed) {
      ed.addEventListener('click', (e) => { e.stopPropagation(); openPlatformEdit(username, p); });
      ed.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlatformEdit(username, p); } });
    }
  });

  // Metric chart — backend daily snapshots, switched by the tiles above.
  renderMetricChart(username);

  // Suggested tracks — top 5: scout-discovered first (they carry a score),
  // then the artist's live top tracks by plays, deduped by URL/title.
  const seen = (a.tracks_seen||[]).map(t => ({ ...t, _scout: true }));
  const liveTop = getTopTracksCache()[username] || [];
  const merged = [...seen];
  for (const t of liveTop) {
    const dupe = merged.find(m =>
      (m.url && t.url && m.url.replace(/\/$/,'') === t.url.replace(/\/$/,'')) ||
      (m.title && t.title && m.title.toLowerCase() === t.title.toLowerCase()));
    if (!dupe) merged.push(t);
  }
  const tracks = merged.slice(0, 5);
  document.getElementById('tracksSeen').innerHTML = tracks.length
    ? tracks.map(t => `
        <div class="track-row">
          <div class="track-row-info">
            <div class="track-row-title">${esc(t.title)}</div>
            <div class="track-row-meta">${esc(t.date || '')}${t._scout ? ` · Score ${t.score?.toFixed(1)||'—'}` : (t.plays != null ? ` · ${fmt(t.plays)} plays` : '')}</div>
          </div>
          ${t.url ? `<a class="track-row-play" href="${esc(t.url)}" target="_blank" rel="noopener" title="Listen on SoundCloud">▶</a>` : ''}
        </div>`).join('')
    : '<div style="color:var(--muted);font-size:13px">No tracks recorded yet.</div>';

  document.getElementById('artistNotes').value = a.notes||'';
  document.getElementById('cutBtn').textContent = a.status === 'cut' ? 'RESTORE TO TRACKING' : 'CUT FROM TRACKING';
}

function togglePanelStar(username) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].starred = !favs[username].starred;
  saveFavourites(favs);
  renderPanel(username);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REFLECTION TAB (Phase B — profile + account actions as a page)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function initReflection() {
  const emailEl   = document.getElementById('reflectionEmail');
  const avatarEl  = document.getElementById('reflectionAvatar');
  const tierEl    = document.getElementById('reflectionTier');
  const credEl    = document.getElementById('reflectionCredits');
  const socEl     = document.getElementById('reflectionSocials');
  const outBtn    = document.getElementById('reflectionSignOut');
  const upgradeBtn = document.getElementById('reflectionUpgrade');
  const manageBtn  = document.getElementById('reflectionManageBilling');
  const connectBtn = document.getElementById('reflectionConnectSocials');
  const pwdToggle  = document.getElementById('reflectionSetPassword');
  const pwdForm    = document.getElementById('reflectionPwdForm');
  const pwdInput   = document.getElementById('reflectionPwdInput');
  const pwdSave    = document.getElementById('reflectionPwdSave');
  const pwdMsg     = document.getElementById('reflectionPwdMsg');
  if (!emailEl) return;

  async function hydrate() {
    try {
      const apiBase = scApiBase();
      const r = await scAuth.authedFetch(`${apiBase}/api/me`);
      if (!r.ok) return;
      const me = await r.json();
      emailEl.textContent = me.email || '';
      avatarEl.textContent = (me.email || '?')[0];
      tierEl.textContent = me.tier || '—';
      credEl.textContent = me.credits_balance != null ? me.credits_balance : '—';
      manageBtn.hidden = !(me.tier && me.tier !== 'solo');
      try {
        const sr = await scAuth.authedFetch(`${apiBase}/api/ayrshare/profiles`);
        if (sr.ok) {
          const sj = await sr.json();
          socEl.textContent = sj.platforms?.length ? `${sj.platforms.length} connected` : 'none';
        }
      } catch {}
    } catch (e) { console.warn('reflection hydrate failed', e); }
  }
  window.refreshReflection = hydrate;

  outBtn.addEventListener('click', () => scAuth.signOut());
  upgradeBtn.addEventListener('click', () => openBillingModal());
  manageBtn.addEventListener('click', () => openBillingPortal());
  pwdToggle.addEventListener('click', () => {
    pwdForm.hidden = !pwdForm.hidden;
    pwdMsg.textContent = '';
    if (!pwdForm.hidden) setTimeout(() => pwdInput.focus(), 50);
  });
  pwdSave.addEventListener('click', async () => {
    const password = pwdInput.value;
    if (!password || password.length < 6) {
      pwdMsg.textContent = 'Use at least 6 characters.';
      pwdMsg.className = 'cave-login-msg error';
      return;
    }
    pwdSave.disabled = true;
    pwdMsg.textContent = '';
    const { error } = await scAuth.setPassword(password);
    pwdSave.disabled = false;
    if (error) {
      pwdMsg.textContent = error;
      pwdMsg.className = 'cave-login-msg error';
    } else {
      pwdMsg.textContent = 'Password saved.';
      pwdMsg.className = 'cave-login-msg success';
      pwdInput.value = '';
      setTimeout(() => { pwdForm.hidden = true; }, 1200);
    }
  });
  connectBtn.addEventListener('click', async () => {
    const apiBase = scApiBase();
    try {
      const r = await scAuth.authedFetch(`${apiBase}/api/ayrshare/connect-url`);
      const j = await r.json();
      if (j.url) window.open(j.url, '_blank', 'noopener');
    } catch (e) {
      alert(`Couldn't open Ayrshare: ${e.message}`);
    }
  });

  // Password-recovery deep link: switch to Reflection tab + reveal the form.
  function openRecoveryFlow() {
    if (typeof switchTab === 'function') switchTab('reflection');
    pwdForm.hidden = false;
    pwdMsg.textContent = 'Set a new password to finish recovery.';
    pwdMsg.className = 'cave-login-msg';
    setTimeout(() => pwdInput.focus(), 50);
  }

  scAuth.ready.then(async () => {
    if (await scAuth.session()) hydrate();
    scAuth.onChange((event) => {
      if (event === 'SIGNED_IN') hydrate();
      if (event === 'PASSWORD_RECOVERY') { hydrate(); openRecoveryFlow(); }
    });
  }).catch(() => {});

  if (location.search.includes('billing=success')) {
    setTimeout(() => hydrate(), 1500);
  }
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// BILLING MODAL (Phase D)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
async function openBillingModal() {
  const modal = document.getElementById('billingModal');
  const cards = document.getElementById('billingCards');
  const pack  = document.getElementById('billingPack');
  const note  = document.getElementById('billingNote');
  const apiBase = scApiBase();
  modal.hidden = false;
  note.textContent = '';
  note.className = 'billing-note';
  cards.innerHTML = '<div style="grid-column:1/-1;text-align:center;color:var(--muted)">Loading plans…</div>';
  pack.innerHTML = '';

  try {
    const r = await fetch(`${apiBase}/api/billing/plans`);
    const data = await r.json();
    const fmt = (p) => `£${(p / 100).toFixed(0)}`;

    cards.innerHTML = data.plans.map(p => `
      <div class="plan-card${p.highlighted ? ' highlighted' : ''}">
        ${p.highlighted ? '<div class="plan-badge">Most popular</div>' : ''}
        <div class="plan-name">${p.name}</div>
        <div class="plan-price">${fmt(p.price_pence)}<span class="plan-price-period"> /mo</span></div>
        <div class="plan-credits">${p.credits.toLocaleString()} credits / month</div>
        <ul class="plan-features">
          <li>All content types</li>
          <li>Image generation</li>
          <li>SoundCloud scouting</li>
          <li>Stash + Trail Map</li>
        </ul>
        <button class="plan-cta" data-lookup="${p.lookup_key}" data-tier="${p.tier}">Subscribe</button>
      </div>
    `).join('');

    pack.innerHTML = `
      <div class="billing-pack-info">Top up: <strong>${data.pack.credits} credits</strong> for ${fmt(data.pack.price_pence)} — one-off, no subscription.</div>
      <button data-lookup="${data.pack.lookup_key}">Buy pack</button>
    `;

    if (!data.configured) {
      note.textContent = 'Stripe is not configured on the server (STRIPE_SECRET_KEY missing). Subscribe will fail until set.';
      note.className = 'billing-note error';
    }

    modal.querySelectorAll('button[data-lookup]').forEach(btn => {
      btn.addEventListener('click', () => startCheckout(btn));
    });
  } catch (e) {
    note.textContent = `Failed to load plans: ${e.message}`;
    note.className = 'billing-note error';
  }
}

async function startCheckout(btn) {
  const apiBase = scApiBase();
  const lookup_key = btn.dataset.lookup;
  const orig = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Redirecting…';
  try {
    const r = await scAuth.authedFetch(`${apiBase}/api/billing/checkout`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({lookup_key}),
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `${r.status}`);
    window.location.href = data.url;
  } catch (e) {
    btn.disabled = false;
    btn.textContent = orig;
    const note = document.getElementById('billingNote');
    note.textContent = `Checkout failed: ${e.message}`;
    note.className = 'billing-note error';
  }
}

async function openBillingPortal() {
  const apiBase = scApiBase();
  try {
    const r = await scAuth.authedFetch(`${apiBase}/api/billing/portal`, {method: 'POST'});
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || `${r.status}`);
    window.location.href = data.url;
  } catch (e) {
    alert(`Couldn't open billing portal: ${e.message}`);
  }
}

(function bindBillingModalDismiss() {
  const modal = document.getElementById('billingModal');
  if (!modal) return;
  const close = () => { modal.hidden = true; };
  document.getElementById('billingClose')?.addEventListener('click', close);
  document.getElementById('billingBackdrop')?.addEventListener('click', close);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.hidden) close(); });
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
init();
