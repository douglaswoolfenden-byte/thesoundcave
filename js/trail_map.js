// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TRAIL MAP — content calendar
// Backed by /api/scheduled_posts (Stream 1 Phase G). In-memory cache feeds
// sync render functions; mutations call the API and refresh the cache.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Active channels — Meta (IG + FB), TikTok, Reddit.
const TRAIL_PLATFORMS = [
  { id: 'ig',       label: 'Instagram' },
  { id: 'facebook', label: 'Facebook'  },
  { id: 'tiktok',   label: 'TikTok'    },
  { id: 'reddit',   label: 'Reddit'    },
];

let trailView = 'month';                    // 'month' | 'week'
let trailAnchor = startOfDay(new Date());   // any date in the visible period
let trailStashOpen = false;
let trailEditingId = null;                  // id of scheduled_post being edited in modal
let trailDrawerCampaign = null;             // campaignId the drawer is drilled into (null = top level)

// ── Storage (Supabase-backed via content_api) ────────────
let _trailCache = [];
const _trailApiBase = () => scApiBase();

function getScheduled() { return _trailCache; }

async function loadScheduled() {
  try {
    const r = await scAuth.authedFetch(`${_trailApiBase()}/api/scheduled_posts`);
    if (!r.ok) throw new Error(`scheduled_posts GET ${r.status}`);
    const j = await r.json();
    _trailCache = j.posts || [];
  } catch (e) {
    console.warn('[trail] load failed', e);
    _trailCache = [];
  }
}

async function createScheduledPost(stash_item_id, dateISO) {
  const stash = getTrailStash();
  const item = stash.find(s => s.id === stash_item_id);
  const hasMedia = !!(item && item.media_url);
  const defaultPlatforms = hasMedia ? ['ig'] : ['reddit'];
  const r = await scAuth.authedFetch(`${_trailApiBase()}/api/scheduled_posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stash_item_id, scheduled_for: dateISO, platforms: defaultPlatforms }),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `scheduled_posts POST ${r.status}`);
  }
  const j = await r.json();
  if (j.post) _trailCache.push(j.post);
  return j.post;
}

async function patchScheduledPost(id, patch) {
  const r = await scAuth.authedFetch(`${_trailApiBase()}/api/scheduled_posts/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `scheduled_posts PATCH ${r.status}`);
  }
  const j = await r.json();
  if (j.post) {
    const i = _trailCache.findIndex(p => p.id === id);
    if (i !== -1) _trailCache[i] = j.post;
  }
  return j.post;
}

async function deleteScheduledPost(id) {
  await scAuth.authedFetch(`${_trailApiBase()}/api/scheduled_posts/${id}`, { method: 'DELETE' });
  _trailCache = _trailCache.filter(p => p.id !== id);
}

// ── Date helpers ─────────────────────────────────────────
function startOfDay(d) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d) {
  const x = startOfDay(d);
  const dow = (x.getDay() + 6) % 7;        // 0 = Mon
  x.setDate(x.getDate() - dow);
  return x;
}
function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
      && a.getMonth()    === b.getMonth()
      && a.getDate()     === b.getDate();
}
function fmtPeriod(date, view) {
  if (view === 'week') {
    const s = startOfWeek(date);
    const e = addDays(s, 6);
    const sM = s.toLocaleDateString('en-GB', { month: 'short' });
    const eM = e.toLocaleDateString('en-GB', { month: 'short' });
    if (sM === eM) return `${s.getDate()}–${e.getDate()} ${sM} ${e.getFullYear()}`;
    return `${s.getDate()} ${sM} – ${e.getDate()} ${eM} ${e.getFullYear()}`;
  }
  return date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}
