// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TAB: CLAN (Artist Grid + Profiles)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let clanSortBy = 'name';

function setClanSort(key, btn) {
  clanSortBy = key;
  document.querySelectorAll('.clan-sort-btn').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderClan();
}

function toggleReportMode() {
  reportMode = !reportMode;
  reportSelected = [];
  clanSelectedId = null;
  const btn = document.getElementById('reportBtn');
  btn.textContent = reportMode ? '✓ Building Report' : '📋 Report Builder';
  btn.classList.toggle('active', reportMode);
  renderClan();
}

function getClanFiltered() {
  const favs = getFavourites();
  const nameFilter = (document.getElementById('clanNameFilter')?.value || '').toLowerCase();
  const genreFilter = document.getElementById('clanGenreFilter')?.value || '';

  let clan = Object.values(favs).filter(a => {
    if (a.status === 'cut') return false;
    if (nameFilter && !(a.display_name||'').toLowerCase().includes(nameFilter)) return false;
    if (genreFilter && a.genre !== genreFilter) return false;
    return true;
  });

  // Sort
  clan.sort((a, b) => {
    const aSnaps = a.snapshots||[], bSnaps = b.snapshots||[];
    const aLatest = aSnaps[aSnaps.length-1]||{}, bLatest = bSnaps[bSnaps.length-1]||{};
    switch (clanSortBy) {
      case 'followers': return (b.followers_override ?? bLatest.followers ?? 0) - (a.followers_override ?? aLatest.followers ?? 0);
      case 'plays': return (bLatest.plays||0) - (aLatest.plays||0);
      case 'likes': return (bLatest.likes||0) - (aLatest.likes||0);
      case 'genre': return (a.genre||'').localeCompare(b.genre||'');
      default: return (a.display_name||'').localeCompare(b.display_name||'');
    }
  });

  return clan;
}

function renderClan() {
  const favs = getFavourites();
  const clan = getClanFiltered();
  const allClan = Object.values(favs).filter(a => a.status !== 'cut');

  document.getElementById('clanSubtitle').textContent = `${allClan.length} artists in your roster.${clan.length !== allClan.length ? ` Showing ${clan.length}.` : ''}`;

  // Populate genre filter if empty
  const gSel = document.getElementById('clanGenreFilter');
  if (gSel && gSel.options.length <= 1) {
    const genres = new Set(allClan.map(a => a.genre).filter(Boolean));
    [...genres].sort().forEach(g => {
      gSel.innerHTML += `<option value="${esc(g)}">${esc(g)}</option>`;
    });
  }

  // Report mode
  const notice = document.getElementById('reportNotice');
  const exportBtn = document.getElementById('exportReportBtn');
  if (reportMode) {
    notice.style.display = 'block';
    notice.textContent = `Click artists to select them for the report. ${reportSelected.length} selected.`;
    if (reportSelected.length) {
      exportBtn.style.display = 'inline-block';
      exportBtn.textContent = `⬇ Export ${reportSelected.length} Artists`;
    } else { exportBtn.style.display = 'none'; }
  } else {
    notice.style.display = 'none';
    exportBtn.style.display = 'none';
  }

  if (!clan.length) {
    document.getElementById('clanList').innerHTML = `
      <div class="empty"><div class="ico">🦴</div><p>No Clan members yet.<br>Discover artists in Foraging and add them to your Clan.</p></div>`;
    return;
  }

  // Grid view
  document.getElementById('clanList').innerHTML = `<div class="clan-grid">${clan.map(a => {
    const snaps = a.snapshots||[];
    const latest = snaps[snaps.length-1]||{};
    const first = snaps[0]||{};
    const trend = getTrend(first.followers||0, latest.followers||0);
    const followers = a.followers_override != null ? a.followers_override : (latest.followers||0);
    const inReport = reportSelected.includes(a.username);
    const isStarred = a.starred;
    const daysTracked = a.added_date ? daysBetween(a.added_date, today()) : 0;

    const avatarHTML = a.avatar_url
      ? `<img src="${a.avatar_url}" alt="" onerror="this.parentElement.innerHTML='🎵'">`
      : '🎵';

    return `<div class="clan-card ${inReport ? 'in-report' : ''}" onclick="${reportMode ? `clanRowClick('${esc(a.username)}')` : `openPanel('${esc(a.username)}')`}" style="${inReport ? 'border-color:var(--red)' : ''}">
      <span class="clan-card-star ${isStarred ? 'starred' : ''}" onclick="event.stopPropagation();toggleStar('${esc(a.username)}')">${isStarred ? '⭐' : '☆'}</span>
      <span class="clan-card-trend" style="color:${trend.cls==='up'?'var(--red)':'var(--muted)'}">${trend.label}</span>
      <div class="clan-card-avatar">${avatarHTML}</div>
      <div class="clan-card-name">${esc(a.display_name)}</div>
      <div class="clan-card-genre">${esc(a.genre)}</div>
      <div class="clan-card-stats">
        <div><span>${fmt(followers)}</span> fol</div>
        <div><span>${fmt(latest.plays||0)}</span> plays</div>
        <div><span>${fmt(latest.likes||0)}</span> likes</div>
      </div>
      <div class="plat-icon-row">
        ${PLATFORMS.slice(0,5).map(p => {
          const linked = (a.platforms||{})[p];
          return `<div class="plat-icon ${linked?'linked':''}" title="${PLAT_LABELS[p]}${linked ? ': '+linked : ''}">${PLAT_ICONS[p]}</div>`;
        }).join('')}
      </div>
      ${daysTracked > 0 ? `<div style="font-size:10px;color:var(--muted);margin-top:8px">Tracked ${daysTracked}d</div>` : ''}
    </div>`;
  }).join('')}</div>`;
}

