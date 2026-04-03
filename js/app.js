// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SPLASH SCREEN
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
(function initSplash() {
  const splash   = document.getElementById('splashOverlay');
  const cave     = document.getElementById('caveEntrance');
  const appWrap  = document.getElementById('appWrap');
  const logo     = splash.querySelector('.splash-logo');

  if (sessionStorage.getItem('sc_splash_done')) {
    splash.classList.add('hidden');
    cave.classList.add('hidden');
    appWrap.classList.add('revealed');
    return;
  }

  // Phase 1: logo visible for 1.2s, then fade it out
  setTimeout(() => {
    logo.classList.add('fade-out');

    // Phase 2: after logo fades (0.4s), hide splash & open cave
    setTimeout(() => {
      splash.classList.add('hidden');
      cave.classList.add('open');
      appWrap.classList.add('revealed');

      // Phase 3: cleanup after cave animation (1.6s)
      setTimeout(() => {
        cave.classList.add('hidden');
      }, 1700);

      sessionStorage.setItem('sc_splash_done', '1');
    }, 400);
  }, 1200);
})();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let allReports  = [];
let currentData = null;
let currentTab  = 'home';
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
const PLAT_ICONS  = { spotify:'🟢', youtube:'▶️', instagram:'📸', tiktok:'🎵', beatport:'🎧', bandcamp:'🎸', discogs:'💿' };
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
}

function addSnapshot(favs, username, track) {
  const snap = {
    date:          today(),
    followers:     track.followers || 0,
    plays:         track.plays || 0,
    likes:         track.likes || 0,
    reposts:       track.reposts || 0,
    playlist_adds: favs[username].playlist_adds || null,
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
  const favs = getFavourites();
  delete favs[activeArtist];
  saveFavourites(favs);
  closePanel();
  updateCounts();
  refreshCurrentTab();
}

function toggleCut() {
  if (!activeArtist) return;
  const favs = getFavourites();
  if (!favs[activeArtist]) return;
  favs[activeArtist].status = favs[activeArtist].status === 'cut' ? 'active' : 'cut';
  saveFavourites(favs);
  document.getElementById('cutBtn').textContent = favs[activeArtist].status === 'cut' ? '♻️ Restore to tracking' : '✂️ Cut from tracking';
  refreshCurrentTab();
}

function savePlatform(username, platform, value) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].platforms[platform] = value.trim();
  saveFavourites(favs);
}

function saveNotes() {
  if (!activeArtist) return;
  const favs = getFavourites();
  if (!favs[activeArtist]) return;
  favs[activeArtist].notes = document.getElementById('artistNotes').value;
  saveFavourites(favs);
}

