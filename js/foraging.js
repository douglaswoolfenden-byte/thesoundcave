// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: FORAGING (Discovery)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let forageSubTab = 'manual';
let searchLimit = 20;
let liveSearchResults = [];

// Orange "watch" eye used in the empty-state hint — matches the eye on the
// Watch button (buildForageCard), forced to the brand orange so it reads as a
// real icon, not the old 👁 emoji.
const WATCH_EYE_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="#ff4500" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:-2px" aria-hidden="true"><path d="M1.75 8C4 4.75 6 4 8 4s4 .75 6.25 4"/><path d="M1.75 8C4 11.25 6 12 8 12s4-.75 6.25-4"/><circle cx="8" cy="8" r="1.25" fill="#ff4500" stroke="none"/></svg>';

function setForageSubTab(tab, btn) {
  forageSubTab = tab;
  document.querySelectorAll('.forage-tab').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['manual','scheduled','running'].forEach(t => {
    const el = document.getElementById(`forage-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'scheduled') loadScheduledSearches().then(renderScheduledSearches);
  if (tab === 'running') renderRunningSearches();
}

function setSearchLimit(n, btn) {
  searchLimit = n;
  document.querySelectorAll('.forage-limit-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── Scheduled searches (API-backed, localStorage fallback) ──────
// Source of truth is data/scheduled_searches.json (written by content_api when
// running locally; the weekly GitHub Action runs the searches). An in-memory
// cache lets the render functions stay synchronous.
let _scheduledCache = null;

function getScheduledSearches() {
  if (_scheduledCache) return _scheduledCache;
  _scheduledCache = JSON.parse(localStorage.getItem('sc_scheduled_searches') || '[]');
  return _scheduledCache;
}

async function loadScheduledSearches() {
  const apiUrl = localStorage.getItem('sc_api_url') || 'http://localhost:8000';
  try {
    const r = await fetch(`${apiUrl}/api/scheduled-searches`);
    if (r.ok) {
      const d = await r.json();
      if (Array.isArray(d)) { _scheduledCache = d; localStorage.setItem('sc_scheduled_searches', JSON.stringify(d)); return d; }
    }
  } catch (e) { /* API offline — fall back to the local copy */ }
  _scheduledCache = JSON.parse(localStorage.getItem('sc_scheduled_searches') || '[]');
  return _scheduledCache;
}

function saveScheduledSearches(d) {
  _scheduledCache = d;
  localStorage.setItem('sc_scheduled_searches', JSON.stringify(d));   // always keep a local copy
  const apiUrl = localStorage.getItem('sc_api_url') || 'http://localhost:8000';
  fetch(`${apiUrl}/api/scheduled-searches`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(d),
  }).catch(() => { /* offline — the local copy holds until next sync */ });
}

// Human-readable filter summary for a saved search (mirrors the Python side).
function schedFiltersText(s) {
  const parts = [];
  if (s.genre)         parts.push(s.genre);
  if (s.keyword)       parts.push(`"${s.keyword}"`);
  if (s.min_followers) parts.push(`${fmt(s.min_followers)}+ followers`);
  if (s.max_followers) parts.push(`≤${fmt(s.max_followers)} followers`);
  return parts.join(' · ') || 'All genres';
}

function saveScheduledSearch() {
  const name = document.getElementById('schedName')?.value?.trim();
  if (!name) { alert('Give your search a name'); return; }
  const searches = getScheduledSearches();
  searches.push({
    id: 's_' + Date.now(),
    name,
    genre: document.getElementById('schedGenre')?.value || '',
    keyword: document.getElementById('schedKeyword')?.value?.trim() || '',
    min_followers: parseInt(document.getElementById('schedMinFollow')?.value) || 0,
    max_followers: parseInt(document.getElementById('schedMaxFollow')?.value) || 0,
    frequency: document.getElementById('schedFreq')?.value || 'weekly',
    limit: parseInt(document.getElementById('schedLimit')?.value) || 50,
    created: today(),
    last_run: null,
    active: true,
  });
  saveScheduledSearches(searches);
  document.getElementById('schedName').value = '';
  const kw = document.getElementById('schedKeyword'); if (kw) kw.value = '';
  renderScheduledSearches();
}

function deleteScheduledSearch(id) {
  saveScheduledSearches(getScheduledSearches().filter(s => s.id !== id));
  renderScheduledSearches();
  renderRunningSearches();
}

function toggleScheduledSearch(id) {
  const searches = getScheduledSearches();
  const s = searches.find(x => x.id === id);
  if (s) s.active = !s.active;
  saveScheduledSearches(searches);
  renderScheduledSearches();
  renderRunningSearches();
}

function renderScheduledSearches() {
  const searches = getScheduledSearches();
  const el = document.getElementById('scheduledSearchList');
  if (!el) return;
  if (!searches.length) {
    el.innerHTML = `<div class="empty"><p>No scheduled searches yet. Create one above.</p></div>`;
    return;
  }
  el.innerHTML = searches.map(s => `
    <div class="schedule-item">
      <div class="schedule-info">
        <div class="schedule-name">${esc(s.name)}</div>
        <div class="schedule-details">
          ${esc(schedFiltersText(s))} · ${esc(s.frequency)} · Max ${s.limit}
          ${s.active ? '<span style="color:var(--green)"> · Active</span>' : '<span style="color:var(--muted)"> · Paused</span>'}
          ${s.last_run ? ' · Last run ' + esc(s.last_run) : ' · Not yet run'}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-outline" style="padding:5px 10px;font-size:11px" onclick="toggleScheduledSearch('${s.id}')">${s.active ? 'PAUSE' : 'RESUME'}</button>
        <button class="btn-outline" style="padding:5px 10px;font-size:11px;color:var(--muted)" onclick="deleteScheduledSearch('${s.id}')">DELETE</button>
      </div>
    </div>`).join('');
}

// Running tab = real results, grouped by search. Pulls data/searches/<id>.json
// (written by scheduled_scout.py / the weekly Action), filtered against the
// Clan / dismissed / watching lists so triage stays clean.
async function renderRunningSearches() {
  const el = document.getElementById('runningSearchList');
  if (!el) return;
  el.innerHTML = `<div class="empty"><p>Loading scheduled results…</p></div>`;
  const searches = await loadScheduledSearches();
  if (!searches.length) {
    el.innerHTML = `<div class="empty"><p>No scheduled searches yet. Create and activate one in the Scheduled tab — they run weekly via GitHub Actions.</p></div>`;
    return;
  }
  const favs = getFavourites(), dismissed = getDismissed(), watching = getWatching();
  const groups = [];
  for (const s of searches) {
    let result = null;
    try {
      const r = await fetch(`data/searches/${s.id}.json?t=${Date.now()}`);
      if (r.ok) result = await r.json();
    } catch (e) { /* not run yet */ }
    const all = result ? (result.tracks || []) : [];
    const fresh = all.filter(t => !favs[t.artist_username] && !dismissed.includes(t.artist_username) && !watching.includes(t.artist_username));
    groups.push({ s, result, fresh, total: all.length });
  }
  el.innerHTML = `
    <p style="font-size:12px;color:var(--secondary);margin-bottom:14px">Scheduled searches run weekly via GitHub Actions. Each block shows that search's latest results — keep (Clan), watch, or cut.</p>
    ${groups.map(g => `
      <div class="forage-col" style="margin-bottom:18px">
        <div class="forage-col-header">
          <div>
            <div class="forage-col-title">${esc(g.s.name)}${g.s.active ? '' : ' <span style="color:var(--muted)">(paused)</span>'}</div>
            <div class="schedule-details">${esc(schedFiltersText(g.s))}${g.result?.date ? ' · last run ' + esc(g.result.date) : ' · not yet run'}</div>
          </div>
          <div class="forage-col-count accent">${g.fresh.length}</div>
        </div>
        ${g.result
          ? (g.fresh.length
              ? `<div class="forage-col-body">${g.fresh.map(t => buildForageCard(t, 'rotation')).join('')}</div>`
              : `<div class="forage-col-empty">All ${g.total} result(s) triaged — nothing new.</div>`)
          : `<div class="forage-col-empty">Not run yet. Runs weekly, or trigger the “Scheduled Searches” workflow manually on GitHub.</div>`}
      </div>`).join('')}`;
}

// ── Live search (calls API) ────────────────────────────
async function runLiveSearch() {
  const genre = document.getElementById('filterGenre')?.value || '';
  const minF  = parseInt(document.getElementById('filterMinFollow')?.value) || 0;
  const maxF  = parseInt(document.getElementById('filterMaxFollow')?.value) || 0;
  const keyword = document.getElementById('filterName')?.value?.trim() || '';

  const statusEl = document.getElementById('liveSearchStatus');
  statusEl.style.display = 'block';
  statusEl.innerHTML = `<div class="card" style="text-align:center;padding:30px;color:var(--secondary)">
    <span>SEARCHING SOUNDCLOUD<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
  </div>`;

  const apiUrl = localStorage.getItem('sc_api_url') || 'http://localhost:8000';
  const params = new URLSearchParams();
  if (genre) params.set('genre', genre);
  if (minF) params.set('min_followers', minF);
  if (maxF) params.set('max_followers', maxF);
  if (keyword) params.set('keyword', keyword);
  params.set('limit', searchLimit);

  try {
    const r = await fetch(`${apiUrl}/api/search?${params}`);
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    const data = await r.json();
    liveSearchResults = data.tracks || data || [];
    statusEl.innerHTML = `<div style="font-size:12px;color:var(--secondary);margin-bottom:12px">Found ${liveSearchResults.length} artist(s)</div>`;
    renderLiveResults();
  } catch(e) {
    statusEl.innerHTML = `<div class="card" style="text-align:center;padding:20px">
      <span style="color:var(--red)">⚠️ ${e.message}</span>
      <p style="color:var(--muted);font-size:11px;margin-top:6px">Make sure content_api.py is running: <code>python content_api.py</code></p>
    </div>`;
  }
}

function renderLiveResults() {
  const el = document.getElementById('foragingRotation');
  if (!liveSearchResults.length) {
    el.innerHTML = `
      <div class="forage-col">
        <div class="forage-col-header"><div class="forage-col-title">Search results</div><div class="forage-col-count">0</div></div>
        <div class="forage-col-empty">No results found. Try broadening your search criteria.</div>
      </div>`;
    return;
  }
  el.innerHTML = `
    <div class="forage-col">
      <div class="forage-col-header">
        <div>
          <div class="forage-col-title">Search results</div>
          <div class="schedule-details">${esc(manualFiltersText())}</div>
        </div>
        <div class="forage-col-count accent">${liveSearchResults.length}</div>
      </div>
      <div class="forage-col-body">${liveSearchResults.map(t => buildForageCard(t, 'rotation')).join('')}</div>
    </div>`;
}

// Filter summary for the manual live search — so it's obvious which filters
// produced the current results (parity with scheduled-search labelling).
function manualFiltersText() {
  const g = document.getElementById('filterGenre')?.value || '';
  const kw = document.getElementById('filterName')?.value?.trim() || '';
  const min = parseInt(document.getElementById('filterMinFollow')?.value) || 0;
  const max = parseInt(document.getElementById('filterMaxFollow')?.value) || 0;
  const parts = [];
  if (g)  parts.push(g);
  if (kw) parts.push(`"${kw}"`);
  if (min) parts.push(`${fmt(min)}+ followers`);
  if (max) parts.push(`≤${fmt(max)} followers`);
  return parts.join(' · ') || 'All genres';
}

function toggleFilters() {
  filtersOpen = !filtersOpen;
}

function setSearchMode(mode, btn) {
  searchMode = mode;
}

function runSearch() {
  renderForaging();
}

function renderForaging() {
  // Seed shared datalist for filterGenre + schedGenre comboboxes.
  // Curated cross-industry suggestions; merged with case-folded genres
  // already seen in past scout reports so SoundCloud's free-text dupes
  // ("Tech House" / "tech house" / "TECH HOUSE") collapse to one.
  const dl = document.getElementById('genreSuggestions');
  if (dl && !dl.options.length) {
    const SEED = [
      'house','deep house','tech house','afro house','afro tech','melodic house','progressive house',
      'garage','uk garage','2-step','bassline','speed garage',
      'drum and bass','jungle','liquid dnb','neurofunk','breaks','breakbeat',
      'techno','minimal techno','melodic techno','hard techno','industrial techno',
      'dubstep','dub','140','grime',
      'ambient','downtempo','idm','electronica','lo-fi','trip-hop',
      'trance','psytrance','goa','hardcore','gabber','hardstyle',
      'footwork','juke','jersey club','baltimore club','phonk','vaporwave',
      'hip-hop','rap','trap','drill','boom bap','cloud rap',
      'r&b','neo-soul','soul','funk','jazz','nu-jazz',
      'afrobeats','amapiano','gqom','kuduro','baile funk','dancehall','reggae','reggaeton','dembow','shatta','zouk',
      'pop','indie','rock','post-punk','shoegaze','experimental','soundtrack','classical'
    ];
    const seen = new Map();
    SEED.forEach(g => seen.set(g.toLowerCase(), g));
    allReports.forEach(r => (r.tracks||[]).forEach(t => {
      if (!t.genre) return;
      const k = t.genre.trim().toLowerCase();
      if (k && !seen.has(k)) seen.set(k, t.genre.trim());
    }));
    [...seen.values()].sort((a,b) => a.localeCompare(b)).forEach(g => {
      const opt = document.createElement('option');
      opt.value = g;
      dl.appendChild(opt);
    });
  }

  // Always render the watching column — it's independent of search mode
  renderForagingWatching();

  // Only render report-based results if no live search was done
  if (liveSearchResults.length) {
    renderLiveResults();
    return;
  }

  if (!allReports.length) {
    document.getElementById('foragingRotation').innerHTML = `
      <div class="empty"><p>No reports yet. Run a live search above or run <code>scout.py</code> to generate the first weekly report.</p></div>`;
    document.getElementById('foragingPrevious').innerHTML = '';
    return;
  }

  const favs = getFavourites();
  const dismissed = getDismissed();
  const watching = getWatching();
  const autoCutDays = parseInt(document.getElementById('autoCutSelect').value) || 90;

  const nameFilter  = (document.getElementById('filterName').value||'').toLowerCase();
  const genreFilter = document.getElementById('filterGenre').value;
  const minF = parseInt(document.getElementById('filterMinFollow').value) || 0;
  const maxF = parseInt(document.getElementById('filterMaxFollow').value) || Infinity;

  function matchesFilters(t) {
    if (nameFilter && !(t.artist||'').toLowerCase().includes(nameFilter)) return false;
    if (genreFilter && t.genre !== genreFilter) return false;
    if ((t.followers||0) < minF) return false;
    if ((t.followers||0) > maxF) return false;
    return true;
  }

  const currentTracks = (currentData ? currentData.tracks||[] : [])
    .filter(t => !favs[t.artist_username] && !dismissed.includes(t.artist_username) && !watching.includes(t.artist_username))
    .filter(matchesFilters);

  const currentUsernames = new Set((currentData ? currentData.tracks||[] : []).map(t => t.artist_username));
  const pendingArtists = [];
  allReports.slice(1).forEach(report => {
    (report.tracks||[]).forEach(t => {
      if (!favs[t.artist_username] && !dismissed.includes(t.artist_username) &&
          !watching.includes(t.artist_username) && !currentUsernames.has(t.artist_username) &&
          !pendingArtists.find(p => p.artist_username === t.artist_username)) {
        const daysOld = daysBetween(report.date, today());
        if (daysOld < autoCutDays) {
          pendingArtists.push({...t, discoveredDate: report.date, daysLeft: autoCutDays - daysOld});
        }
      }
    });
  });

  document.getElementById('foragingRotation').innerHTML = `
    <div class="forage-col">
      <div class="forage-col-header">
        <div class="forage-col-title">This week's rotation</div>
        <div class="forage-col-count accent">${currentTracks.length}</div>
      </div>
      ${currentTracks.length
        ? `<div class="forage-col-body">${currentTracks.map(t => buildForageCard(t, 'rotation')).join('')}</div>`
        : '<div class="forage-col-empty">No artists in current rotation. Run a live search or scout.py.</div>'}
    </div>`;

  // Previously Discovered now contains ONLY Pending (Watching moved to top-right column)
  const prevEl = document.getElementById('foragingPrevious');
  if (pendingArtists.length) {
    prevEl.innerHTML = `
      <h3 class="section-title" style="margin-top:0">Previously discovered</h3>
      <div class="section-label">⏳ Pending</div>
      ${pendingArtists.map(t => buildForageCard(t, 'pending')).join('')}`;
  } else {
    prevEl.innerHTML = '';
  }
}

function renderForagingWatching() {
  const el = document.getElementById('foragingWatching');
  if (!el) return;
  const watching = getWatching();
  const watchingArtists = [];
  watching.forEach(username => {
    for (const r of (typeof allReports !== 'undefined' ? allReports : [])) {
      const t = (r.tracks||[]).find(t => t.artist_username === username);
      if (t) { watchingArtists.push({...t, discoveredDate: r.date}); break; }
    }
  });
  el.innerHTML = `
    <div class="forage-col">
      <div class="forage-col-header">
        <div class="forage-col-title">Watching</div>
        <div class="forage-col-count">${watchingArtists.length}</div>
      </div>
      ${watchingArtists.length
        ? `<div class="forage-col-body">${watchingArtists.map(t => buildForageCard(t, 'watching')).join('')}</div>`
        : `<div class="forage-col-empty">No artists being watched. Hit ${WATCH_EYE_ICON} Watch on a card to track an artist without adding to your Clan.</div>`}
    </div>`;
}

function buildForageCard(t, source) {
  const username = t.artist_username || '';
  const timerHTML = source === 'pending' && t.daysLeft != null ?
    `<div class="forage-timer ${t.daysLeft < 14 ? 'urgent' : 'normal'}">⏳ ${t.daysLeft} days until auto-cut</div>` : '';

  const clanIcon = `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="3.5" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12.5" cy="5.5" r="1.4" fill="currentColor" stroke="none"/><circle cx="8" cy="4" r="1.5" fill="currentColor" stroke="none"/><path d="M1.5 12.5 Q8 8.25 14.5 12.5"/></svg>`;
  const watchIcon = `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1.75 8C4 4.75 6 4 8 4s4 .75 6.25 4"/><path d="M1.75 8C4 11.25 6 12 8 12s4-.75 6.25-4"/><circle cx="8" cy="8" r="1.25" fill="currentColor" stroke="none"/></svg>`;
  const cutIcon = `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13.5 2 L6 9.5 L7.5 11 L15 3.5 Z" fill="currentColor" stroke="none"/><path d="M5 10.5 L7 12.5"/><path d="M2.5 13 L5 10.5"/><path d="M1.5 15 L4 12.5"/></svg>`;
  const clanBtn = `<button class="action-btn clan-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','clan')">${clanIcon}Clan</button>`;
  const watchBtn = source !== 'watching' ?
    `<button class="action-btn watch-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','watch')">${watchIcon}Watch</button>` : '';
  const cutBtn = `<button class="action-btn cut-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','cut')">${cutIcon}Cut</button>`;

  return `<div class="forage-card" onclick="openPanel('${esc(username)}')">
    <div class="forage-info">
      <div class="forage-name">${esc(t.artist)}</div>
      <div class="forage-meta">${esc(t.genre)} · ${fmt(t.followers)} followers</div>
      <div class="forage-track">🎵 ${esc(t.title)}</div>
      ${timerHTML}
    </div>
    <div class="forage-actions">
      ${clanBtn}${watchBtn}${cutBtn}
    </div>
  </div>`;
}

function forageAction(username, action) {
  if (action === 'clan') {
    // Check live results first, then reports
    let track = liveSearchResults.find(t => t.artist_username === username);
    if (!track) {
      for (const r of allReports) {
        track = (r.tracks||[]).find(t => t.artist_username === username);
        if (track) break;
      }
    }
    if (track) addFavourite(track);
    saveWatching(getWatching().filter(u => u !== username));
  } else if (action === 'watch') {
    const w = getWatching();
    if (!w.includes(username)) { w.push(username); saveWatching(w); }
  } else if (action === 'cut') {
    const d = getDismissed();
    if (!d.includes(username)) { d.push(username); saveDismissed(d); }
    saveWatching(getWatching().filter(u => u !== username));
  }
  // Persist the foraging curation state to the account (no-op when signed out).
  window.rosterSync?.pushPrefs();
  // Remove from live results
  liveSearchResults = liveSearchResults.filter(t => t.artist_username !== username);
  updateCounts();
  renderForaging();
}