function isoForCellDefault(date) {
  // Default scheduled time = 12:00 local on the dropped date
  const x = new Date(date);
  x.setHours(12, 0, 0, 0);
  return x.toISOString();
}
function localInputValue(iso) {
  // Convert ISO to value usable by <input type="datetime-local">
  const d = new Date(iso);
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ── Stash (read-only here; sourced from Firepit's cache) ──
function getTrailStash() {
  // Stream 1 hydrates _stashCache from /api/stash; fall back to legacy
  // localStorage so this view still renders if firepit.js hasn't loaded yet.
  if (typeof getContentLibrary === 'function') return getContentLibrary();
  return JSON.parse(localStorage.getItem('sc_content_library') || '[]');
}

// ── Render ───────────────────────────────────────────────
async function renderTrailMap() {
  document.getElementById('trailPeriod').textContent = fmtPeriod(trailAnchor, trailView);
  document.querySelectorAll('.trail-view-toggle button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === trailView);
  });
  await loadScheduled();
  if (trailView === 'month') renderTrailMonth();
  else renderTrailWeek();
  renderTrailStashDrawer();
  updateTrailStashCount();
}

function renderTrailMonth() {
  const grid = document.getElementById('trailGrid');
  const first = startOfMonth(trailAnchor);
  const gridStart = startOfWeek(first);
  // 6 weeks always, so grid is stable height
  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(gridStart, i);
    cells.push(d);
  }
  const today = startOfDay(new Date());
  const monthIdx = first.getMonth();
  const scheduled = getScheduled();
  const stash = getTrailStash();

  grid.className = 'trail-grid';
  grid.innerHTML = `
    <div class="trail-weekdays">
      ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d => `<div class="trail-weekday">${d}</div>`).join('')}
    </div>
    <div class="trail-month-grid">
      ${cells.map(d => trailCellHTML(d, monthIdx, today, scheduled, stash, false)).join('')}
    </div>`;
  attachCellHandlers();
}

function renderTrailWeek() {
  const grid = document.getElementById('trailGrid');
  const start = startOfWeek(trailAnchor);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const today = startOfDay(new Date());
  const scheduled = getScheduled();
  const stash = getTrailStash();

  grid.className = 'trail-grid';
  grid.innerHTML = `
    <div class="trail-weekdays">
      ${days.map(d => `<div class="trail-weekday">${d.toLocaleDateString('en-GB', { weekday: 'short' })}</div>`).join('')}
    </div>
    <div class="trail-week-grid">
      ${days.map(d => trailCellHTML(d, d.getMonth(), today, scheduled, stash, true)).join('')}
    </div>`;
  attachCellHandlers();
}

function trailCellHTML(date, currentMonth, today, scheduled, stash, isWeek) {
  const inMonth = date.getMonth() === currentMonth;
  const isToday = isSameDay(date, today);
  const dayPosts = scheduled
    .filter(p => isSameDay(new Date(p.scheduled_for), date))
    .sort((a, b) => new Date(a.scheduled_for) - new Date(b.scheduled_for));

  const dateLabel = isWeek
    ? `<span class="trail-weekday-num">${date.getDate()}</span>`
    : `<span class="trail-date">${date.getDate()}</span>`;

  const visible = isWeek ? dayPosts : dayPosts.slice(0, 3);
  const hidden = isWeek ? 0 : Math.max(0, dayPosts.length - 3);

  const pills = visible.map(p => trailPillHTML(p, stash)).join('');
  const more = hidden ? `<div class="trail-more" data-date="${date.toISOString()}">+${hidden} more</div>` : '';

  return `<div class="trail-cell ${inMonth ? '' : 'other-month'} ${isToday ? 'today' : ''}"
                data-date="${date.toISOString()}">
    ${dateLabel}
    <div class="trail-cell-pills">${pills}${more}</div>
  </div>`;
}

function trailPillHTML(post, stash) {
  const item = stash.find(s => s.id === post.stash_item_id);
  const ico = item?.icon || '📝';
  // Prefer the countdown/post-type label (7-DAY, ANNOUNCEMENT…) so a calendar
  // pill says what the post IS, not just its content type.
  const title = item
    ? ((item.postType && typeof postTypeLabel === 'function') ? postTypeLabel(item.postType) : (item.label || item.type))
    : '(missing stash item)';
  const dots = post.platforms.map(() => `<span class="dot"></span>`).join('');
  return `<div class="trail-pill ${post.status}" data-id="${post.id}">
    <span class="ico">${ico}</span>
    <span class="title">${esc(title)}</span>
    <span class="dots">${dots}</span>
  </div>`;
}

// ── Stash drawer ─────────────────────────────────────────
// Scheduled items STAY in the drawer (marked "scheduled" + non-draggable) rather
// than vanishing — so a campaign reads as complete and you can't double-schedule.
// Delete the calendar entry (deleteScheduledPost → renderTrailMap) and the card
// becomes draggable again automatically.
function _trailScheduledIds() {
  return new Set(getScheduled().map(p => p.stash_item_id).filter(Boolean));
}

function _trailNonArchivedStash() {
  return getTrailStash().filter(i => i.status !== 'archived');
}

function _trailSchedulableStash() {
  const scheduledIds = _trailScheduledIds();
  return _trailNonArchivedStash().filter(i => !scheduledIds.has(i.id));
}

