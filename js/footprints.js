// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: FOOTPRINTS (Tracking)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
const FP_METRICS = [
  { key:'followers', label:'Followers' },
  { key:'plays',     label:'Plays' },
  { key:'likes',     label:'Likes' },
  { key:'score',     label:'Score' },
];

function renderFootprints() {
  const favs = getFavourites();
  const clan = Object.values(favs).filter(a => a.status !== 'cut');

  if (!clan.length) {
    document.getElementById('fpSummary').innerHTML = '';
    document.getElementById('fpLayout').innerHTML = `<div class="empty" style="grid-column:1/-1"><div class="ico">🐾</div><p>No tracked artists yet. Add some from Foraging.</p></div>`;
    document.getElementById('fpInsights').innerHTML = '';
    return;
  }

  if (!fpSelectedArtist || !favs[fpSelectedArtist]) fpSelectedArtist = clan[0].username;

  // Calculate movers
  const movers = clan.map(a => {
    const snaps = a.snapshots||[];
    if (snaps.length < 2) return { ...a, gain: 0 };
    const first = snaps[0].followers||1;
    const last  = snaps[snaps.length-1].followers||1;
    return { ...a, gain: ((last-first)/first*100) };
  }).sort((a,b) => b.gain - a.gain);

  const declining = movers.filter(a => a.gain < 0);

  // Summary
  const avgGain = movers.reduce((s,a) => s+a.gain, 0) / movers.length;
  document.getElementById('fpSummary').innerHTML = `
    <div class="stat-card summary-card"><div class="stat-label">Total Tracked</div>
      <div class="stat-value">${clan.length}</div><div class="summary-suffix">artists</div></div>
    <div class="stat-card summary-card"><div class="stat-label">Avg. Growth</div>
      <div class="stat-value red">${avgGain>=0?'+':''}${avgGain.toFixed(1)}%</div><div class="summary-suffix">across all snapshots</div></div>
    <div class="stat-card summary-card"><div class="stat-label">Top Mover</div>
      <div class="stat-value red">${esc(movers[0]?.display_name||'—')}</div><div class="summary-suffix">+${(movers[0]?.gain||0).toFixed(1)}%</div></div>
    <div class="stat-card summary-card"><div class="stat-label">Declining</div>
      <div class="stat-value">${declining.length}</div><div class="summary-suffix">flagged</div></div>`;

  // Sidebar
  document.getElementById('fpSidebar').innerHTML = `
    <div class="fp-sidebar-head">Artists</div>
    ${clan.map(a => {
      const snaps = a.snapshots||[];
      const latest = snaps[snaps.length-1]||{};
      return `<div class="fp-artist-item ${fpSelectedArtist===a.username?'active':''}" onclick="fpSelectArtist('${esc(a.username)}')">
        <div class="fp-artist-name">${esc(a.display_name)}</div>
        <div class="fp-artist-meta">${esc(a.genre)} · ${fmt(a.followers_override!=null?a.followers_override:(latest.followers||0))}</div>
      </div>`;
    }).join('')}`;

  // Chart area
  const artist = favs[fpSelectedArtist];
  if (artist) {
    const snaps = artist.snapshots||[];
    const trend = snaps.length >= 2 ? getTrend(snaps[0].score, snaps[snaps.length-1].score) : {cls:'flat',label:'Stable',arrow:'→'};
    const labels = snaps.map((s,i) => s.date ? s.date.slice(5) : `S${i+1}`);
    const metricData = snaps.map(s => s[fpActiveMetric]||0);

    document.getElementById('fpChart').innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div>
          <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--heading)">${esc(artist.display_name)}</h3>
          <span style="font-size:12px;color:var(--secondary)">${esc(artist.genre)}</span>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:14px;color:${trend.cls==='up'?'var(--red)':'var(--muted)'}">
          ${trend.label} ${trend.arrow}
        </span>
      </div>
      <div class="metric-tabs">
        ${FP_METRICS.map(m => `<button class="metric-tab ${fpActiveMetric===m.key?'active':''}" onclick="fpSetMetric('${m.key}')">${m.label}</button>`).join('')}
      </div>
      ${snaps.length >= 2 ? buildLineChart([{label:fpActiveMetric, color:'#e63946', data:metricData}], labels) :
        '<div style="text-align:center;padding:40px;color:var(--muted)">Need 2+ snapshots for charts. Run scout.py again next week.</div>'}
      <div class="wow-grid">
        ${FP_METRICS.map(m => {
          const vals = snaps.map(s => s[m.key]||0);
          const last = vals[vals.length-1]||0;
          const prev = vals[vals.length-2]||last;
          const pct = prev ? (((last-prev)/prev)*100).toFixed(1) : '0.0';
          const up = parseFloat(pct) >= 0;
          return `<div class="wow-card">
            <div class="wow-label">${m.label}</div>
            <div class="wow-value">${m.key==='score'?last.toFixed(1):fmt(last)}</div>
            <div class="wow-change" style="color:${up?'var(--red)':'var(--muted)'}">${up?'▲':'▼'} ${Math.abs(parseFloat(pct))}% WoW</div>
          </div>`;
        }).join('')}
      </div>`;
  }

  // Insights
  document.getElementById('fpInsights').innerHTML = `
    <h3 class="section-title">Key Insights</h3>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
      ${movers.filter(a=>a.gain>0).slice(0,2).map(a => `
        <div class="insight-row">
          <span class="insight-icon">🚀</span>
          <div>
            <div class="insight-name">${esc(a.display_name)}</div>
            <div class="insight-detail" style="color:var(--red)">+${a.gain.toFixed(1)}% follower growth</div>
          </div>
        </div>`).join('')}
      ${declining.slice(0,2).map(a => `
        <div class="insight-row">
          <span class="insight-icon">⚠️</span>
          <div>
            <div class="insight-name">${esc(a.display_name)}</div>
            <div class="insight-detail" style="color:var(--muted)">Declining — worth reviewing</div>
          </div>
        </div>`).join('')}
      ${!movers.filter(a=>a.gain>0).length && !declining.length ? '<p style="color:var(--muted);font-size:13px;grid-column:1/-1">Insights will appear once you have more data.</p>' : ''}
    </div>`;
}

function fpSelectArtist(username) {
  fpSelectedArtist = username;
  renderFootprints();
}

function fpSetMetric(key) {
  fpActiveMetric = key;
  renderFootprints();
}
