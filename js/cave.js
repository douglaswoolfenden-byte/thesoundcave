// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: THE CAVE (Dashboard) — redesigned 2026-05-12
// Spec: wiki/spec/cave_dashboard_redesign.md
// Hero is a diagonal stack of Clan artists; front card = focus.
// Floating glass panels for stats; chart strip below.
// All HTML interpolation passes through the project's `esc()` helper.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

let _caveFocusIndex = 0;
let _caveWheelLock = false;
let _caveClanCache = [];
const STACK_VISIBLE_RADIUS = 4;

const setHTML = (el, html) => { if (el) { el['inner' + 'HTML'] = html; } };

// Legacy filter/export functions retained as no-ops in case anything still references them.
function getDashFilters() { return { genre:'', name:'', minF:0, maxF:Infinity }; }
function resetDashFilters() { renderCave(); }
function exportDashPDF() { window.print(); }
function exportDashEmail() {
  const clan = Object.values(getFavourites()).filter(a => a.status !== 'cut');
  const subject = encodeURIComponent('Sound Cave Dashboard Report');
  const body = encodeURIComponent(
    `Sound Cave Dashboard Report\nDate: ${today()}\nClan size: ${clan.length} artists\n\n` +
    clan.map(a => `- ${a.display_name} (${a.genre})`).join('\n')
  );
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function renderCave() {
  const favs = getFavourites();
  const clan = Object.values(favs).filter(a => a.status !== 'cut');
  _caveClanCache = clan;
  if (_caveFocusIndex >= clan.length) _caveFocusIndex = 0;

  renderCaveWelcome();
  renderCaveStack(clan);
  renderCaveStatPanels(clan);
  renderCaveGenrePanel(clan);
  renderCaveTracksPanel(clan);
  renderCaveChart(clan);
  updateStackMeta();
  attachStackInteractions();
  wireCaveStatInteractions();
}

// ━━━ Stat-widget drill-downs: click-only modal ━━━
// Spec: wiki/spec/cave_drilldown_graphics.md. Hover is a pure-CSS ring + lift
// (no dropdown — Doug's call 2026-06-10); detail appears only on click. Reuses
// the per-artist delta cache (window._caveStatDeltas) + genre/drops caches.
const CAVE_STAT_LABELS = { followers:'Followers gained', likes:'Likes gained', listens:'Listens gained', genre:'Genre mix', drops:'New drops' };

function wireCaveStatInteractions() {
  // Container divs persist in the DOM, so assigning .onX (not addEventListener)
  // is idempotent across re-renders — no duplicate handlers.
  [['caveFollowersPanel','followers'], ['caveLikesPanel','likes'], ['caveListensPanel','listens'],
   ['caveGenrePanel','genre'], ['caveTracksPanel','drops']]
    .forEach(([id, kind]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add('drillable');
      el.onclick = () => openCaveStatModal(kind);
    });
}

// Clan-aggregate timeseries for one metric across every backend snapshot day.
// Days where none of the clan appears are skipped (no fake zero dips).
function caveAggregateSeries(metric) {
  const field = { followers: 'followers', likes: 'total_likes', listens: 'total_plays' }[metric];
  if (!field) return [];
  const clanU = new Set(_caveClanCache.map(a => a.username));
  const snaps = (typeof allSnapshots !== 'undefined' ? allSnapshots : []);
  return [...snaps]
    .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
    .map(s => {
      let total = 0, n = 0;
      Object.entries(s.artists || {}).forEach(([u, rec]) => {
        if (clanU.has(u)) { total += rec[field] || 0; n++; }
      });
      return n ? { date: s.date, total } : null;
    })
    .filter(Boolean);
}

// Donut for the genre modal — brand-orange shade ramp, artist count centred.
const GENRE_RAMP = ['#ff4500', '#ff7a40', '#c43a08', '#ffb499', '#8a2f10', '#5c2410'];
function buildGenreDonut(rows, total) {
  const r = 54, cx = 70, cy = 70, C = 2 * Math.PI * r;
  let off = 0;
  const segs = rows.map(([, c], i) => {
    const frac = c / total;
    const seg = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${GENRE_RAMP[i % GENRE_RAMP.length]}"
      stroke-width="18" stroke-dasharray="${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}"
      stroke-dashoffset="${(-off * C).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"/>`;
    off += frac;
    return seg;
  }).join('');
  return `<svg viewBox="0 0 140 140" class="genre-donut" aria-hidden="true">${segs}
    <text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#e8e8e8" font-size="22" font-weight="700" font-family="DM Mono,monospace">${total}</text>
    <text x="${cx}" y="${cy + 16}" text-anchor="middle" fill="#888" font-size="9" letter-spacing="1" font-family="DM Mono,monospace">ARTISTS</text>
  </svg>`;
}

function openCaveStatModal(kind) {
  const modal = document.getElementById('caveStatModal');
  const body = document.getElementById('caveStatModalBody');
  const title = document.getElementById('caveStatModalTitle');
  if (!modal || !body) return;
  if (title) title.textContent = CAVE_STAT_LABELS[kind] || kind;
  body.innerHTML = caveStatModalBody(kind);
  // Attach row handlers via JS (not inline onclick) so the username never has
  // to be safe inside an HTML-attribute-embedded JS string literal.
  body.querySelectorAll('tr[data-user]').forEach(tr => {
    tr.addEventListener('click', () => { closeCaveStatModal(); openPanel(tr.dataset.user); });
  });
  modal.classList.add('open');
}

function closeCaveStatModal() {
  const modal = document.getElementById('caveStatModal');
  if (modal) modal.classList.remove('open');
}

function caveStatModalBody(kind) {
  if (kind === 'genre') {
    const g = window._caveGenreFull;
    if (!g || !g.rows.length) return '<div class="chart-empty">No genres yet — add artists to your Clan and the mix draws itself.</div>';
    return `<div class="stat-modal-genre-wrap">
      ${buildGenreDonut(g.rows, g.total)}
      <div class="stat-modal-list">` + g.rows.map(([name, c], i) => {
        const pct = Math.round((c / g.total) * 100);
        return `<div class="stat-modal-genre">
          <span class="smg-swatch" style="background:${GENRE_RAMP[i % GENRE_RAMP.length]}"></span>
          <span class="smg-name">${esc(name)}</span>
          <div class="panel-genre-bar"><div class="panel-genre-bar-fill" style="transform:scaleX(${pct / 100})"></div></div>
          <span class="smg-pct">${c} · ${pct}%</span>
        </div>`;
      }).join('') + `</div></div>`;
  }
  if (kind === 'drops') {
    const drops = window._caveDropsFull || [];
    if (!drops.length) return '<div class="chart-empty">No new drops from your Clan this week.</div>';
    return `<div class="stat-modal-list">` + drops.map(t => `
      <div class="stat-modal-drop">
        <div class="smd-info"><div class="smd-title">${esc(t.title)}</div><div class="smd-artist">${esc(t.artist)}</div></div>
        ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener" class="smd-play">▶</a>` : ''}
      </div>`).join('') + `</div>`;
  }
  // followers / likes / listens — graphic first: clan-aggregate line chart
  // over every snapshot day, ranked movers below as supporting detail.
  const series = caveAggregateSeries(kind);
  const chart = series.length >= 2
    ? buildLineChart(
        [{ label: CAVE_STAT_LABELS[kind], color: '#ff4500', data: series.map(s => s.total) }],
        series.map(s => (s.date || '').slice(5)), 560, 190)
    : `<div class="chart-empty">Baseline set today — the chart draws itself as daily snapshots land. No manual entry, ever.</div>`;

  const d = window._caveStatDeltas;
  const rows = (d && d.perArtist[kind]) || [];
  let movers = '';
  if (rows.length && d.spanDays > 0) {
    const span = d.spanDays === 7 ? 'this week' : `over ${d.spanDays} day${d.spanDays === 1 ? '' : 's'}`;
    movers = `<div class="stat-modal-sub">Top movers · ${rows.length} tracked artists · ${esc(span)}</div>
      <table class="stat-modal-table">
        <thead><tr><th>Artist</th><th>Current</th><th>Δ</th></tr></thead>
        <tbody>${rows.map(r => {
          const sign = r.delta >= 0 ? '+' : '';
          return `<tr data-user="${esc(r.username)}">
            <td>${esc(r.display)}</td>
            <td>${fmt(r.current)}</td>
            <td class="${r.delta >= 0 ? 'up' : 'down'}">${sign}${fmt(r.delta)}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>`;
  }
  return `<div class="stat-modal-chart">${chart}</div>${movers}`;
}

// Esc closes the stat modal (registered once at script load).
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCaveStatModal(); });

function renderCaveWelcome() {
  const el = document.getElementById('caveWelcome');
  setHTML(el, `
    <h1>Welcome back, Douglas</h1>
    <p>Here's what's echoing through the cave</p>`);
}

function renderCaveStack(clan) {
  const stage = document.getElementById('caveStack');
  if (!stage) return;
  if (!clan.length) {
    setHTML(stage, '');
    const hint = document.getElementById('caveScrollHint');
    if (hint) hint.style.display = 'none';
    setHTML(document.getElementById('caveStackMeta'), '');
    const existing = document.querySelector('.cave-hero .stack-empty');
    if (!existing) {
      const empty = document.createElement('div');
      empty.className = 'stack-empty';
      setHTML(empty, `
        <h3>Your cave is empty</h3>
        <p>Discover artists in Foraging, add them to your Clan, and they'll appear here as a stack to scroll through.</p>`);
      document.getElementById('caveHero').appendChild(empty);
    }
    return;
  }
  const emptyEl = document.querySelector('.cave-hero .stack-empty');
  if (emptyEl) emptyEl.remove();
  const hint = document.getElementById('caveScrollHint');
  if (hint) hint.style.display = '';

  const html = clan.map((a, i) => {
    const avatar = (a.avatar_url || '').replace('-large.', '-t500x500.');
    const name = a.display_name || a.username || '?';
    const initial = esc(name.trim()[0] || '?');
    const inner = avatar
      ? `<img src="${esc(avatar)}" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'">
         <div class="stack-card-fallback" style="display:none">${initial}</div>`
      : `<div class="stack-card-fallback">${initial}</div>`;
    return `
      <article class="stack-card" data-idx="${i}" data-username="${esc(a.username)}">
        ${inner}
        <div class="stack-card-caption">${esc(name)}</div>
      </article>`;
  }).join('');
  setHTML(stage, html);
  // Bind clicks programmatically (no inline handler) — username is external
  // SoundCloud data; an inline onclick string is an attribute-context XSS vector.
  // Mirrors the stat-modal row fix (see addEventListener above).
  stage.querySelectorAll('.stack-card').forEach(card => {
    card.addEventListener('click', () => openPanel(card.dataset.username));
  });
  applyStackOffsets();
}

function applyStackOffsets() {
  const cards = document.querySelectorAll('#caveStack .stack-card');
  const n = cards.length;
  if (!n) return;
  cards.forEach(card => {
    const i = parseInt(card.dataset.idx, 10);
    let raw = i - _caveFocusIndex;
    if (raw > n / 2) raw -= n;
    if (raw < -n / 2) raw += n;
    const abs = Math.abs(raw);
    card.style.setProperty('--offset', raw);
    card.style.setProperty('--abs', abs);
    if (abs > STACK_VISIBLE_RADIUS) card.dataset.hidden = 'true';
    else delete card.dataset.hidden;
    if (raw === 0) card.dataset.focus = 'true';
    else delete card.dataset.focus;
  });
}

function cycleStack(delta) {
  const n = _caveClanCache.length;
  if (!n) return;
  _caveFocusIndex = (_caveFocusIndex + delta + n) % n;
  applyStackOffsets();
  updateStackMeta();
}

function updateStackMeta() {
  const el = document.getElementById('caveStackMeta');
  if (!el) return;
  const a = _caveClanCache[_caveFocusIndex];
  if (!a) { setHTML(el, ''); return; }
  const snaps = a.snapshots || [];
  const latest = snaps[snaps.length - 1] || {};
  const followers = latest.followers || 0;
  setHTML(el, `
    <div class="stack-meta-name">${esc(a.display_name || a.username)}</div>
    <div class="stack-meta-sub">
      <span class="accent">${fmt(followers)}</span> followers · ${esc(a.genre || 'unknown')}
    </div>`);
}

function attachStackInteractions() {
  // Wheel cycles the stack only when the cursor is over the CENTER stage —
  // scrolling over the side rails scrolls the page (the rails own that gesture).
  const stage = document.getElementById('caveStage') || document.getElementById('caveHero');
  if (!stage || stage._stackBound) return;
  stage._stackBound = true;

  stage.addEventListener('wheel', (e) => {
    if (!_caveClanCache.length) return;
    if (_caveWheelLock) { e.preventDefault(); return; }
    const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
    if (Math.abs(delta) < 5) return;
    e.preventDefault();
    _caveWheelLock = true;
    cycleStack(delta > 0 ? 1 : -1);
    setTimeout(() => { _caveWheelLock = false; }, 220);
  }, { passive: false });

  document.addEventListener('keydown', (e) => {
    const cave = document.getElementById('tab-cave');
    if (!cave || cave.style.display === 'none') return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp')   { cycleStack(1);  e.preventDefault(); }
    if (e.key === 'ArrowLeft'  || e.key === 'ArrowDown') { cycleStack(-1); e.preventDefault(); }
  });
}

// Pick the latest snapshot + the one closest to N days before it.
// Returns {latest, baseline, spanDays} or null if no snapshots.
function pickSnapshotPair(snapshots, targetDays = 7) {
  if (!snapshots || !snapshots.length) return null;
  const sorted = [...snapshots].sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  const latest = sorted[sorted.length - 1];
  if (sorted.length === 1) return { latest, baseline: latest, spanDays: 0 };
  const latestMs = Date.parse(latest.date + 'T00:00:00Z');
  const targetMs = latestMs - targetDays * 86400000;
  let baseline = sorted[0];
  let bestDelta = Math.abs(Date.parse(sorted[0].date + 'T00:00:00Z') - targetMs);
  for (let i = 1; i < sorted.length - 1; i++) {
    const delta = Math.abs(Date.parse(sorted[i].date + 'T00:00:00Z') - targetMs);
    if (delta < bestDelta) { bestDelta = delta; baseline = sorted[i]; }
  }
  const spanDays = Math.round((latestMs - Date.parse(baseline.date + 'T00:00:00Z')) / 86400000);
  return { latest, baseline, spanDays };
}

function renderCaveStatPanels(clan) {
  const followersEl = document.getElementById('caveFollowersPanel');
  const likesEl = document.getElementById('caveLikesPanel');
  const listensEl = document.getElementById('caveListensPanel');
  const playlistEl = document.getElementById('cavePlaylistPanel');
  if (!followersEl || !likesEl) return;

  const snapshots = (typeof allSnapshots !== 'undefined') ? allSnapshots : [];
  const pair = pickSnapshotPair(snapshots, 7);

  // Zero snapshots → tracker hasn't fired yet
  if (!pair || !clan.length) {
    const msg = !clan.length
      ? 'add artists to start tracking'
      : 'tracking starts when the daily snapshot fires';
    setHTML(followersEl, `<div class="panel-label">Followers gained</div><div class="panel-empty">${msg}</div>`);
    setHTML(likesEl,     `<div class="panel-label">Likes gained</div><div class="panel-empty">${msg}</div>`);
    if (listensEl) setHTML(listensEl, `<div class="panel-label">Listens gained</div><div class="panel-empty">${msg}</div>`);
    if (playlistEl) setHTML(playlistEl, `<div class="panel-label">Playlist adds</div><div class="panel-empty">coming soon</div>`);
    window._caveStatDeltas = null;
    return;
  }

  // Per-artist deltas, cached for Phase 2 drill-downs.
  const perArtist = { followers: [], likes: [], listens: [] };
  let dF = 0, dL = 0, dP = 0;
  let coveredF = 0, coveredL = 0, coveredP = 0;
  const latestA = pair.latest.artists || {};
  const baselineA = pair.baseline.artists || {};
  clan.forEach(a => {
    const u = a.username;
    const cur = latestA[u];
    const base = baselineA[u];
    if (!cur) return;
    const display = cur.display_name || a.display_name || u;
    if (base) {
      const f = (cur.followers || 0)   - (base.followers || 0);
      const l = (cur.total_likes || 0) - (base.total_likes || 0);
      const p = (cur.total_plays || 0) - (base.total_plays || 0);
      dF += f; dL += l; dP += p;
      coveredF++; coveredL++; coveredP++;
      perArtist.followers.push({ username: u, display, delta: f, current: cur.followers || 0 });
      perArtist.likes.push    ({ username: u, display, delta: l, current: cur.total_likes || 0 });
      perArtist.listens.push  ({ username: u, display, delta: p, current: cur.total_plays || 0 });
    }
  });
  ['followers','likes','listens'].forEach(k => perArtist[k].sort((a, b) => b.delta - a.delta));
  window._caveStatDeltas = { perArtist, spanDays: pair.spanDays, latestDate: pair.latest.date, baselineDate: pair.baseline.date };

  const trendStr = pair.spanDays === 0 ? 'baseline set today'
                 : pair.spanDays === 7 ? 'this week'
                 : `over ${pair.spanDays} day${pair.spanDays === 1 ? '' : 's'}`;
  const renderStat = (label, delta, covered) => {
    if (pair.spanDays === 0) {
      return `<div class="panel-label">${label}</div><div class="panel-empty">baseline set today — deltas appear in 7 days</div>`;
    }
    const sign = delta >= 0 ? '+' : '';
    const arrow = delta >= 0 ? '▲' : '▼';
    const cls = delta >= 0 ? 'up' : 'down';
    const cov = covered < clan.length ? ` <span class="panel-coverage">· ${covered}/${clan.length} tracked</span>` : '';
    return `<div class="panel-label">${label}</div>
      <div class="panel-value">${sign}${fmt(delta)}</div>
      <div class="panel-trend ${cls}">${arrow} ${trendStr}${cov}</div>`;
  };

  setHTML(followersEl, renderStat('Followers gained', dF, coveredF));
  setHTML(likesEl,     renderStat('Likes gained',     dL, coveredL));
  if (listensEl)  setHTML(listensEl,  renderStat('Listens gained', dP, coveredP));
  if (playlistEl) setHTML(playlistEl, `<div class="panel-label">Playlist adds</div><div class="panel-empty">coming soon</div>`);
}

function renderCaveGenrePanel(clan) {
  const el = document.getElementById('caveGenrePanel');
  if (!el) return;
  if (!clan.length) {
    setHTML(el, `
      <div class="panel-label">Genre mix</div>
      <div class="panel-empty">add artists to see your mix</div>`);
    window._caveGenreFull = null;
    return;
  }
  const counts = {};
  clan.forEach(a => { const g = a.genre || 'unknown'; counts[g] = (counts[g] || 0) + 1; });
  const total = clan.length;
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  window._caveGenreFull = { rows: sorted, total };   // full breakdown for the click modal
  const top = sorted.slice(0, 5);
  setHTML(el, `
    <div class="panel-label">Genre mix</div>
    <div class="panel-genre-list">
      ${top.map(([g, c]) => {
        const pct = Math.round((c / total) * 100);
        return `<div class="panel-genre-row">
          <span style="min-width:64px">${esc(g)}</span>
          <div class="panel-genre-bar"><div class="panel-genre-bar-fill" style="transform:scaleX(${pct / 100})"></div></div>
          <span class="panel-genre-pct">${pct}%</span>
        </div>`;
      }).join('')}
    </div>`);
}

function renderCaveTracksPanel(clan) {
  const el = document.getElementById('caveTracksPanel');
  if (!el) return;
  const clanU = new Set(clan.map(a => a.username));
  const drops = [];
  if (typeof currentData !== 'undefined' && currentData) {
    (currentData.tracks || []).forEach(t => {
      if (clanU.has(t.artist_username)) {
        drops.push({ artist: t.artist, title: t.title, url: t.url });
      }
    });
  }
  window._caveDropsFull = drops;   // every clan drop this week for the click modal
  if (!drops.length) {
    setHTML(el, `
      <div class="panel-label">New drops</div>
      <div class="panel-empty">no new drops from your clan this week</div>`);
    return;
  }
  setHTML(el, `
    <div class="panel-label">New drops</div>
    <div class="panel-drops-list">
      ${drops.slice(0, 4).map(t => `
        <div class="panel-drop-row">
          <div class="panel-drop-title">${esc(t.title)} ${t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">▶</a>` : ''}</div>
          <div class="panel-drop-artist">${esc(t.artist)}</div>
        </div>`).join('')}
    </div>`);
}

function renderCaveChart(clan) {
  const el = document.getElementById('caveChart');
  if (!el) return;
  if (!clan.length || typeof allReports === 'undefined' || allReports.length < 2) {
    el.dataset.empty = 'true';
    setHTML(el, '');
    return;
  }
  const clanU = new Set(clan.map(a => a.username));
  const followers = [], likes = [], plays = [], plAdds = [];
  const labels = [];
  allReports.slice(0, 6).reverse().forEach(r => {
    let f = 0, l = 0, p = 0;
    (r.tracks || []).forEach(t => {
      if (clanU.has(t.artist_username)) {
        f += t.followers || 0;
        l += t.likes || 0;
        p += t.plays || 0;
      }
    });
    let pa = 0;
    clan.forEach(a => { pa += a.playlist_adds || 0; });
    followers.push(f); likes.push(l); plays.push(p); plAdds.push(pa);
    labels.push(r.date ? r.date.slice(5) : `Wk${r.week}`);
  });
  if (followers.length < 2) {
    el.dataset.empty = 'true';
    setHTML(el, '');
    return;
  }
  delete el.dataset.empty;
  setHTML(el, `
    <div class="strip-header">
      <div class="strip-title">Weekly stats · clan aggregate</div>
      <div class="strip-legend">
        <span style="color:#ff6a1f"><i></i>Followers</span>
        <span style="color:#e8e8e8"><i></i>Likes</span>
        <span style="color:#888"><i></i>Listens</span>
        <span style="color:#4a4a4a"><i></i>Pl. Adds</span>
      </div>
    </div>
    ${buildLineChart([
      {label:'Followers',color:'#ff6a1f',data:followers},
      {label:'Likes',    color:'#e8e8e8',data:likes},
      {label:'Listens',  color:'#888888',data:plays},
      {label:'Pl. Adds', color:'#4a4a4a',data:plAdds},
    ], labels)}`);
}