function _trailStashCardHTML(item, scheduled) {
  const preview = (item.content || '').slice(0, 80).replace(/\n/g, ' ');
  const thumb = item.imageUrl
    ? `<img class="thumb" src="${esc(item.imageUrl)}" alt="">`
    : `<div class="thumb placeholder">${esc(item.icon || '📝')}</div>`;
  // Inside a campaign the card's identity IS its countdown label; loose items
  // fall back to their content-type label.
  const title = (item.postType && typeof postTypeLabel === 'function')
    ? postTypeLabel(item.postType)
    : (item.label || item.type);
  const tag = scheduled ? '<span class="trail-card-tag">scheduled</span>' : '';
  const drag = scheduled ? '' : 'draggable="true"';
  return `<div class="trail-stash-card ${scheduled ? 'scheduled' : ''}" ${drag} data-id="${item.id}">
    ${thumb}
    <div class="info">
      <div class="type">${esc(title)}${tag}</div>
      <div class="preview">${esc(preview)}</div>
    </div>
  </div>`;
}

function _trailCampaignFolderHTML(campaignId, group, scheduledIds) {
  const cover = (group.find(i => i.imageUrl) || {}).imageUrl || '';
  const title = esc((group[0] || {}).eventName || 'Campaign');
  const n = group.length;
  const remaining = group.filter(i => !scheduledIds.has(i.id)).length;
  const thumb = cover
    ? `<img class="thumb" src="${esc(cover)}" alt="">`
    : `<div class="thumb placeholder">📣</div>`;
  const badge = remaining
    ? `<span class="trail-folder-count">${remaining}</span>`
    : `<span class="trail-folder-count done">✓</span>`;
  const sub = remaining ? `${remaining} of ${n} to schedule` : `all ${n} scheduled`;
  return `<div class="trail-stash-folder" onclick="openTrailDrawerCampaign('${campaignId}')" title="Open campaign">
    ${thumb}
    <div class="info">
      <div class="type">${title}</div>
      <div class="preview">${sub}</div>
    </div>
    ${badge}
  </div>`;
}

function renderTrailStashDrawer() {
  const drawer = document.getElementById('trailStashDrawer');
  drawer.classList.toggle('open', trailStashOpen);
  if (!trailStashOpen) return;

  const list = document.getElementById('trailStashList');
  const scheduledIds = _trailScheduledIds();
  const stash = _trailNonArchivedStash();
  if (!stash.length) {
    trailDrawerCampaign = null;
    list.innerHTML = `<div class="trail-stash-empty">No content in your Stash yet.<br>Forge something first.</div>`;
    return;
  }

  // Drilled into one campaign — its posts in proposed-send order; scheduled ones
  // marked and non-draggable.
  if (trailDrawerCampaign) {
    const group = stash.filter(i => i.campaignId === trailDrawerCampaign)
      .sort((a, b) => new Date(a.scheduledFor || a.created) - new Date(b.scheduledFor || b.created));
    if (!group.length) { trailDrawerCampaign = null; renderTrailStashDrawer(); return; }
    const title = esc((group[0] || {}).eventName || 'Campaign');
    const head = `<div class="trail-drawer-head"><button class="stash-back" onclick="closeTrailDrawerCampaign()">‹ All</button><span class="trail-drawer-title">${title}</span></div>`;
    list.innerHTML = head + group.map(i => _trailStashCardHTML(i, scheduledIds.has(i.id))).join('');
    attachStashDragHandlers();
    return;
  }

  // Top level — campaign folders alongside loose cards.
  const grouped = (typeof groupStashByCampaign === 'function')
    ? groupStashByCampaign(stash)
    : { campaigns: new Map(), singles: stash };
  const parts = [];
  grouped.campaigns.forEach((group, cid) => parts.push(_trailCampaignFolderHTML(cid, group, scheduledIds)));
  grouped.singles.forEach(item => parts.push(_trailStashCardHTML(item, scheduledIds.has(item.id))));
  list.innerHTML = parts.join('');
  attachStashDragHandlers();
}

function openTrailDrawerCampaign(campaignId) { trailDrawerCampaign = campaignId; renderTrailStashDrawer(); }
function closeTrailDrawerCampaign() { trailDrawerCampaign = null; renderTrailStashDrawer(); }

function updateTrailStashCount() {
  const el = document.getElementById('trailStashCount');
  if (!el) return;
  const n = _trailSchedulableStash().length;
  el.textContent = n;
  el.style.display = n ? '' : 'none';
}

