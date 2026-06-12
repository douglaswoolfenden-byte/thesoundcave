// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: FOOTPRINTS (Tracking)
// Clean toggle chart — spec: wiki/spec/footprints_clean_chart.md.
// One orange line, UPPERCASE metric tabs, genre/artist dropdowns;
// EXPORT REPORT exports the current segment. No percentage walls.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FP_METRICS = [
  { key:'followers', label:'FOLLOWERS' },
  { key:'plays',     label:'PLAYS' },
  { key:'likes',     label:'LIKES' },
  { key:'reposts',   label:'REPOSTS' },
];
let fpGenre = '';

function fpClan() {
  return Object.values(getFavourites()).filter(a => a.status !== 'cut');
}

function fpSegment() {
  return fpClan().filter(a => !fpGenre || (a.genre || '') === fpGenre);
}

function renderFootprints() {
  const clan = fpClan();
  const summaryEl  = document.getElementById('fpSummary');
  const controlsEl = document.getElementById('fpControls');
  const chartEl    = document.getElementById('fpChart');
  const insightsEl = document.getElementById('fpInsights');

  if (!clan.length) {
    summaryEl.innerHTML = '';
    controlsEl.innerHTML = '';
    chartEl.innerHTML = `<div class="empty"><p>No tracked artists yet. Add some from Foraging.</p></div>`;
    insightsEl.innerHTML = '';
    return;
  }

  // Genre filter may have emptied the segment (e.g. artist cut) — reset it.
  let segment = fpSegment();
  if (!segment.length) { fpGenre = ''; segment = clan; }
  if (!fpSelectedArtist || !segment.find(a => a.username === fpSelectedArtist)) {
    fpSelectedArtist = segment[0].username;
  }

  // Summary — facts, not percentages.
  const days = Math.max(0, ...clan.map(a => (a.snapshots || []).length));
  const lastDate = clan.flatMap(a => a.snapshots || []).map(s => s.date).sort().pop();
  summaryEl.innerHTML = `
    <div class="stat-card summary-card"><div class="stat-label">Total Tracked</div>
      <div class="stat-value">${clan.length}</div><div class="summary-suffix">artists</div></div>
    <div class="stat-card summary-card"><div class="stat-label">Days of Data</div>
      <div class="stat-value">${days}</div><div class="summary-suffix">daily snapshots</div></div>
    <div class="stat-card summary-card"><div class="stat-label">Last Updated</div>
      <div class="stat-value" style="font-size:20px">${lastDate ? esc(lastDate) : '—'}</div>
      <div class="summary-suffix">accrues daily</div></div>`;

  // Controls — GENRE + ARTIST dropdowns.
  const genres = [...new Set(clan.map(a => a.genre || '').filter(Boolean))].sort();
  controlsEl.innerHTML = `
    <label style="display:flex;flex-direction:column;gap:6px;min-width:200px">
      <span class="stat-label" style="font-size:10px;color:var(--secondary)">Genre</span>
      <select class="input" onchange="fpSetGenre(this.value)">
        <option value="">ALL GENRES</option>
        ${genres.map(g => `<option value="${esc(g)}" ${fpGenre === g ? 'selected' : ''}>${esc(g)}</option>`).join('')}
      </select>
    </label>
    <label style="display:flex;flex-direction:column;gap:6px;min-width:200px">
      <span class="stat-label" style="font-size:10px;color:var(--secondary)">Artist</span>
      <select class="input" onchange="fpSelectArtist(this.value)">
        ${segment.map(a => `<option value="${esc(a.username)}" ${fpSelectedArtist === a.username ? 'selected' : ''}>${esc(a.display_name || a.username)}</option>`).join('')}
      </select>
    </label>`;

  // Chart — the hero: one orange line, tabs swap the metric.
  const artist = getFavourites()[fpSelectedArtist];
  const snaps = (artist.snapshots || []).filter(s => s && s.date);
  const labels = snaps.map(s => s.date.slice(5));
  const data = snaps.map(s => s[fpActiveMetric] || 0);
  const latest = data.length ? data[data.length - 1] : 0;
  const activeLabel = (FP_METRICS.find(m => m.key === fpActiveMetric) || FP_METRICS[0]).label;

  chartEl.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div>
        <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--heading)">${esc(artist.display_name || artist.username)}</h3>
        <span class="stat-label" style="font-size:11px;color:var(--secondary)">${esc(artist.genre || '')}</span>
      </div>
      <div style="text-align:right">
        <div class="stat-label" style="font-size:10px;color:var(--secondary)">${activeLabel}</div>
        <div style="font-family:'DM Mono',monospace;font-size:24px;color:var(--red)">${fmt(latest)}</div>
      </div>
    </div>
    <div class="metric-tabs">
      ${FP_METRICS.map(m => `<button class="metric-tab ${fpActiveMetric === m.key ? 'active' : ''}" onclick="fpSetMetric('${m.key}')">${m.label}</button>`).join('')}
    </div>
    ${snaps.length >= 2
      ? buildLineChart([{ label: activeLabel, color: '#ff4500', data }], labels)
      : `<div style="border:1px dashed var(--border);border-radius:8px;text-align:center;padding:48px 20px;color:var(--muted)">
           The chart draws itself as daily snapshots land — first lines appear after 2 days of data.
         </div>`}`;

  // Insights — names only, no numbers.
  const movers = clan.map(a => {
    const s = a.snapshots || [];
    if (s.length < 2) return { ...a, gain: 0 };
    return { ...a, gain: (s[s.length - 1].followers || 0) - (s[0].followers || 0) };
  }).sort((a, b) => b.gain - a.gain);
  const growing = movers.filter(a => a.gain > 0).slice(0, 2);
  const declining = movers.filter(a => a.gain < 0).slice(0, 2);
  insightsEl.innerHTML = `
    <h3 class="section-title">Key Insights</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${growing.map(a => `
        <div class="insight-row">
          <span class="insight-icon">🚀</span>
          <div>
            <div class="insight-name">${esc(a.display_name)}</div>
            <div class="insight-detail" style="color:var(--red)">GROWING — gaining followers</div>
          </div>
        </div>`).join('')}
      ${declining.map(a => `
        <div class="insight-row">
          <span class="insight-icon">⚠️</span>
          <div>
            <div class="insight-name">${esc(a.display_name)}</div>
            <div class="insight-detail" style="color:var(--muted)">DECLINING — worth reviewing</div>
          </div>
        </div>`).join('')}
      ${!growing.length && !declining.length ? '<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Insights will appear once you have more data.</p>' : ''}
    </div>`;
}

function fpSetGenre(genre) {
  fpGenre = genre;
  fpSelectedArtist = null;
  renderFootprints();
}

function fpSelectArtist(username) {
  fpSelectedArtist = username;
  renderFootprints();
}

function fpSetMetric(key) {
  fpActiveMetric = key;
  renderFootprints();
}

// Export the current segment (genre filter applied) as CSV.
function exportFpReport() {
  const segment = fpSegment();
  if (!segment.length) return;
  const headers = ['Name','Genre','Followers','Plays','Likes','Reposts','Playlist Adds','Platforms Linked','Preferred Tracks','Notes'];
  const rows = [headers];
  segment.forEach(a => {
    const snaps = a.snapshots || [];
    const latest = snaps[snaps.length - 1] || {};
    const linked = Object.values(a.platforms || {}).filter(v => v).length;
    rows.push([
      a.display_name, a.genre,
      latest.followers || 0,
      latest.plays || 0, latest.likes || 0, latest.reposts || 0,
      latest.playlist_adds != null ? latest.playlist_adds : '',
      `${linked}/${PLATFORMS.length}`,
      (a.preferred_tracks || []).join('; '), a.notes || '',
    ]);
  });
  const tag = fpGenre ? fpGenre.replace(/[^a-z0-9]+/gi, '_') : 'All';
  downloadCSV(rows, `SoundCave_Report_${tag}.csv`);
}
