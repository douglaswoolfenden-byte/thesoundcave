// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STASH — view layer (campaign blocks, drill-in, grid, countdown labels)
// ─────────────────────────────────────────────────────
// firepit.js owns the stash DATA (_stashCache, _stashRowToItem, loadStash,
// saveToStash) and the Forge-coupled mutations (editStashItem / copyStashItem /
// deleteStashItem). This file owns how the stash is *displayed*:
//   • top level  — a grid of blocks. Campaign-bridged posts cluster into one
//                  campaign tile per Gathering (expands on click); loose Forge
//                  items sit alongside as standalone tiles.
//   • drill-in   — open a campaign tile to see only its posts.
//   • scheduled  — items already placed on the Trail Map are hidden from the
//                  default grid (derived from the shared scheduled-posts cache),
//                  surfaced via the "Scheduled" status filter, and returned to
//                  drafts automatically when their calendar entry is deleted.
// Shared globals it relies on (all defined elsewhere, resolved at call time):
//   getContentLibrary, CONTENT_TYPES, esc, scAuth, forgeApiUrl,
//   editStashItem, copyStashItem, deleteStashItem,
//   getScheduled / loadScheduled (trail_map.js — for the scheduled set).
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Drill-in state: 'grid' shows all blocks; 'campaign' shows one campaign's posts.
let _stashView = { mode: 'grid', campaignId: null };
// Stash-item ids that already live on the Trail Map (effective status 'scheduled').
let _scheduledStashIds = new Set();

// Action icons — inline line-art matching the Cave's clan/watch/cut set
// (16-grid, stroke=currentColor, so button colour governs). Replaces the old
// emoji (✏️/📋/🗑️) which read inconsistently and weren't self-explanatory.
const _SVG = (paths) =>
  `<svg class="icon" viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" ` +
  `stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
const EDIT_ICON  = _SVG('<path d="M10.5 2.5 L13.5 5.5 L6 13 L3 13.5 L3.5 10.5 Z"/><path d="M9.5 3.5 L12.5 6.5"/>');
const COPY_ICON  = _SVG('<rect x="5.5" y="5.5" width="8" height="8" rx="1.2"/><path d="M3 10.5 V3 A1 1 0 0 1 4 2 H10.5"/>');
const TRASH_ICON = _SVG('<path d="M2.5 4 H13.5"/><path d="M5.75 4 V2.5 H10.25 V4"/><path d="M3.75 4 L4.5 13.5 H11.5 L12.25 4"/><path d="M6.5 6.5 V11 M9.5 6.5 V11"/>');
const OPEN_ICON  = _SVG('<path d="M9 2.5 H13.5 V7"/><path d="M13.5 2.5 L8 8"/><path d="M11.5 9 V12.5 A1 1 0 0 1 10.5 13.5 H3.5 A1 1 0 0 1 2.5 12.5 V5.5 A1 1 0 0 1 3.5 4.5 H7"/>');

// Post-type → short human label. Campaign posts carry post_type; loose items don't.
const POST_TYPE_LABELS = {
  announcement:        'ANNOUNCEMENT',
  headliner_spotlight: 'HEADLINER',
  support_spotlight:   'SUPPORT',
  mid_campaign_push:   'MID-PUSH',
  countdown_7d:        '7-DAY',
  countdown_3d:        '3-DAY',
  countdown_1d:        '1-DAY',
  countdown_day_of:    'DAY OF',
  day_of_doors:        'DOORS',
  ticket_push:         'TICKETS',
  recap:               'RECAP',
  throwback:           'THROWBACK',
  custom:              'CUSTOM',
};

function postTypeLabel(pt) {
  if (!pt) return '';
  return POST_TYPE_LABELS[pt] || pt.replace(/_/g, ' ').toUpperCase();
}

// True for countdown-style post types (gets the accent badge treatment).
function _isCountdownType(pt) {
  return !!pt && (/^countdown_/.test(pt) || pt === 'day_of_doors');
}

function resetStashView() { _stashView = { mode: 'grid', campaignId: null }; }

// Refresh the scheduled-id set from the shared Trail Map cache (single source of
// truth). Called on entering the Stash so it reflects the latest calendar.
async function loadScheduledStashIds() {
  try {
    if (typeof loadScheduled === 'function') {
      await loadScheduled();
      const rows = (typeof getScheduled === 'function') ? getScheduled() : [];
      _scheduledStashIds = new Set(rows.map(p => p.stash_item_id).filter(Boolean));
      return;
    }
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/scheduled_posts`);
    const j = await r.json();
    _scheduledStashIds = new Set((j.posts || []).map(p => p.stash_item_id).filter(Boolean));
  } catch (e) {
    console.warn('[stash] scheduled ids load failed', e);
    _scheduledStashIds = new Set();
  }
}

