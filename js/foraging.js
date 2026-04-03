// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: FORAGING (Discovery)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let forageSubTab = 'manual';
let searchLimit = 20;
let liveSearchResults = [];

function setForageSubTab(tab, btn) {
  forageSubTab = tab;
  document.querySelectorAll('.forage-tab').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['manual','scheduled','running'].forEach(t => {
    const el = document.getElementById(`forage-${t}`);
    if (el) el.style.display = t === tab ? 'block' : 'none';
  });
  if (tab === 'scheduled') renderScheduledSearches();
  if (tab === 'running') renderRunningSearches();
}

function setSearchLimit(n, btn) {
  searchLimit = n;
  document.querySelectorAll('.forage-limit-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

// ── Scheduled searches (localStorage) ──────────────────
function getScheduledSearches() { return JSON.parse(localStorage.getItem('sc_scheduled_searches') || '[]'); }
function saveScheduledSearches(d) { localStorage.setItem('sc_scheduled_searches', JSON.stringify(d)); }

function saveScheduledSearch() {
  const name = document.getElementById('schedName')?.value?.trim();
  if (!name) { alert('Give your search a name'); return; }
  const searches = getScheduledSearches();
  searches.push({
    id: 's_' + Date.now(),
    name,
    genre: document.getElementById('schedGenre')?.value || '',
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
  renderScheduledSearches();
}

function deleteScheduledSearch(id) {
  let searches = getScheduledSearches().filter(s => s.id !== id);
  saveScheduledSearches(searches);
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
  if (!searches.length) {
    el.innerHTML = `<div class="empty"><div class="ico">📅</div><p>No scheduled searches yet. Create one above.</p></div>`;
    return;
  }
  el.innerHTML = searches.map(s => `
    <div class="schedule-item">
      <div class="schedule-info">
        <div class="schedule-name">${esc(s.name)}</div>
        <div class="schedule-details">
          ${s.genre ? esc(s.genre) : 'All genres'} ·
          ${s.min_followers ? fmt(s.min_followers)+'+' : 'No min'} followers ·
          ${esc(s.frequency)} · Max ${s.limit} results
          ${s.active ? '<span style="color:var(--green)"> · Active</span>' : '<span style="color:var(--muted)"> · Paused</span>'}
        </div>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn-outline" style="padding:5px 10px;font-size:11px" onclick="toggleScheduledSearch('${s.id}')">${s.active ? '⏸ Pause' : '▶ Resume'}</button>
        <button class="btn-outline" style="padding:5px 10px;font-size:11px;color:var(--muted)" onclick="deleteScheduledSearch('${s.id}')">🗑️</button>
      </div>
    </div>`).join('');
}

function renderRunningSearches() {
  const searches = getScheduledSearches().filter(s => s.active);
  const el = document.getElementById('runningSearchList');
  if (!searches.length) {
    el.innerHTML = `<div class="empty"><div class="ico">⚡</div><p>No active scheduled searches. Create and activate searches in the Scheduled tab.</p></div>`;
    return;
  }
  el.innerHTML = `
    <div style="margin-bottom:12px">
      <p style="font-size:12px;color:var(--secondary)">These searches run automatically via GitHub Actions. Manage them in the Scheduled tab.</p>
    </div>
    ${searches.map(s => `
      <div class="schedule-item">
        <div class="schedule-info">
          <div class="schedule-name" style="color:var(--green)">⚡ ${esc(s.name)}</div>
          <div class="schedule-details">
            ${s.genre ? esc(s.genre) : 'All genres'} · ${esc(s.frequency)} · Max ${s.limit}
            ${s.last_run ? ' · Last: '+s.last_run : ' · Not yet run'}
          </div>
        </div>
        <span class="schedule-badge">Active</span>
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
    <span>🔍 Searching SoundCloud<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
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
    el.innerHTML = '<p style="color:var(--muted);font-size:13px;padding:12px 0">No results found. Try broadening your search criteria.</p>';
    return;
  }
  el.innerHTML = `<h3 class="section-title">Search Results (${liveSearchResults.length})</h3>` +
    liveSearchResults.map(t => buildForageCard(t, 'rotation')).join('');
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
  // Populate genre filters
  const genres = new Set();
  allReports.forEach(r => (r.tracks||[]).forEach(t => { if (t.genre) genres.add(t.genre); }));
  ['filterGenre','schedGenre'].forEach(id => {
    const sel = document.getElementById(id);
    if (sel && sel.options.length <= 1) {
      [...genres].sort().forEach(g => {
        sel.innerHTML += `<option value="${esc(g)}">${esc(g)}</option>`;
      });
    }
  });

  // Only render report-based results if no live search was done
  if (liveSearchResults.length) {
    renderLiveResults();
    return;
  }

  if (!allReports.length) {
    document.getElementById('foragingRotation').innerHTML = `
      <div class="empty"><div class="ico">🏹</div><p>No reports yet. Run a live search above or run <code>scout.py</code> to generate the first weekly report.</p></div>`;
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

  const watchingArtists = [];
  watching.forEach(username => {
    for (const r of allReports) {
      const t = (r.tracks||[]).find(t => t.artist_username === username);
      if (t) { watchingArtists.push({...t, discoveredDate: r.date}); break; }
    }
  });

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
    <div style="margin-bottom:28px">
      <h3 class="section-title">This Week's Rotation</h3>
      ${currentTracks.length ? currentTracks.map(t => buildForageCard(t, 'rotation')).join('') :
        '<p style="color:var(--muted);font-size:13px;padding:12px 0">No artists in current rotation. Run a live search or <code>scout.py</code>.</p>'}
    </div>`;

  let prevHTML = '<h3 class="section-title">Previously Discovered</h3>';
  if (watchingArtists.length) {
    prevHTML += `<div style="margin-bottom:18px">
      <div class="section-label">👁️ Watching</div>
      ${watchingArtists.map(t => buildForageCard(t, 'watching')).join('')}
    </div>`;
  }
  if (pendingArtists.length) {
    prevHTML += `<div>
      <div class="section-label">⏳ Pending</div>
      ${pendingArtists.map(t => buildForageCard(t, 'pending')).join('')}
    </div>`;
  }
  if (!watchingArtists.length && !pendingArtists.length) {
    prevHTML += '<p style="color:var(--muted);font-size:13px">No previously discovered artists.</p>';
  }
  document.getElementById('foragingPrevious').innerHTML = prevHTML;
}

function buildForageCard(t, source) {
  const username = t.artist_username || '';
  const timerHTML = source === 'pending' && t.daysLeft != null ?
    `<div class="forage-timer ${t.daysLeft < 14 ? 'urgent' : 'normal'}">⏳ ${t.daysLeft} days until auto-cut</div>` : '';

  const clanBtn = `<button class="action-btn clan-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','clan')"><span class="icon">🦴</span>Clan</button>`;
  const watchBtn = source !== 'watching' ?
    `<button class="action-btn watch-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','watch')"><span class="icon">👁️</span>Watch</button>` : '';
  const cutBtn = `<button class="action-btn cut-btn" onclick="event.stopPropagation();forageAction('${esc(username)}','cut')"><span class="icon">✂️</span>Cut</button>`;

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
  // Remove from live results
  liveSearchResults = liveSearchResults.filter(t => t.artist_username !== username);
  updateCounts();
  renderForaging();
}