// ── Drag & drop ──────────────────────────────────────────
let dragStashId = null;

function attachStashDragHandlers() {
  document.querySelectorAll('.trail-stash-card').forEach(card => {
    card.addEventListener('dragstart', e => {
      dragStashId = card.dataset.id;
      card.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'copy';
      e.dataTransfer.setData('text/plain', dragStashId);
    });
    card.addEventListener('dragend', () => {
      dragStashId = null;
      card.classList.remove('dragging');
    });
  });
}

function attachCellHandlers() {
  document.querySelectorAll('.trail-cell').forEach(cell => {
    cell.addEventListener('dragover', e => {
      e.preventDefault();
      cell.classList.add('dragging');
    });
    cell.addEventListener('dragleave', () => cell.classList.remove('dragging'));
    cell.addEventListener('drop', async e => {
      e.preventDefault();
      cell.classList.remove('dragging');
      const stashId = dragStashId || e.dataTransfer.getData('text/plain');
      if (!stashId) return;
      const dateISO = isoForCellDefault(new Date(cell.dataset.date));
      try {
        const post = await createScheduledPost(stashId, dateISO);
        renderTrailMap();
        if (post) openTrailModal(post.id);
      } catch (err) {
        alert(`Couldn't schedule: ${err.message}`);
      }
    });
  });
  document.querySelectorAll('.trail-pill').forEach(pill => {
    pill.addEventListener('click', () => openTrailModal(pill.dataset.id));
  });
}

// ── Modal ────────────────────────────────────────────────
function openTrailModal(id) {
  trailEditingId = id;
  const all = getScheduled();
  const post = all.find(p => p.id === id);
  if (!post) return;
  const stash = getTrailStash();
  const item = stash.find(s => s.id === post.stash_item_id);

  document.getElementById('trailModalContent').textContent = item ? (item.content || '') : '(stash item missing)';
  document.getElementById('trailModalDateTime').value = localInputValue(post.scheduled_for);

  // Platform pills
  const wrap = document.getElementById('trailModalPlatforms');
  wrap.innerHTML = TRAIL_PLATFORMS.map(p => `
    <button type="button" class="trail-platform-pill ${post.platforms.includes(p.id) ? 'selected' : ''}" data-platform="${p.id}">
      ${esc(p.label)}
    </button>`).join('');
  wrap.querySelectorAll('.trail-platform-pill').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('selected'));
  });

  // Status
  const statusWrap = document.getElementById('trailModalStatus');
  statusWrap.innerHTML = ['scheduled','posted','failed'].map(s => `
    <button type="button" class="trail-status-pill ${post.status === s ? 'selected' : ''}" data-status="${s}">${s}</button>
  `).join('');
  statusWrap.querySelectorAll('.trail-status-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      statusWrap.querySelectorAll('.trail-status-pill').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  document.getElementById('trailModalOverlay').classList.add('open');
}

function closeTrailModal() {
  document.getElementById('trailModalOverlay').classList.remove('open');
  trailEditingId = null;
}

async function saveTrailModal() {
  const id = trailEditingId;
  if (!id) return;
  const dtVal = document.getElementById('trailModalDateTime').value;
  const platforms = [...document.querySelectorAll('#trailModalPlatforms .trail-platform-pill.selected')]
    .map(b => b.dataset.platform);

  if (!platforms.length) {
    alert('Pick at least one platform before saving.');
    return;
  }
  const patch = {};
  if (dtVal) patch.scheduled_for = new Date(dtVal).toISOString();
  patch.platforms = platforms;

  try {
    await patchScheduledPost(id, patch);
    closeTrailModal();
    renderTrailMap();
  } catch (e) {
    alert(`Couldn't save: ${e.message}`);
  }
}

async function deleteTrailModal() {
  const id = trailEditingId;
  if (!id) return;
  try {
    await deleteScheduledPost(id);
    closeTrailModal();
    renderTrailMap();
  } catch (e) {
    alert(`Couldn't delete: ${e.message}`);
  }
}

// ── Toolbar actions ──────────────────────────────────────
function trailNav(dir) {
  if (trailView === 'month') trailAnchor = addMonths(trailAnchor, dir);
  else trailAnchor = addDays(trailAnchor, dir * 7);
  renderTrailMap();
}
function trailToday() { trailAnchor = startOfDay(new Date()); renderTrailMap(); }
function trailSetView(v) { trailView = v; renderTrailMap(); }
function trailToggleStash() { trailStashOpen = !trailStashOpen; trailDrawerCampaign = null; renderTrailMap(); }