function _effectiveStatus(item) {
  return _scheduledStashIds.has(item.id) ? 'scheduled' : (item.status || 'draft');
}

// ── Grouping (shared with the Trail Map drawer) ──────────
// Campaign-bridged items group by campaignId; everything else is a standalone.
function groupStashByCampaign(items) {
  const campaigns = new Map();
  const singles = [];
  items.forEach(item => {
    if (item.campaignId) {
      if (!campaigns.has(item.campaignId)) campaigns.set(item.campaignId, []);
      campaigns.get(item.campaignId).push(item);
    } else {
      singles.push(item);
    }
  });
  return { campaigns, singles };
}

// ── Filtering ────────────────────────────────────────────
function _filterStash(lib) {
  const search = (document.getElementById('stashSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('stashTypeFilter')?.value || '';
  const statusFilter = document.getElementById('stashStatusFilter')?.value || '';

  let items = lib.slice();
  if (search) items = items.filter(i =>
    (i.content || '').toLowerCase().includes(search) ||
    (i.label || '').toLowerCase().includes(search) ||
    (i.eventName || '').toLowerCase().includes(search));
  if (typeFilter) items = items.filter(i => i.type === typeFilter);
  // Scheduled items STAY visible (marked with a SCHEDULED badge) rather than
  // vanishing — Doug's call: clarity over hiding. The status filter still works.
  if (statusFilter) items = items.filter(i => _effectiveStatus(i) === statusFilter);
  return items;
}

// ── Date helpers ─────────────────────────────────────────
function _fmtShort(d) {
  const dt = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dt)) return '';
  return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function _campaignDateRange(group) {
  const dates = group.map(i => i.scheduledFor).filter(Boolean)
    .map(d => new Date(d)).filter(d => !isNaN(d)).sort((a, b) => a - b);
  if (!dates.length) return '';
  const first = dates[0], last = dates[dates.length - 1];
  return first.getTime() === last.getTime() ? _fmtShort(first) : `${_fmtShort(first)}–${_fmtShort(last)}`;
}

// ── Tile builders ────────────────────────────────────────
function _countdownBadgeHTML(item) {
  if (!item.postType) return '';
  const cls = _isCountdownType(item.postType) ? ' countdown-badge--cd' : '';
  return `<span class="countdown-badge${cls}">${esc(postTypeLabel(item.postType))}</span>`;
}

function _campaignTileHTML(campaignId, group) {
  const cover = (group.find(i => i.imageUrl) || {}).imageUrl || '';
  const title = esc(group[0].eventName || 'Campaign');
  const eventId = group[0].eventId || '';
  const n = group.length;
  const scheduledN = group.filter(i => _scheduledStashIds.has(i.id)).length;
  const range = _campaignDateRange(group);
  const coverInner = cover
    ? `<img src="${esc(cover)}" alt="">`
    : '<span class="stash-block-noimg">📣</span>';
  // Hover settings — open the underlying Gathering, or delete the whole campaign
  // from the stash. stopPropagation so the click doesn't also drill in.
  const settings = `<div class="stash-block-settings">
      ${eventId ? `<button class="action-btn" onclick="event.stopPropagation();openGathering('${eventId}')" title="Open Gathering">${OPEN_ICON}</button>` : ''}
      <button class="action-btn" onclick="event.stopPropagation();deleteStashCampaign('${campaignId}')" title="Delete campaign from stash">${TRASH_ICON}</button>
    </div>`;
  const sub = `${n} piece${n === 1 ? '' : 's'}${scheduledN ? ` · ${scheduledN} scheduled` : ''}${range ? ' · ' + range : ''}`;
  return `<div class="stash-block stash-block--campaign" onclick="openStashCampaign('${campaignId}')" title="Open campaign">
    <div class="stash-block-cover">${coverInner}<span class="stash-block-count">${n}</span>${settings}</div>
    <div class="stash-block-body">
      <div class="stash-block-title">${title}</div>
      <div class="stash-block-sub">${sub}</div>
    </div>
  </div>`;
}

// A single post tile — used for loose items at top level AND for posts inside a
// drilled-in campaign. Clicking the cover opens it in the Forge; hover reveals
// edit / copy / delete (Cave-style icons).
function _postTileHTML(item) {
  const preview = (item.content || '').slice(0, 90).replace(/\n/g, ' ');
  const coverInner = item.imageUrl
    ? `<img src="${esc(item.imageUrl)}" alt="">`
    : `<span class="stash-block-noimg">${esc(item.icon || '📝')}</span>`;
  const title = esc(item.label
    || (item.postType ? postTypeLabel(item.postType) : contentTypeLabel(item.type)));
  const status = _effectiveStatus(item);
  // Suggested date — campaign posts carry a proposed send date; loose items show
  // when they were saved. Small print, so it's clear WHEN each is meant to go out.
  const when = item.scheduledFor
    ? `<div class="stash-block-when">Proposed · ${_fmtShort(item.scheduledFor)}</div>`
    : `<div class="stash-block-when">Saved · ${_fmtShort(item.created)}</div>`;
  return `<div class="stash-block stash-block--single">
    <div class="stash-block-cover" onclick="editStashItem('${item.id}')" title="Open in Forge">${coverInner}${_countdownBadgeHTML(item)}</div>
    <div class="stash-block-body">
      <div class="stash-block-title">${title}</div>
      ${when}
      <div class="stash-block-preview">${esc(preview)}</div>
      <div class="stash-block-meta"><span class="stash-status ${status}">${status}</span></div>
    </div>
    <div class="stash-block-actions">
      <button class="action-btn" onclick="event.stopPropagation();editStashItem('${item.id}')" title="Edit in Forge">${EDIT_ICON}</button>
      <button class="action-btn" onclick="event.stopPropagation();copyStashItem('${item.id}')" title="Copy text">${COPY_ICON}</button>
      <button class="action-btn" onclick="event.stopPropagation();deleteStashItem('${item.id}')" title="Delete">${TRASH_ICON}</button>
    </div>
  </div>`;
}

function _stashHeaderHTML(n) {
  return `<div class="stash-head"><span class="stash-head-title">STASH</span><span class="stash-head-count">${n} piece${n === 1 ? '' : 's'}</span></div>`;
}

// ── Render ───────────────────────────────────────────────
function renderStash() {
  const el = document.getElementById('stashList');
  if (!el) return;
  const items = _filterStash(getContentLibrary());
  if (_stashView.mode === 'campaign') { _renderStashDrillIn(el, items); return; }
  _renderStashGrid(el, items);
}

function _renderStashGrid(el, items) {
  if (!items.length) {
    const hasAny = getContentLibrary().length > 0;
    el.innerHTML = _stashHeaderHTML(0) +
      `<div class="empty"><div class="ico">📦</div><p>${hasAny ? 'No content matches your filters.' : 'Your stash is empty. Generate content in the Forge and save it here.'}</p></div>`;
    return;
  }
  const { campaigns, singles } = groupStashByCampaign(items);
  const tiles = [];
  campaigns.forEach((group, cid) => tiles.push(_campaignTileHTML(cid, group)));
  singles.forEach(item => tiles.push(_postTileHTML(item)));
  el.innerHTML = _stashHeaderHTML(items.length) + `<div class="stash-grid">${tiles.join('')}</div>`;
}

function _renderStashDrillIn(el, items) {
  const cid = _stashView.campaignId;
  const group = items.filter(i => i.campaignId === cid)
    .sort((a, b) => new Date(a.scheduledFor || a.created) - new Date(b.scheduledFor || b.created));
  // Resolve a title even if filters emptied the visible group.
  const named = group[0] || getContentLibrary().find(i => i.campaignId === cid) || {};
  const title = esc(named.eventName || 'Campaign');
  const head = `<div class="stash-drill-head">
      <button class="stash-back" onclick="closeStashCampaign()">‹ All stash</button>
      <span class="stash-drill-title">${title}</span>
      <span class="stash-drill-count">${group.length} piece${group.length === 1 ? '' : 's'}</span>
    </div>`;
  if (!group.length) {
    el.innerHTML = head + `<div class="empty"><div class="ico">📦</div><p>No posts match your filters in this campaign.</p></div>`;
    return;
  }
  el.innerHTML = head + `<div class="stash-grid">${group.map(_postTileHTML).join('')}</div>`;
}

function openStashCampaign(campaignId) { _stashView = { mode: 'campaign', campaignId }; renderStash(); }
function closeStashCampaign() { resetStashView(); renderStash(); }

// Open the Gathering behind a campaign (jump to the Gatherings tab + detail).
function openGathering(eventId) {
  if (!eventId) return;
  if (typeof switchTab === 'function') switchTab('events');
  if (typeof openEvent === 'function') openEvent(eventId);
}

// Delete an entire campaign's posts from the Stash. Clears them from stash_items
// only — the Gathering and its campaign record stay put. Optimistic, then DELETEs.
async function deleteStashCampaign(campaignId) {
  const items = getContentLibrary().filter(i => i.campaignId === campaignId);
  if (!items.length) return;
  const name = items[0].eventName || 'this campaign';
  const n = items.length;
  if (!confirm(`Delete all ${n} post${n === 1 ? '' : 's'} in "${name}" from your Stash?\n\nThis only clears them from the Stash — the Gathering itself stays. Cannot be undone.`)) return;
  const ids = new Set(items.map(i => i.id));
  // Optimistic: drop from the shared cache (defined in firepit.js) and re-render.
  _stashCache = _stashCache.filter(i => !ids.has(i.id));
  resetStashView();
  renderStash();
  updateStashCount();
  for (const id of ids) {
    try { await scAuth.authedFetch(`${forgeApiUrl}/api/stash/${id}`, { method: 'DELETE' }); }
    catch (e) { console.warn('[stash] campaign post delete failed', id, e); }
  }
}

// ── Filters + count ──────────────────────────────────────
function populateStashTypeFilter() {
  const sel = document.getElementById('stashTypeFilter');
  if (!sel) return;
  const types = new Set(getContentLibrary().map(i => i.type));
  const existing = sel.value;
  sel.innerHTML = '<option value="">All types</option>' +
    [...types].map(t => `<option value="${t}">${contentTypeLabel(t)}</option>`).join('');
  sel.value = existing;
}

// The live count now lives inside the Stash panel header (see _stashHeaderHTML).
// Keep the FIREPIT top-pill + subnav badges empty so the count shows in one place.
function updateStashCount() {
  const fp = document.getElementById('firepitCount');
  if (fp) fp.textContent = '';
  const sub = document.getElementById('stashCountSubnav');
  if (sub) sub.textContent = '';
}
