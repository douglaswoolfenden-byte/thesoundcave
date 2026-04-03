// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: THE CAVE (Dashboard)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

function getDashFilters() {
  return {
    genre: document.getElementById('dashGenreFilter')?.value || '',
    name: (document.getElementById('dashNameFilter')?.value || '').toLowerCase(),
    minF: parseInt(document.getElementById('dashMinFollow')?.value) || 0,
    maxF: parseInt(document.getElementById('dashMaxFollow')?.value) || Infinity,
  };
}

function resetDashFilters() {
  document.getElementById('dashGenreFilter').value = '';
  document.getElementById('dashNameFilter').value = '';
  document.getElementById('dashMinFollow').value = '';
  document.getElementById('dashMaxFollow').value = '';
  renderCave();
}

function exportDashPDF() {
  window.print();
}

function exportDashEmail() {
  const favs = getFavourites();
  const clan = Object.values(favs).filter(a => a.status !== 'cut');
  const subject = encodeURIComponent('Sound Cave Dashboard Report');
  const body = encodeURIComponent(
    `Sound Cave Dashboard Report\n` +
    `Date: ${today()}\n` +
    `Clan size: ${clan.length} artists\n\n` +
    `Artists:\n` +
    clan.map(a => `- ${a.display_name} (${a.genre})`).join('\n')
  );
  window.open(`mailto:?subject=${subject}&body=${body}`);
}