function toggleStar(username) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].starred = !favs[username].starred;
  saveFavourites(favs);
  renderClan();
}

function clanRowClick(username) {
  if (reportMode) {
    const idx = reportSelected.indexOf(username);
    if (idx >= 0) reportSelected.splice(idx, 1);
    else reportSelected.push(username);
    renderClan();
  } else {
    openPanel(username);
  }
}

function addPreferredTrack(username) {
  const input = document.getElementById('addTrackInput');
  const track = (input.value||'').trim();
  if (!track) return;
  const favs = getFavourites();
  if (!favs[username]) return;
  if (!favs[username].preferred_tracks) favs[username].preferred_tracks = [];
  favs[username].preferred_tracks.push(track);
  saveFavourites(favs);
  input.value = '';
  renderClan();
}

function removePreferredTrack(username, idx) {
  const favs = getFavourites();
  if (!favs[username] || !favs[username].preferred_tracks) return;
  favs[username].preferred_tracks.splice(idx, 1);
  saveFavourites(favs);
  renderClan();
}

function saveClanNotes(username, value) {
  const favs = getFavourites();
  if (!favs[username]) return;
  favs[username].notes = value;
  saveFavourites(favs);
}

function exportSingleArtist(username) {
  const favs = getFavourites();
  const a = favs[username];
  if (!a) return;
  const snaps = a.snapshots||[];
  const latest = snaps[snaps.length-1]||{};
  const rows = [
    ['Field','Value'],
    ['Name', a.display_name],
    ['Genre', a.genre],
    ['Followers', a.followers_override!=null ? a.followers_override : (latest.followers||0)],
    ['Plays', latest.plays||0],
    ['Likes', latest.likes||0],
    ['Playlist Adds', latest.playlist_adds!=null ? latest.playlist_adds : ''],
    ['Score', latest.score||0],
    ['Spotify', (a.platforms||{}).spotify||''],
    ['Instagram', (a.platforms||{}).instagram||''],
    ['YouTube', (a.platforms||{}).youtube||''],
    ['Bandcamp', (a.platforms||{}).bandcamp||''],
    ['Discogs', (a.platforms||{}).discogs||''],
    ['Preferred Tracks', (a.preferred_tracks||[]).join('; ')],
    ['Notes', a.notes||''],
  ];
  downloadCSV(rows, `${a.display_name.replace(/ /g,'_')}_SoundCave.csv`);
}

function exportReport() {
  const favs = getFavourites();
  const headers = ['Name','Genre','Followers','Plays','Likes','Score','Trend','Playlist Adds','Platforms Linked','Preferred Tracks','Notes'];
  const rows = [headers];
  reportSelected.forEach(username => {
    const a = favs[username];
    if (!a) return;
    const snaps = a.snapshots||[];
    const latest = snaps[snaps.length-1]||{};
    const first  = snaps[0]||{};
    const trend  = getTrend(first.score, latest.score);
    const linked = Object.values(a.platforms||{}).filter(v=>v).length;
    rows.push([
      a.display_name, a.genre,
      a.followers_override!=null ? a.followers_override : (latest.followers||0),
      latest.plays||0, latest.likes||0, (latest.score||0).toFixed(1),
      trend.label, latest.playlist_adds!=null?latest.playlist_adds:'',
      `${linked}/${PLATFORMS.length}`,
      (a.preferred_tracks||[]).join('; '), a.notes||''
    ]);
  });
  downloadCSV(rows, 'SoundCave_Report.csv');
}

function downloadCSV(rows, filename) {
  const csv = rows.map(r => r.map(v => `"${String(v??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type:'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}