function saveManualData() {
  if (!activeArtist) return;
  const favs = getFavourites();
  if (!favs[activeArtist]) return;
  const snaps = favs[activeArtist].snapshots;
  const followers = parseInt(document.getElementById('manualFollowers').value);
  const playlists = parseInt(document.getElementById('manualPlaylists').value);
  if (!isNaN(followers)) {
    favs[activeArtist].followers_override = followers;
    if (snaps.length) snaps[snaps.length-1].followers = followers;
  }
  if (!isNaN(playlists)) {
    favs[activeArtist].playlist_adds = playlists;
    if (snaps.length) snaps[snaps.length-1].playlist_adds = playlists;
  }
  saveFavourites(favs);
  renderPanel(activeArtist);
  refreshCurrentTab();
}

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
  return `<svg width="${w}" height="${h}" style="display:block">
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB SWITCHING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
document.querySelectorAll('.htab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Logo click → Home
document.querySelector('.logo').addEventListener('click', () => switchTab('home'));
document.querySelector('.logo').style.cursor = 'pointer';

function switchTab(name) {
  currentTab = name;
  ['home','cave','foraging','clan','footprints','firepit'].forEach(t => {
    const el = document.getElementById(`tab-${t}`);
    if (el) el.style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('.htab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === name);
  });
  if (name === 'home')       renderHome();
  if (name === 'cave')       renderCave();
  if (name === 'foraging')   renderForaging();
  if (name === 'clan')       renderClan();
  if (name === 'footprints') renderFootprints();
  if (name === 'firepit')    renderFirepit();
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
  document.getElementById('clanCount').textContent = active.length || '';
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
  switchTab('home');
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
function openPanel(username) {
  const favs = getFavourites();
  if (!favs[username]) {
    for (const r of allReports) {
      const track = (r.tracks||[]).find(t => t.artist_username === username);
      if (track) { addFavourite(track); break; }
    }
  }
  activeArtist = username;
  renderPanel(username);
  document.getElementById('panelOverlay').classList.add('open');
  document.getElementById('artistPanel').classList.add('open');
}

function closePanel() {
  document.getElementById('panelOverlay').classList.remove('open');
  document.getElementById('artistPanel').classList.remove('open');
  activeArtist = null;
}

function renderPanel(username) {
  const favs = getFavourites();
  const a = favs[username];
  if (!a) return;

  const avatarHTML = a.avatar_url
    ? `<img src="${a.avatar_url}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentElement.innerHTML='🎵'">`
    : '🎵';
  document.getElementById('panelAvatar').innerHTML = avatarHTML;
  document.getElementById('panelName').textContent = a.display_name;
  document.getElementById('panelGenre').textContent = a.genre;
  document.getElementById('panelSCLink').href = a.artist_url;

  // Star toggle
  const starEl = document.getElementById('panelStar');
  if (starEl) {
    starEl.innerHTML = `<span class="panel-star ${a.starred?'starred':''}" onclick="togglePanelStar('${esc(username)}')" title="Star this artist">${a.starred?'⭐':'☆'}</span>`;
  }

  // Tracking duration + growth rates
  const snaps = a.snapshots||[];
  const latest = snaps[snaps.length-1]||{};
  const first = snaps[0]||{};
  const daysTracked = a.added_date ? daysBetween(a.added_date, today()) : 0;
  const followers = a.followers_override != null ? a.followers_override : (latest.followers||0);

  const growthEl = document.getElementById('panelGrowth');
  if (growthEl) {
    const fGrowth = first.followers ? (((latest.followers||0) - first.followers) / first.followers * 100).toFixed(1) : null;
    const pGrowth = first.plays ? (((latest.plays||0) - first.plays) / first.plays * 100).toFixed(1) : null;
    const lGrowth = first.likes ? (((latest.likes||0) - first.likes) / first.likes * 100).toFixed(1) : null;

    growthEl.innerHTML = `
      <div class="panel-stats-row">
        <div class="panel-stat"><span class="panel-stat-val">${fmt(followers)}</span><span class="panel-stat-label">Followers</span></div>
        <div class="panel-stat"><span class="panel-stat-val">${fmt(latest.plays||0)}</span><span class="panel-stat-label">Plays</span></div>
        <div class="panel-stat"><span class="panel-stat-val">${fmt(latest.likes||0)}</span><span class="panel-stat-label">Likes</span></div>
        <div class="panel-stat"><span class="panel-stat-val">${fmt(latest.reposts||0)}</span><span class="panel-stat-label">Reposts</span></div>
      </div>
      <div class="panel-growth-row">
        ${daysTracked > 0 ? `<span class="panel-growth-tag">📅 Tracked ${daysTracked} days</span>` : ''}
        ${fGrowth !== null ? `<span class="panel-growth-tag ${parseFloat(fGrowth)>=0?'up':'down'}">Followers ${parseFloat(fGrowth)>=0?'+':''}${fGrowth}%</span>` : ''}
        ${pGrowth !== null ? `<span class="panel-growth-tag ${parseFloat(pGrowth)>=0?'up':'down'}">Plays ${parseFloat(pGrowth)>=0?'+':''}${pGrowth}%</span>` : ''}
        ${lGrowth !== null ? `<span class="panel-growth-tag ${parseFloat(lGrowth)>=0?'up':'down'}">Likes ${parseFloat(lGrowth)>=0?'+':''}${lGrowth}%</span>` : ''}
      </div>
      ${snaps.length >= 2 ? `<div style="margin-top:12px">${buildSparkline(snaps.map(s=>s.followers||0), 260, 40, '#e63946')}</div>` : ''}`;
  }

  // Platform links — logos with hover-to-paste
  document.getElementById('platformGrid').innerHTML = PLATFORMS.map(p => {
    const url = (a.platforms||{})[p] || '';
    const linked = !!url;
    return `<div class="plat-hover-row ${linked?'linked':''}" title="${PLAT_LABELS[p]}">
      <div class="plat-icon-btn ${linked?'linked':''}" onclick="this.nextElementSibling.classList.toggle('show')">${PLAT_ICONS[p]}</div>
      <div class="plat-hover-input ${linked?'show':''}">
        <input class="plat-input" placeholder="${PLAT_LABELS[p]} URL" value="${esc(url)}"
          onblur="savePlatform('${username}','${p}',this.value);this.closest('.plat-hover-row').classList.toggle('linked',!!this.value)">
        ${linked ? `<a href="${url.startsWith('http')?url:'https://'+url}" target="_blank" rel="noopener" class="plat-open">↗</a>` : ''}
      </div>
    </div>`;
  }).join('');

  // Snapshot history
  document.getElementById('snapBody').innerHTML = snaps.length
    ? [...snaps].reverse().map(s => `
        <tr>
          <td>${s.date}</td>
          <td>${fmt(s.followers)}</td>
          <td>${fmt(s.plays)}</td>
          <td>${fmt(s.likes)}</td>
          <td>${fmt(s.reposts)}</td>
          <td>${s.playlist_adds!=null?s.playlist_adds:'—'}</td>
          <td style="color:var(--red)">${(s.score||0).toFixed(1)}</td>
        </tr>`).join('')
    : '<tr><td colspan="7" style="color:var(--muted);padding:10px">No snapshots yet.</td></tr>';

  document.getElementById('manualFollowers').value = a.followers_override != null ? a.followers_override : (latest.followers||'');
  document.getElementById('manualPlaylists').value = latest.playlist_adds != null ? latest.playlist_adds : '';

  // Suggested tracks (from tracks_seen)
  const tracks = a.tracks_seen||[];
  document.getElementById('tracksSeen').innerHTML = `
    <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--heading)">Suggested Tracks</h4>
    ${tracks.length
      ? tracks.map(t => `
        <div style="background:var(--elevated);border-radius:8px;padding:10px 12px;margin-bottom:6px;display:flex;justify-content:space-between;align-items:center">
          <div style="overflow:hidden">
            <div style="font-size:13px;font-weight:bold;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.title)}</div>
            <div style="font-size:11px;color:var(--secondary)">${t.date} · Score ${t.score?.toFixed(1)||'—'}</div>
          </div>
          ${t.url ? `<a href="${t.url}" target="_blank" rel="noopener" style="color:var(--red);font-size:18px;text-decoration:none" title="Listen on SoundCloud">▶</a>` : ''}
        </div>`).join('')
      : '<div style="color:var(--muted);font-size:13px">No tracks recorded yet.</div>'}`;

  document.getElementById('artistNotes').value = a.notes||'';
  document.getElementById('cutBtn').textContent = a.status === 'cut' ? '♻️ Restore to tracking' : '✂️ Cut from tracking';
}

function togglePanelStar(username) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].starred = !favs[username].starred;
  saveFavourites(favs);
  renderPanel(username);
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// INIT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
init();