function renderCave() {
  const favs = getFavourites();
  const filters = getDashFilters();
  const clan = Object.values(favs).filter(a => {
    if (a.status === 'cut') return false;
    if (filters.genre && a.genre !== filters.genre) return false;
    if (filters.name && !(a.display_name||'').toLowerCase().includes(filters.name)) return false;
    const snaps = a.snapshots||[];
    const latest = snaps[snaps.length-1]||{};
    const fol = a.followers_override != null ? a.followers_override : (latest.followers||0);
    if (fol < filters.minF) return false;
    if (fol > filters.maxF) return false;
    return true;
  });

  // Populate genre filter if empty
  const gSel = document.getElementById('dashGenreFilter');
  if (gSel && gSel.options.length <= 1) {
    const allClan = Object.values(favs).filter(a => a.status !== 'cut');
    const genres = new Set(allClan.map(a => a.genre).filter(Boolean));
    [...genres].sort().forEach(g => {
      gSel.innerHTML += `<option value="${esc(g)}">${esc(g)}</option>`;
    });
  }

  // Welcome
  document.getElementById('caveWelcome').innerHTML = `
    <div style="margin-bottom:28px">
      <h1 style="font-size:26px;font-weight:700;color:var(--heading)">Welcome back, Caveman 🔥</h1>
      <p style="color:var(--secondary);margin-top:6px;font-size:14px">Here's what's echoing through the cave.</p>
    </div>`;

  // Aggregate stats
  let totalFollowers=0, totalLikes=0, totalPlays=0, totalPlAdds=0;
  let prevFollowers=0, prevLikes=0, prevPlays=0, prevPlAdds=0;
  const followerSeries=[], likesSeries=[], playsSeries=[], plAddsSeries=[];

  if (clan.length) {
    const clanUsernames = new Set(clan.map(a => a.username));
    const weekAggs = allReports.slice(0,6).reverse().map(report => {
      let wf=0, wl=0, wp=0, wpa=0;
      (report.tracks||[]).forEach(t => {
        if (clanUsernames.has(t.artist_username)) {
          wf += t.followers||0;
          wl += t.likes||0;
          wp += t.plays||0;
        }
      });
      clan.forEach(a => { wpa += a.playlist_adds||0; });
      return { followers:wf, likes:wl, plays:wp, playlistAdds:wpa };
    });
    weekAggs.forEach(w => {
      followerSeries.push(w.followers);
      likesSeries.push(w.likes);
      playsSeries.push(w.plays);
      plAddsSeries.push(w.playlistAdds);
    });
    const latest = weekAggs[weekAggs.length-1] || {};
    const prev   = weekAggs[weekAggs.length-2] || latest;
    totalFollowers = latest.followers; totalLikes = latest.likes;
    totalPlays = latest.plays; totalPlAdds = latest.playlistAdds;
    prevFollowers = prev.followers; prevLikes = prev.likes;
    prevPlays = prev.plays; prevPlAdds = prev.playlistAdds;
  }

  const diff = (a,b) => a-b;

  document.getElementById('caveStats').innerHTML = [
    buildStatCard('Followers Gained', fmt(diff(totalFollowers,prevFollowers)||0), `${fmt(Math.abs(diff(totalFollowers,prevFollowers)))} this week`, diff(totalFollowers,prevFollowers)>=0, followerSeries),
    buildStatCard('Likes Gained', fmt(diff(totalLikes,prevLikes)||0), `${fmt(Math.abs(diff(totalLikes,prevLikes)))} this week`, diff(totalLikes,prevLikes)>=0, likesSeries),
    buildStatCard('Listens Gained', fmt(diff(totalPlays,prevPlays)||0), `${fmt(Math.abs(diff(totalPlays,prevPlays)))} this week`, diff(totalPlays,prevPlays)>=0, playsSeries),
    buildStatCard('Playlist Adds', fmt(totalPlAdds), `${fmt(totalPlAdds)} total`, true, plAddsSeries),
  ].join('');

  // Weekly chart
  const chartLabels = allReports.slice(0,6).reverse().map(r => r.date ? r.date.slice(5) : `Wk${r.week}`);
  const chartEl = document.getElementById('caveChart');
  if (followerSeries.length >= 2) {
    chartEl.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <h3 class="section-title" style="margin:0">Weekly Stats</h3>
        <div style="display:flex;gap:16px">
          ${[{l:'Followers',c:'#e63946'},{l:'Likes',c:'#c1121f'},{l:'Listens',c:'#a4161a'},{l:'Pl. Adds',c:'#7a0c10'}]
            .map(x=>`<div style="display:flex;align-items:center;gap:5px"><div style="width:12px;height:2px;background:${x.c};border-radius:1px"></div><span style="font-size:11px;color:var(--secondary)">${x.l}</span></div>`).join('')}
        </div>
      </div>
      ${buildLineChart([
        {label:'Followers',color:'#e63946',data:followerSeries},
        {label:'Likes',color:'#c1121f',data:likesSeries},
        {label:'Listens',color:'#a4161a',data:playsSeries},
        {label:'Pl. Adds',color:'#7a0c10',data:plAddsSeries},
      ], chartLabels)}`;
  } else {
    chartEl.innerHTML = `<div class="empty"><div class="ico">📊</div><p>Charts will appear once you have 2+ weeks of data and favourited artists.</p></div>`;
  }

  // Genre breakdown
  const genreCounts = {};
  clan.forEach(a => { const g = a.genre || 'Unknown'; genreCounts[g] = (genreCounts[g]||0)+1; });
  const genreTotal = clan.length || 1;
  const genreSorted = Object.entries(genreCounts).sort((a,b) => b[1]-a[1]);
  document.getElementById('caveGenre').innerHTML = `
    <h3 class="section-title">Genre Breakdown</h3>
    ${genreSorted.length ? genreSorted.map(([g, count], i) => {
      const pct = Math.round((count/genreTotal)*100);
      return `<div class="genre-row">
        <div class="genre-row-header">
          <span class="genre-name">${esc(g)}</span>
          <span class="genre-pct">${pct}%</span>
        </div>
        <div class="genre-bar-bg"><div class="genre-bar-fill" style="width:${pct}%;background:${GENRE_COLORS[i%GENRE_COLORS.length]}"></div></div>
      </div>`;
    }).join('') : '<p style="color:var(--muted);font-size:13px">No genres yet — add artists to your Clan.</p>'}`;

  // New track drops
  const recentTracks = [];
  const clanUsernames = new Set(clan.map(a => a.username));
  if (currentData) {
    (currentData.tracks||[]).forEach(t => {
      if (clanUsernames.has(t.artist_username)) {
        recentTracks.push({ artist: t.artist, title: t.title, date: currentData.date, url: t.url });
      }
    });
  }
  document.getElementById('caveTracks').innerHTML = `
    <h3 class="section-title">New Track Drops 🎵</h3>
    ${recentTracks.length ? recentTracks.slice(0,6).map(t => `
      <div class="track-drop">
        <div>
          <div class="track-drop-title">${esc(t.title)}</div>
          <div class="track-drop-artist">${esc(t.artist)}</div>
        </div>
        <div class="track-drop-right">
          <span class="track-drop-date">${t.date||''}</span>
          ${t.url ? `<a class="sc-link" href="${t.url}" target="_blank" rel="noopener">▶</a>` : ''}
        </div>
      </div>`).join('') : '<p style="color:var(--muted);font-size:13px">No new drops from Clan artists this week.</p>'}`;

  // Artists being followed
  document.getElementById('caveArtists').innerHTML = `
    <h3 class="section-title">Artists Being Followed</h3>
    ${clan.length ? `<div class="artist-grid">${clan.map(a => {
      const snaps = a.snapshots||[];
      const latest = snaps[snaps.length-1]||{};
      const first  = snaps[0]||{};
      const trend  = getTrend(first.score, latest.score);
      return `<div class="artist-tile" onclick="openPanel('${esc(a.username)}')">
        <div>
          <div class="artist-tile-name">${esc(a.display_name)}</div>
          <div class="artist-tile-genre">${esc(a.genre)}</div>
          <div class="artist-tile-followers">${fmt(a.followers_override!=null ? a.followers_override : (latest.followers||0))}</div>
        </div>
        <span class="trend-arrow ${trend.cls==='up'?'up':'down'}">${trend.cls==='up'?'↑':'↓'}</span>
      </div>`;
    }).join('')}</div>` : '<p style="color:var(--muted);font-size:13px">No artists yet — discover some in Foraging.</p>'}`;
}

function buildStatCard(label, value, trendText, trendUp, sparkData) {
  return `<div class="stat-card">
    <div class="stat-label">${label}</div>
    <div class="stat-row">
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-trend ${trendUp?'up':'down'}">${trendUp?'▲':'▼'} ${trendText}</div>
      </div>
      <div>${buildSparkline(sparkData)}</div>
    </div>
  </div>`;
}
