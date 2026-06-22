// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREPIT — CONTENT PRODUCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let firepitMode = 'forge';
let forgeGeneratedContent = '';
let forgeGeneratedImageUrl = '';
let forgeGeneratedVideoUrl = '';   // Phase D: composite MP4 once a Beat is added
let _brandKits = [];
let _compositorActive = false;
let _forgePickedSnapshot = '';     // draft content at load time — detects unsaved edits
let forgeApiUrl = scApiBase();

// Reference-image upload state + handlers live in js/forge_refs.js (role-tagged
// uploads — WHO/WHERE/WHAT/STYLE chips per the context-pipeline spec).

// Which content types should auto-generate an image alongside the text.
const OUTPUT_MEDIA = {
  social_post:     'image',
  social_carousel: 'image',
  event_promo:     'image',
  event_poster:    'image',
  artist_bio:      'image',
};

// Forge formats — 3 since 2026-06-11 (wiki/spec/forge_context_pipeline.md):
// Flyer absorbed Event Poster + Event Promo; Artist Bio folds into Post later
// (Spotlight mode). Internal keys unchanged so backend templates, image routing,
// compositor templates and stashed items all keep resolving.
const CONTENT_TYPES = {
  social_post:     { label:'Still',    icon:'', iconKey:'carousel', fields:['artist','freeform'], maxLength:2200 },
  social_carousel: { label:'Carousel', icon:'', iconKey:'carousel', fields:['artist','freeform'], maxLength:2200 },
  event_poster:    { label:'Flyer',    icon:'', iconKey:'lineup',   fields:['event_details','artist_list','freeform'] },
};
// Retired picker formats: legacy Stash items keep readable labels and reopen in
// the nearest current format.
const LEGACY_TYPE_LABELS   = { event_promo:'Event Promo', artist_bio:'Artist Bio' };
const LEGACY_TYPE_FALLBACK = { event_promo:'event_poster', artist_bio:'social_post' };
function contentTypeLabel(t) { return CONTENT_TYPES[t]?.label || LEGACY_TYPE_LABELS[t] || t; }

// Stash storage moved from localStorage to Supabase via /api/stash backend proxy.
// Render functions stay sync by reading from this in-memory cache, hydrated on
// renderFirepit(). Mutations update the cache optimistically and POST/DELETE to
// the API in the background. All requests carry the user's JWT via
// scAuth.authedFetch; content_api.py resolves the user from that token and 401s
// without it (no DEV_USER_ID fallback).
let _stashCache = [];

function getContentLibrary() { return _stashCache; }

// Map server row -> UI item shape used by renderStash, editStashItem, etc.
function _stashRowToItem(row) {
  const m = row.metadata || {};
  return {
    id: row.id,
    type: m.type || 'social_post',
    label: m.label,
    icon: m.icon,
    content: row.content || '',
    imageUrl: row.media_url || null,
    context: m.context || {},
    status: m.status || 'draft',
    created: row.created_at,
    modified: row.created_at,
    // Campaign linkage — campaign-bridged rows store these at the metadata
    // top level (see _upsert_post_into_stash in campaigns_api.py). Carrying
    // them through is what lets the Stash group posts into campaign blocks
    // and render countdown labels. Loose Forge items leave them null.
    source: m.source || null,
    campaignId: m.campaign_id || null,
    eventId: m.event_id || null,
    eventName: m.event_name || null,
    postType: m.post_type || null,
    scheduledFor: m.scheduled_for || null,
  };
}

async function loadStash() {
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/stash`);
    if (!r.ok) throw new Error(`stash GET ${r.status}`);
    const j = await r.json();
    _stashCache = (j.items || []).map(_stashRowToItem);
  } catch (e) {
    console.warn('stash load failed', e);
    _stashCache = [];
  }
  await migrateLocalStorageStash();
}

async function migrateLocalStorageStash() {
  const raw = localStorage.getItem('sc_content_library');
  if (!raw) return;
  let legacy;
  try { legacy = JSON.parse(raw); } catch { localStorage.removeItem('sc_content_library'); return; }
  if (!Array.isArray(legacy) || !legacy.length) {
    localStorage.removeItem('sc_content_library');
    return;
  }
  console.log(`migrating ${legacy.length} legacy Stash items to Supabase`);
  for (const item of legacy) {
    try {
      const r = await scAuth.authedFetch(`${forgeApiUrl}/api/stash`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          type: item.type,
          label: item.label,
          icon: item.icon,
          content: item.content,
          imageUrl: item.imageUrl,
          context: item.context,
          status: item.status || 'draft',
        }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j.item) _stashCache.unshift(_stashRowToItem(j.item));
      }
    } catch (e) { console.warn('migrate item failed', e); }
  }
  localStorage.removeItem('sc_content_library');
}

function setFirepitMode(mode, btn) {
  firepitMode = mode;
  window._firepitMode = mode; // exposed for global firepitSubnav active-state sync
  document.querySelectorAll('.firepit-mode').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['forge','conjure','stash','trailmap'].forEach(m => {
    const el = document.getElementById(`firepit-${m}`);
    if (el) el.style.display = m === mode ? 'block' : 'none';
  });
  // Sync the global firepit subnav active state too.
  const fpsub = document.getElementById('firepitSubnav');
  if (fpsub) {
    fpsub.querySelectorAll('.cave-subtab').forEach(el => {
      el.classList.toggle('active', el.dataset.subtab === mode);
    });
  }
  if (mode === 'stash') {
    if (typeof resetStashView === 'function') resetStashView();
    // Refresh the scheduled-id set so items already on the Trail Map stay hidden.
    if (typeof loadScheduledStashIds === 'function') loadScheduledStashIds().then(renderStash);
    else renderStash();
  }
  if (mode === 'trailmap' && typeof renderTrailMap === 'function') renderTrailMap();
}

async function renderFirepit() {
  updateForgeFields();
  await loadStash();
  await loadBrandKits();
  await loadSpirits();
  if (typeof loadScheduledStashIds === 'function') await loadScheduledStashIds();
  updateStashCount();
  populateStashTypeFilter();
  if (firepitMode === 'stash') renderStash();
  checkApiStatus();
}

// ── Brand kits (for the Forge selector + compositor handoff) ─────
async function loadBrandKits() {
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/brand_kits`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    _brandKits = j.kits || [];
  } catch (e) {
    console.warn('loadBrandKits failed:', e);
    _brandKits = [];
  }
  populateBrandSelect();
}

function populateBrandSelect() {
  const sel = document.getElementById('forgeBrandSelect');
  if (!sel) return;
  const previous = sel.value;
  sel.replaceChildren();
  const none = document.createElement('option');
  none.value = ''; none.textContent = '— No brand kit —';
  sel.appendChild(none);
  _brandKits.forEach(kit => {
    const opt = document.createElement('option');
    opt.value = kit.id;
    opt.textContent = kit.name;
    sel.appendChild(opt);
  });
  if (previous && _brandKits.some(k => k.id === previous)) sel.value = previous;
  // Refresh the template dropdown in case the loaded kits changed it.
  populateTemplateSelect();
}

function _selectedBrandKit() {
  const sel = document.getElementById('forgeBrandSelect');
  if (!sel || !sel.value) return null;
  return _brandKits.find(k => k.id === sel.value) || null;
}

// ── Spirits (avatars — reusable character/face reference sets) ─────
// Loaded into the Forge "Spirit" select; the Spirits modal (js/spirits.js)
// owns create/delete and calls loadSpirits() to refresh this select.
let _spirits = [];
async function loadSpirits() {
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/avatars`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();
    _spirits = j.avatars || [];
  } catch (e) {
    console.warn('loadSpirits failed:', e);
    _spirits = [];
  }
  populateSpiritSelect();
}
function populateSpiritSelect() {
  const sel = document.getElementById('forgeSpiritSelect');
  if (!sel) return;
  const previous = sel.value;
  sel.replaceChildren();
  const none = document.createElement('option');
  none.value = ''; none.textContent = '— No spirit —';
  sel.appendChild(none);
  _spirits.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });
  if (previous && _spirits.some(s => s.id === previous)) sel.value = previous;
}
function _selectedSpirit() {
  const sel = document.getElementById('forgeSpiritSelect');
  if (!sel || !sel.value) return null;
  return _spirits.find(s => s.id === sel.value) || null;
}

// ── Brand-bound caption templates (Phase B of Forge text rework) ──
function _currentContentType() {
  return document.getElementById('forgeContentType')?.value || '';
}

function _visibleTemplatesForCurrentContext() {
  const brand = _selectedBrandKit();
  if (!brand) return [];
  const all = Array.isArray(brand.templates) ? brand.templates : [];
  const ct = _currentContentType();
  // Show templates tagged with current content type + any "general" (untagged) templates.
  return all.filter(t => !t.content_type || t.content_type === ct);
}

function populateTemplateSelect() {
  const row = document.getElementById('forgeTemplateRow');
  const sel = document.getElementById('forgeTemplateSelect');
  if (!row || !sel) return;
  const brand = _selectedBrandKit();
  if (!brand) {
    row.style.display = 'none';
    return;
  }
  row.style.display = '';
  const visible = _visibleTemplatesForCurrentContext();
  sel.replaceChildren();
  const none = document.createElement('option');
  none.value = '';
  none.textContent = visible.length ? '— No template —' : '— No templates saved yet —';
  sel.appendChild(none);
  if (!visible.length) {
    sel.disabled = true;
    return;
  }
  sel.disabled = false;
  visible.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t.id;
    opt.textContent = t.name;
    sel.appendChild(opt);
  });
}

async function _patchBrandTemplates(kitId, templates) {
  const r = await scAuth.authedFetch(`${forgeApiUrl}/api/brand_kits/${kitId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ templates }),
  });
  if (!r.ok) throw new Error(`brand_kits PATCH ${r.status}`);
  const j = await r.json();
  if (j.kit) {
    _brandKits = _brandKits.map(k => k.id === j.kit.id ? j.kit : k);
  }
  return j.kit;
}

// (saveDraftAsTemplate deleted 2026-06-11 with the SAVE TEMPLATE button — the
// P1.5 button cull. Existing templates still load via the select below; a
// create path can return inside Marks if needed.)

function _loadTemplateIntoDraft(template) {
  if (!template) return;
  const out = document.getElementById('forgeOutputArea');
  let ta = document.getElementById('forgeOutputText');
  // If a variant has been picked, confirm before clobbering edits.
  if (ta && ta.value && ta.value !== _forgePickedSnapshot && ta.value.trim() !== '') {
    if (!window.confirm('Replace the current draft with this template?')) return;
  }
  // If we were mid variant-picker (no textarea yet), drop the variant UI and render a fresh textarea.
  if (!ta) {
    out.replaceChildren();
    ta = document.createElement('textarea');
    ta.className = 'forge-output';
    ta.id = 'forgeOutputText';
    ta.addEventListener('input', () => {
      forgeGeneratedContent = ta.value;
      updateCharCount();
    });
    out.appendChild(ta);
  }
  ta.value = template.text || '';
  forgeGeneratedContent = ta.value;
  _forgePickedSnapshot = ta.value;
  document.getElementById('forgeActions').style.display = 'block';
  updateCharCount();
}

async function openManageTemplates() {
  const brand = _selectedBrandKit();
  if (!brand) return;
  const templates = Array.isArray(brand.templates) ? brand.templates : [];
  if (!templates.length) {
    window.alert('No templates saved for this brand yet.');
    return;
  }
  // v1: simple line-by-line prompt asking which to delete by number. No modal.
  const lines = templates.map((t, i) => `${i + 1}. ${t.name}${t.content_type ? ` (${t.content_type})` : ''}`);
  const choice = window.prompt(
    `Templates for ${brand.name}:\n\n${lines.join('\n')}\n\nType a number to DELETE that template, or Cancel.`
  );
  if (choice == null) return;
  const idx = Number(choice) - 1;
  if (!Number.isInteger(idx) || idx < 0 || idx >= templates.length) {
    window.alert('Invalid choice.');
    return;
  }
  if (!window.confirm(`Delete "${templates[idx].name}"? This can't be undone.`)) return;
  const next = templates.filter((_, i) => i !== idx);
  try {
    await _patchBrandTemplates(brand.id, next);
    populateTemplateSelect();
  } catch (e) {
    console.error('delete template failed', e);
    window.alert(`Delete failed: ${e.message || e}`);
  }
}

function updateForgeFields() {
  const type = document.getElementById('forgeContentType').value;
  const ct = CONTENT_TYPES[type];
  if (!ct) return;
  // Context Stack containers (master spec §4): SUBJECT (L3) and FACTS (L4)
  // render separately so the form walks the stack top-to-bottom.
  const subjectEl = document.getElementById('forgeSubjectFields');
  const factsEl = document.getElementById('forgeFactFields');
  const favs = getFavourites();
  const artists = Object.entries(favs).filter(([,a]) => a.status !== 'cut').map(([u,a]) => ({username:u, name:a.display_name||u}));

  let subjectHtml = '';
  if (ct.fields.includes('artist')) {
    subjectHtml += `<div class="forge-input-group">
      <label class="forge-label">Artist</label>
      <select class="input" id="forgeArtist">
        <option value="">Select artist...</option>
        ${artists.map(a => `<option value="${esc(a.username)}">${esc(a.name)}</option>`).join('')}
        <option value="__custom">Custom (type below)</option>
      </select>
    </div>`;
  }

  let factsHtml = '';
  if (ct.fields.includes('artist_list')) {
    factsHtml += `<div class="forge-input-group">
      <label class="forge-label">Artists (lineup)</label>
      <textarea class="input" id="forgeArtistList" rows="2" placeholder="One artist per line, or comma-separated"></textarea>
    </div>`;
  }
  if (ct.fields.includes('event')) {
    factsHtml += `<div class="forge-input-group">
      <label class="forge-label">Event</label>
      <input class="input" id="forgeEvent" placeholder="Event name, venue, date...">
    </div>`;
  }
  if (ct.fields.includes('event_details')) {
    // Structured event facts — baked into the generated image as quoted text
    // lines (media_gen._baked_text_lines) since P1.5 (2026-06-11).
    factsHtml += `<div class="forge-input-group">
      <label class="forge-label">Event details</label>
      <input class="input" id="forgeEvent" placeholder="Night / event name (e.g. WAREHOUSE TECHNO)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px">
        <input class="input" id="forgeVenue"   placeholder="Venue (e.g. THE DOME)">
        <input class="input" id="forgeCity"    placeholder="City / location (e.g. LONDON)">
        <input class="input" id="forgeDate"    placeholder="Date (e.g. FRI 12 DEC)">
        <input class="input" id="forgeDoors"   placeholder="Doors open (e.g. 10PM)">
        <input class="input" id="forgeCurfew"  placeholder="End / curfew (e.g. 6AM)">
        <input class="input" id="forgeTickets" placeholder="Tickets (e.g. £12/£14)">
      </div>
    </div>`;
  }
  if (ct.fields.includes('release')) {
    factsHtml += `<div class="forge-input-group">
      <label class="forge-label">Release</label>
      <input class="input" id="forgeRelease" placeholder="Track/EP/album title, catalogue number...">
    </div>`;
  }

  // Value-preserving rebuild: re-renders arrive from many paths (tab switches,
  // supabase re-emitting SIGNED_IN on window refocus → roster refresh, type
  // changes) and must never eat typed input. Snapshot by id, rebuild, restore.
  const _prior = {};
  [subjectEl, factsEl].forEach(c => c && c.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.id && el.value) _prior[el.id] = el.value;
  }));
  if (subjectEl) subjectEl.innerHTML = subjectHtml;
  if (factsEl) factsEl.innerHTML = factsHtml;
  [subjectEl, factsEl].forEach(c => c && c.querySelectorAll('input, textarea, select').forEach(el => {
    if (el.id && _prior[el.id] !== undefined) el.value = _prior[el.id];
  }));
  // A format with no fact fields (Still) hides the section label.
  const factsLabel = document.getElementById('forgeFactsLabel');
  if (factsLabel) factsLabel.style.display = factsHtml ? '' : 'none';
  // Carousel only: the slide-count picker (Phase B).
  const slideWrap = document.getElementById('forgeSlideCountWrap');
  if (slideWrap) slideWrap.style.display = type === 'social_carousel' ? '' : 'none';
  updateCharCount();
}

function updateCharCount() {
  const type = document.getElementById('forgeContentType').value;
  const ct = CONTENT_TYPES[type];
  const el = document.getElementById('forgeCharCount');
  if (!ct || !ct.maxLength) { el.textContent = ''; return; }
  const len = forgeGeneratedContent.length;
  if (len === 0) { el.textContent = `Max ${ct.maxLength.toLocaleString()} chars`; return; }
  el.textContent = `${len.toLocaleString()} / ${ct.maxLength.toLocaleString()}`;
  el.classList.toggle('over', len > ct.maxLength);
}

async function checkApiStatus() {
  const el = document.getElementById('apiStatus');
  try {
    const r = await fetch(`${forgeApiUrl}/api/health`, {method:'GET', signal: AbortSignal.timeout(3000)});
    if (r.ok) { el.textContent = '🟢 Connected'; el.style.color = 'var(--green)'; }
    else { el.textContent = '🔴 Error'; el.style.color = 'var(--red)'; }
  } catch(e) {
    el.textContent = '⚫ Not running'; el.style.color = 'var(--muted)';
  }
}

function gatherForgeContext() {
  const type = document.getElementById('forgeContentType').value;
  const ct = CONTENT_TYPES[type];
  const ctx = { content_type: type };
  // L7 delivery: per-generation output size (4:5 / 9:16 / 1:1).
  ctx.size = document.getElementById('forgeSize')?.value || '4:5';
  // Carousel: slide count drives the copy (one slide = one image, Phase B).
  if (type === 'social_carousel') {
    ctx.n_slides = parseInt(document.getElementById('forgeSlideCount')?.value || '5', 10);
  }

  if (ct.fields.includes('artist')) {
    const sel = document.getElementById('forgeArtist');
    if (sel) {
      ctx.artist_username = sel.value === '__custom' ? '' : sel.value;
      if (ctx.artist_username) {
        const favs = getFavourites();
        const a = favs[ctx.artist_username];
        if (a) ctx.artist_data = { name: a.display_name, genre: a.genre, followers: a.snapshots?.slice(-1)[0]?.followers };
      }
    }
  }
  if (ct.fields.includes('artist_list')) {
    const el = document.getElementById('forgeArtistList');
    if (el) ctx.artist_list = el.value;
  }
  if (ct.fields.includes('event')) {
    const el = document.getElementById('forgeEvent');
    if (el) ctx.event = el.value;
  }
  if (ct.fields.includes('event_details')) {
    ctx.event   = document.getElementById('forgeEvent')?.value   || '';  // night / event name
    ctx.venue   = document.getElementById('forgeVenue')?.value   || '';
    ctx.city    = document.getElementById('forgeCity')?.value    || '';
    ctx.date    = document.getElementById('forgeDate')?.value    || '';
    ctx.doors   = document.getElementById('forgeDoors')?.value   || '';
    ctx.curfew  = document.getElementById('forgeCurfew')?.value  || '';
    ctx.tickets = document.getElementById('forgeTickets')?.value || '';
  }
  if (ct.fields.includes('release')) {
    const el = document.getElementById('forgeRelease');
    if (el) ctx.release = el.value;
  }
  ctx.freeform = document.getElementById('forgeFreeform')?.value || '';
  ctx.voice = document.getElementById('forgeVoice')?.value || 'underground';
  // Brand palette → image prompts (input-usage audit: the kit never reached image
  // gen at all — only the compositor overlay). Name + palette only; no logo/fonts.
  const _ctxBrand = _selectedBrandKit();
  if (_ctxBrand) ctx.brand = { name: _ctxBrand.name, palette: _ctxBrand.palette || {} };
  // Role-tagged references: [{data, role: who|where|what|style, note}]
  const _refs = forgeRefImagesPayload();
  if (_refs.length) ctx.reference_images = _refs;
  // A summoned Spirit contributes its reference images + routes to the avatar model.
  const spirit = _selectedSpirit();
  if (spirit) {
    ctx.avatar_id = spirit.id;
    if (spirit.preview_url) ctx.avatar_image_url = spirit.preview_url;
  }
  return ctx;
}

// (buildPosterOverlay deleted 2026-06-11 — flyers bake text into the image now;
// the server-side equivalent lives in media_gen._baked_text_lines.)

// Straight to output (P1.5, 2026-06-11): no variant-pick step — copy + image in
// one hit, iterate via REGEN. The 3-angle picker died with Doug's live review.

// ── Caption (wiki/spec/forge_output_column.md) — concise facts, per-format ──
// Base caption is assembled CLIENT-SIDE from the form facts (instant, no API);
// only ✨ Enhance hits the model. Keyed by content_type so new formats (tour,
// album release…) add a template, not a rewrite.
const _CAPTION_TEMPLATES = {
  event_poster(ctx) {
    const v = k => (ctx[k] || '').trim();
    const lineup = v('artist_list').split('\n').map(s => s.trim()).filter(Boolean).join(' · ');
    const when = [v('date'), [v('doors'), v('curfew')].filter(Boolean).join('–')].filter(Boolean).join(' · ');
    const place = [v('venue'), v('city')].filter(Boolean).join(' — ');
    return [v('event'), lineup, when, place, v('tickets')].filter(Boolean).join('\n');
  },
};
function _assembleCaption(ctx) {
  const fn = _CAPTION_TEMPLATES[ctx.content_type];
  return fn ? fn(ctx) : '';
}
function _showCaptionBox(text) {
  const box = document.getElementById('forgeCaptionBox');
  const ta = document.getElementById('forgeCaptionText');
  if (!box || !ta) return;
  ta.value = text || '';
  box.style.display = 'block';
}
function _hideCaptionBox() {
  const box = document.getElementById('forgeCaptionBox');
  if (box) box.style.display = 'none';
}

async function enhanceCaption() {
  const ta = document.getElementById('forgeCaptionText');
  const base = (ta.value || '').trim();
  if (!base) { ta.focus(); return; }
  const btn = document.getElementById('btnEnhanceCaption');
  const orig = btn.textContent;
  btn.textContent = '✨ …'; btn.disabled = true;
  try {
    const ctx = gatherForgeContext();
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/enhance-caption`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ caption: base, content_type: ctx.content_type }),
    });
    if (r.status === 402) { const j = await r.json().catch(() => ({})); throw new Error(`Insufficient credits — enhance costs ${j.cost || 1}.`); }
    if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `Enhance API error: ${r.status}`); }
    const data = await r.json();
    if (typeof data.credits_balance === 'number') updateCreditsDisplay(data.credits_balance);
    if (data.caption) { ta.value = data.caption; forgeGeneratedContent = data.caption; updateCharCount(); }
  } catch (e) { alert(e.message); }
  btn.textContent = orig; btn.disabled = false;
}

async function generateContent(variation) {
  const ctx = gatherForgeContext();
  if (variation) ctx.variation = variation;

  // Flyers (forge_output_column.md): caption = concise FACTS assembled
  // client-side (no flowery /api/generate call). The image still generates.
  if (ctx.content_type === 'event_poster') {
    document.getElementById('forgeOutputArea').innerHTML = '';
    forgeGeneratedContent = _assembleCaption(ctx);
    document.getElementById('forgeActions').style.display = 'block';
    _showCaptionBox(forgeGeneratedContent);
    updateCharCount();
    generateImage({ ...ctx, generated_text: '' });
    return;
  }

  const outputArea = document.getElementById('forgeOutputArea');
  const actionsEl = document.getElementById('forgeActions');
  outputArea.innerHTML = `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px">
    <span>Generating<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
  </div>`;
  actionsEl.style.display = 'none';
  _hideCaptionBox();
  _forgePickedSnapshot = '';

  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/generate`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(ctx)
    });
    if (r.status === 402) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Insufficient credits — this generation costs ${j.cost || 1}.`);
    }
    if (!r.ok) {
      // Surface the API's actual error (e.g. an unsupported reference image),
      // not a generic status code.
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `API error: ${r.status}`);
    }
    const data = await r.json();
    if (typeof data.credits_balance === 'number') updateCreditsDisplay(data.credits_balance);

    // Backend may still return variants (legacy callers) — take the first.
    forgeGeneratedContent = data.content
      || (Array.isArray(data.variants) && data.variants[0] && data.variants[0].text)
      || '';
    outputArea.innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(forgeGeneratedContent)}</textarea>`;
    actionsEl.style.display = 'block';
    updateCharCount();
    if (ctx.content_type === 'social_carousel') {
      // Phase B: one image per slide, shared seed, one locked style.
      generateCarouselImages({ ...ctx, generated_text: forgeGeneratedContent });
    } else if (OUTPUT_MEDIA[ctx.content_type] === 'image') {
      // Pass the copy along — it feeds the image prompt's mood cues.
      generateImage({ ...ctx, generated_text: forgeGeneratedContent });
    } else {
      document.getElementById('forgeImageArea').style.display = 'none';
    }
  } catch(e) {
    // Only blame the API connection when the request genuinely couldn't reach it
    // (network/fetch failure). A 4xx/5xx means the API IS up — show its message.
    const offline = (e instanceof TypeError) || /failed to fetch|networkerror|load failed/i.test(e.message || '');
    outputArea.innerHTML = `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px;flex-direction:column;gap:8px">
      <span style="font-family:var(--font-mono);color:var(--color-accent);font-weight:600">!</span>
      <span style="color:var(--red)">${esc(e.message)}</span>
      ${offline ? `<span style="color:var(--muted);font-size:11px">Make sure content_api.py is running: <code>python content_api.py</code></span>` : ''}
    </div>`;
  }
}

// Defined in app.js initReflection; safe shim so generation calls don't blow up
// if the Reflection tab hasn't been opened yet.
function updateCreditsDisplay(n) {
  const el = document.getElementById('reflectionCredits');
  if (el) el.textContent = n;
}

// ── Discard (P1.5) — clear the output column back to its resting state ──
function resetForgeOutput() {
  forgeGeneratedContent = '';
  forgeGeneratedImageUrl = '';
  forgeGeneratedVideoUrl = '';
  _forgePickedSnapshot = '';
  const _mv = document.getElementById('btnMakeVideo'); if (_mv) _mv.style.display = 'none';
  const _bp = document.getElementById('forgeBeatPanel'); if (_bp) _bp.style.display = 'none';
  _forgeSlideUrls = [];
  _forgeSlideTexts = [];
  _forgeActiveSlide = 0;
  _compositorActive = false;
  if (window.scCompositor) try { scCompositor.hide(); } catch (e) {}
  document.getElementById('forgeOutputArea').innerHTML =
    `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px">
      <span style="color:var(--muted)">Select a content type and hit Generate</span>
    </div>`;
  const imgArea = document.getElementById('forgeImageArea');
  imgArea.style.display = 'none';
  imgArea.innerHTML = '';
  _seedForgeVersions('');
  const _ri = document.getElementById('btnRefineImage'); if (_ri) _ri.style.display = 'none';
  _hideCaptionBox();
  document.getElementById('forgeActions').style.display = 'none';
  updateCharCount();
}

// ── Image lightbox (P1.5) — click the generated image to zoom ──
function openForgeLightbox(url) {
  const box = document.getElementById('forgeLightbox');
  if (!box || !url) return;
  document.getElementById('forgeLightboxImg').src = url;
  box.classList.add('open');
}
function closeForgeLightbox() {
  const box = document.getElementById('forgeLightbox');
  if (box) box.classList.remove('open');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeForgeLightbox();
});

// (Reference-image upload handlers moved to js/forge_refs.js.)

async function generateImage(ctx) {
  const imgArea = document.getElementById('forgeImageArea');
  imgArea.style.display = 'block';
  imgArea.innerHTML = `<div class="forge-image-loading">
    <div class="forge-image-skeleton"></div>
    <span>Generating image<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
  </div>`;

  const body = { ...ctx };
  if (forgeGeneratedContent) body.generated_text = forgeGeneratedContent;

  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/generate-image`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body)
    });
    if (r.status === 402) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Insufficient credits — this image costs ${j.cost || 5}.`);
    }
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `Image API error: ${r.status}`);
    }
    const data = await r.json();
    // image_url is now a fully-qualified Supabase Storage URL (Phase A migration).
    forgeGeneratedImageUrl = data.image_url;
    if (typeof data.credits_balance === 'number') updateCreditsDisplay(data.credits_balance);

    const _brand = _selectedBrandKit();
    // P1.5 (2026-06-11): flyers NEVER mount the text-overlay compositor — the
    // event text is baked into the generated image by the model. The overlay
    // stays available only for brand-kit Post/Carousel.
    const _posterType = ctx.content_type === 'event_poster' || ctx.content_type === 'event_promo';
    if (window.scCompositor && _brand && !_posterType) {
      _compositorActive = true;
      imgArea.style.display = 'none';
      window.scCompositor.show(ctx.content_type);
      window.scCompositor.applyBrandKit(_brand);
      window.scCompositor.applyBackground(forgeGeneratedImageUrl);
      window.scCompositor.applyContent({
        supporting: forgeGeneratedContent || '',
        event: ctx.event || '',
      });
      const _ri = document.getElementById('btnRefineImage'); if (_ri) _ri.style.display = 'none';
    } else {
      _compositorActive = false;
      const _cmp = document.getElementById('forgeCompositor');
      if (_cmp) _cmp.style.display = 'none';
      imgArea.innerHTML = `<img src="${forgeGeneratedImageUrl}" class="forge-image-preview" alt="Generated image" title="Click to zoom" onclick="openForgeLightbox(this.src)">
        <div class="forge-image-meta">
          ${data.dimensions.width}x${data.dimensions.height} | ${data.provider}/${data.model}
        </div>`;
      // Iteration loop: seed the version chain + offer refine (single images only).
      _seedForgeVersions(forgeGeneratedImageUrl);
      document.getElementById('btnRefineImage').style.display = '';
    }

    forgeGeneratedVideoUrl = '';
    document.getElementById('btnRegenImage').style.display = '';
    document.getElementById('btnDownloadImage').style.display = '';
    // ADD A BEAT → composite video (single-still formats only).
    const _mv = document.getElementById('btnMakeVideo');
    if (_mv) _mv.style.display = (ctx.content_type === 'social_carousel') ? 'none' : '';
  } catch(e) {
    imgArea.innerHTML = `<div class="forge-image-loading" style="flex-direction:column;gap:8px">
      <span style="font-family:var(--font-mono);color:var(--color-accent);font-weight:600">!</span>
      <span style="color:var(--red);font-size:12px">${e.message}</span>
      <span style="color:var(--muted);font-size:11px">Check FAL_KEY / REPLICATE_API_TOKEN in .env</span>
    </div>`;
  }
}

async function regenerateImage() {
  const ctx = gatherForgeContext();
  if (ctx.content_type === 'social_carousel' && _forgeSlideUrls.length) {
    // Retake the ACTIVE slide only (fresh seed for that slide).
    await _generateOneSlide({ ...ctx, generated_text: forgeGeneratedContent },
                            _forgeActiveSlide, Math.floor(Math.random() * 1e9));
    renderSlideStrip();
    return;
  }
  await generateImage({ ...ctx, generated_text: forgeGeneratedContent });
}

// ── Carousel — one image per slide (Phase B, master spec §6) ──
let _forgeSlideUrls = [];     // image url per slide, in order
let _forgeSlideTexts = [];    // the slide's own line (caption strip / bake)
let _forgeActiveSlide = 0;

function _splitSlides(content, wanted) {
  const chunks = (content || '').split(/\n?-{3,}\n?/).map(s => s.trim()).filter(Boolean);
  // Drop a trailing hashtags-only chunk; cap at the picker count when sane.
  const slides = chunks.filter(c => !/^#[^\s]/.test(c.replace(/\n/g, ' ')));
  return (wanted && slides.length > wanted) ? slides.slice(0, wanted) : slides;
}

async function _generateOneSlide(ctx, i, seed) {
  const body = { ...ctx, seed,
    slide: { index: i + 1, count: _forgeSlideTexts.length, text: _forgeSlideTexts[i] || '' } };
  const r = await scAuth.authedFetch(`${forgeApiUrl}/api/generate-image`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    throw new Error(j.error || `slide ${i + 1}: API ${r.status}`);
  }
  const j = await r.json();
  if (typeof j.credits_balance === 'number') updateCreditsDisplay(j.credits_balance);
  _forgeSlideUrls[i] = j.image_url;
  return j;
}

async function generateCarouselImages(ctx) {
  const imgArea = document.getElementById('forgeImageArea');
  imgArea.style.display = 'block';
  _forgeSlideTexts = _splitSlides(forgeGeneratedContent, ctx.n_slides);
  _forgeSlideUrls = new Array(_forgeSlideTexts.length).fill(null);
  _forgeActiveSlide = 0;
  const seed = Math.floor(Math.random() * 1e9);   // one seed = one locked style
  for (let i = 0; i < _forgeSlideTexts.length; i++) {
    imgArea.innerHTML = `<div class="forge-image-loading">Forging slide ${i + 1} / ${_forgeSlideTexts.length}…</div>` + _slideStripHTML();
    try {
      await _generateOneSlide(ctx, i, seed);
    } catch (e) {
      console.warn('slide failed', i + 1, e);
    }
    renderSlideStrip();
  }
  forgeGeneratedImageUrl = _forgeSlideUrls.find(Boolean) || '';
  document.getElementById('btnRegenImage').style.display = '';
  document.getElementById('btnDownloadImage').style.display = '';
  _seedForgeVersions('');   // refine is single-image only
  document.getElementById('btnRefineImage').style.display = 'none';
}

function _slideStripHTML() {
  return `<div class="forge-slide-strip">` + _forgeSlideUrls.map((u, i) =>
    u ? `<img src="${u}" class="${i === _forgeActiveSlide ? 'active' : ''}" onclick="setActiveSlide(${i})" alt="slide ${i + 1}">`
      : `<span class="forge-slide-pending">${i + 1}</span>`).join('') + `</div>`;
}

function renderSlideStrip() {
  const imgArea = document.getElementById('forgeImageArea');
  const active = _forgeSlideUrls[_forgeActiveSlide];
  imgArea.innerHTML =
    (active
      ? `<img src="${active}" class="forge-image-preview" alt="Slide ${_forgeActiveSlide + 1}" title="Click to zoom" onclick="openForgeLightbox(this.src)">`
      : `<div class="forge-image-loading">slide pending…</div>`)
    + _slideStripHTML()
    + `<div class="forge-image-meta">slide ${_forgeActiveSlide + 1} / ${_forgeSlideUrls.length} — NEW IMAGE retakes this slide</div>`;
  forgeGeneratedImageUrl = active || forgeGeneratedImageUrl;
}

function setActiveSlide(i) {
  _forgeActiveSlide = i;
  renderSlideStrip();
}

// ── Iteration loop (wiki/spec/forge_iteration_loop.md) — refine, never reroll ──
// Feed the active output back into /api/refine-image with ONE instruction; the
// result is a new version off it. The chain lives client-side (MVP, no DB).
let _forgeVersions = [];      // [{ url, instruction }] — the version chain
let _forgeActiveVersion = 0;  // index = the base for the next refine

function _seedForgeVersions(url) {
  _forgeVersions = url ? [{ url, instruction: 'original' }] : [];
  _forgeActiveVersion = 0;
  const panel = document.getElementById('forgeRefinePanel');
  if (panel) panel.style.display = 'none';
  const inp = document.getElementById('forgeRefineInput');
  if (inp) inp.value = '';
}

function toggleRefinePanel() {
  const panel = document.getElementById('forgeRefinePanel');
  if (!panel) return;
  const show = panel.style.display === 'none';
  panel.style.display = show ? 'block' : 'none';
  if (show) { renderVersionStrip(); document.getElementById('forgeRefineInput').focus(); }
}

function renderVersionStrip() {
  const strip = document.getElementById('forgeVersionStrip');
  if (!strip) return;
  strip.innerHTML = _forgeVersions.map((v, i) =>
    `<img src="${esc(v.url)}" class="${i === _forgeActiveVersion ? 'active' : ''}" ` +
    `onclick="setActiveVersion(${i})" alt="v${i + 1}" ` +
    `title="v${i + 1}${v.instruction ? ': ' + esc(v.instruction) : ''}">`
  ).join('');
}

function setActiveVersion(i) {
  if (i < 0 || i >= _forgeVersions.length) return;
  _forgeActiveVersion = i;
  forgeGeneratedImageUrl = _forgeVersions[i].url;
  _showForgeImage(forgeGeneratedImageUrl, `version ${i + 1} / ${_forgeVersions.length}`);
  renderVersionStrip();
}

function _showForgeImage(url, meta) {
  const imgArea = document.getElementById('forgeImageArea');
  if (!imgArea) return;
  imgArea.style.display = 'block';
  imgArea.innerHTML =
    `<img src="${esc(url)}" class="forge-image-preview" alt="Generated image" title="Click to zoom" onclick="openForgeLightbox(this.src)">` +
    (meta ? `<div class="forge-image-meta">${esc(meta)}</div>` : '');
}

async function refineImage() {
  const inp = document.getElementById('forgeRefineInput');
  const instruction = (inp.value || '').trim();
  if (!instruction) { inp.focus(); return; }
  if (!_forgeVersions.length) return;

  const hint = document.getElementById('forgeRefineHint');
  if (hint) { hint.textContent = 'One change at a time lands best — the model keeps everything else.'; hint.style.color = ''; }

  const base = _forgeVersions[_forgeActiveVersion].url;
  const ctx = gatherForgeContext();
  const btn = document.getElementById('btnRefineGo');
  const orig = btn.textContent;
  btn.textContent = '⏳ Refining…'; btn.disabled = true;
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/refine-image`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        base_image_url: base,
        instruction,
        content_type: ctx.content_type,
        size: ctx.size,
        reference_images: ctx.reference_images || [],   // re-anchor: keep the STYLE ref in play
      }),
    });
    if (r.status === 402) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Insufficient credits — refine costs ${j.cost || 5}.`);
    }
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Refine API error: ${r.status}`);
    }
    const data = await r.json();
    if (typeof data.credits_balance === 'number') updateCreditsDisplay(data.credits_balance);
    // New version off the active one → becomes active + the next base.
    _forgeVersions.push({ url: data.image_url, instruction });
    _forgeActiveVersion = _forgeVersions.length - 1;
    forgeGeneratedImageUrl = data.image_url;
    forgeGeneratedVideoUrl = '';
    _showForgeImage(forgeGeneratedImageUrl,
      `version ${_forgeActiveVersion + 1} / ${_forgeVersions.length} · ${instruction}`);
    renderVersionStrip();
    inp.value = '';
  } catch (e) {
    if (hint) { hint.textContent = '⚠ ' + e.message; hint.style.color = 'var(--red)'; }
  }
  btn.textContent = orig; btn.disabled = false;
}

// ── Beat → composite video (Phase D, master spec §6/§10) ──
function openBeatPanel() {
  const p = document.getElementById('forgeBeatPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

const _BEAT_BLOCKED = new Set(['commercial_release', 'app_sound_or_rip', 'undocumented']);

async function makeBeatVideo(btn) {
  const errEl = document.getElementById('forgeBeatError');
  errEl.style.display = 'none';
  const file = document.getElementById('forgeBeatFile').files[0];
  const category = document.getElementById('forgeBeatRights').value;
  const proof = (document.getElementById('forgeBeatProof').value || '').trim();
  if (!file) { errEl.textContent = 'Pick an audio file first.'; errEl.style.display = 'block'; return; }
  if (!category) { errEl.textContent = 'Classify the track’s rights first.'; errEl.style.display = 'block'; return; }
  if (!_BEAT_BLOCKED.has(category) && !proof) {
    errEl.textContent = 'Add a proof link for this track before forging.'; errEl.style.display = 'block'; return;
  }
  if (!forgeGeneratedImageUrl) { errEl.textContent = 'Generate a still first.'; errEl.style.display = 'block'; return; }

  const orig = btn.textContent; btn.textContent = '⏳ Forging video…'; btn.disabled = true;
  try {
    const ctx = gatherForgeContext();
    const fd = new FormData();
    fd.append('data', JSON.stringify({
      ...ctx, media_type: 'video_composite',
      base_image_url: forgeGeneratedImageUrl,
      duration_seconds: 10,
      generated_text: forgeGeneratedContent,
      rights: { category, proof_url: proof || null },
    }));
    fd.append('audio_file', file);
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/generate-media`, { method: 'POST', body: fd });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.detail || j.error || `API ${r.status}`);
    }
    const j = await r.json();
    forgeGeneratedVideoUrl = j.media_url;
    const imgArea = document.getElementById('forgeImageArea');
    imgArea.innerHTML = `<video src="${j.media_url}" class="forge-image-preview" controls autoplay loop muted playsinline></video>
      <div class="forge-image-meta">${j.provider}/${j.model} · ${j.dimensions?.width}×${j.dimensions?.height}${_BEAT_BLOCKED.has(category) ? ' · ⚠️ can’t be scheduled (rights)' : ''}</div>`;
    document.getElementById('forgeBeatPanel').style.display = 'none';
    document.getElementById('btnDownloadImage').style.display = '';
  } catch (e) {
    errEl.textContent = e.message; errEl.style.display = 'block';
  }
  btn.textContent = orig; btn.disabled = false;
}

function downloadForgeImage() {
  const url = forgeGeneratedVideoUrl || forgeGeneratedImageUrl;
  if (!url) return;
  const a = document.createElement('a');
  a.href = url;
  a.download = `soundcave_${Date.now()}.png`;
  a.click();
}

// ── CONJURE (generative format): upload art + instruction → edit/animate via /api/conjure ──
let _conjureResult = null;

function conjurePreview() {
  const f = document.getElementById('conjureFile').files[0];
  if (f) document.getElementById('conjureStage').innerHTML =
    `<img src="${URL.createObjectURL(f)}" style="max-width:100%;max-height:70vh;">`;
}

async function conjureRun(action) {
  const f = document.getElementById('conjureFile').files[0];
  const prompt = document.getElementById('conjurePrompt').value.trim();
  const meta = document.getElementById('conjureMeta');
  if (!f) { meta.textContent = 'Upload artwork first.'; return; }
  if (!prompt) { meta.textContent = 'Type an instruction first.'; return; }
  const fd = new FormData();
  fd.append('image', f);
  fd.append('prompt', prompt);
  fd.append('action', action);
  fd.append('duration', document.getElementById('conjureDuration').value);
  document.querySelectorAll('#firepit-conjure button').forEach(b => b.disabled = true);
  meta.textContent = (action === 'edit' ? 'Editing image' : 'Animating video') + '… frontier models take ~30s–2min';
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/conjure`, { method: 'POST', body: fd });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || `conjure ${r.status}`);
    _conjureResult = { url: j.url, kind: j.kind, prompt };
    document.getElementById('conjureStage').innerHTML = j.kind === 'video'
      ? `<video src="${j.url}" autoplay loop muted playsinline controls style="max-width:100%;max-height:70vh;"></video>`
      : `<img src="${j.url}" style="max-width:100%;max-height:70vh;">`;
    document.getElementById('conjureSave').style.display = 'block';
    meta.textContent = `Done · ${j.kind}` + (j.credits_balance != null ? ` · ${j.credits_balance} credits left` : '');
  } catch (e) {
    meta.textContent = 'Error: ' + e.message;
  } finally {
    document.querySelectorAll('#firepit-conjure button').forEach(b => b.disabled = false);
  }
}

async function saveConjureToStash(btn) {
  if (!_conjureResult) return;
  const orig = btn.textContent; btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/stash`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'conjure', label: 'Conjure', icon: '✨',
        content: _conjureResult.prompt, imageUrl: _conjureResult.url,
        context: { kind: _conjureResult.kind, instruction: _conjureResult.prompt,
                   ...(_conjureResult.kind === 'video' ? { videoUrl: _conjureResult.url } : {}) },
        status: 'draft',
      }),
    });
    if (!r.ok) throw new Error(`stash ${r.status}`);
    const j = await r.json();
    if (j.item) _stashCache.unshift(_stashRowToItem(j.item));
    if (typeof updateStashCount === 'function') updateStashCount();
    btn.textContent = '✅ Saved';
  } catch (e) {
    btn.textContent = 'Save failed'; console.error('saveConjureToStash', e);
  } finally {
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 1600);
  }
}

async function saveToStash() {
  if (!forgeGeneratedContent) return;
  const type = document.getElementById('forgeContentType').value;
  const ct = CONTENT_TYPES[type];
  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '⏳ Saving…';
  try {
    // If the compositor is active, flatten the canvas and upload the composited PNG
    // (we reuse /api/brand_assets/upload as a public-storage drop until a dedicated
    // stash-media endpoint exists — same bucket size + auth model).
    let savedImageUrl = forgeGeneratedImageUrl || null;
    if (_compositorActive && window.scCompositor) {
      const blob = await window.scCompositor.toBlob();
      const fd = new FormData();
      fd.append('file', new File([blob], `composite_${Date.now()}.png`, { type: 'image/png' }));
      fd.append('kind', 'composite');
      const up = await scAuth.authedFetch(`${forgeApiUrl}/api/brand_assets/upload`, { method: 'POST', body: fd });
      if (!up.ok) throw new Error(`upload ${up.status}`);
      const upJson = await up.json();
      savedImageUrl = upJson.url;
    }
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/stash`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        type,
        label: ct ? ct.label : type,
        icon: ct ? ct.icon : '📝',
        content: forgeGeneratedContent,
        imageUrl: savedImageUrl,
        // Carousel sets ride in context.slideUrls (metadata JSON — no migration).
        context: { ...gatherForgeContext(),
                   ...(_forgeSlideUrls.filter(Boolean).length > 1 ? { slideUrls: _forgeSlideUrls.filter(Boolean) } : {}) },
        status: 'draft',
      }),
    });
    if (!r.ok) throw new Error(`stash POST ${r.status}`);
    const j = await r.json();
    if (j.item) _stashCache.unshift(_stashRowToItem(j.item));
    updateStashCount();
    btn.innerHTML = '✅ Saved!';
  } catch (e) {
    console.error('saveToStash failed', e);
    btn.innerHTML = '❌ Failed';
  }
  setTimeout(() => btn.innerHTML = orig, 1500);
}

// Stash VIEW (renderStash, updateStashCount, populateStashTypeFilter, campaign
// grouping, drill-in, postTypeLabel, scheduled-set) lives in js/stash.js.
// firepit.js owns the stash DATA layer (_stashCache, _stashRowToItem, loadStash,
// saveToStash) and the Forge-coupled mutations (editStashItem/copy/delete) below.

function editStashItem(id) {
  const lib = getContentLibrary();
  const item = lib.find(i => i.id === id);
  if (!item) return;
  setFirepitMode('forge', document.querySelector('.firepit-mode'));
  // Legacy types (event_promo, artist_bio) reopen in the nearest current format.
  const formatKey = CONTENT_TYPES[item.type] ? item.type : (LEGACY_TYPE_FALLBACK[item.type] || 'social_post');
  document.getElementById('forgeContentType').value = formatKey;
  updateForgeFields();
  const ctx = item.context || {};
  if (ctx.artist_username) { const el = document.getElementById('forgeArtist'); if (el) el.value = ctx.artist_username; }
  if (ctx.event) { const el = document.getElementById('forgeEvent'); if (el) el.value = ctx.event; }
  if (ctx.release) { const el = document.getElementById('forgeRelease'); if (el) el.value = ctx.release; }
  if (ctx.artist_list) { const el = document.getElementById('forgeArtistList'); if (el) el.value = ctx.artist_list; }
  // Structured event facts (previously dropped on reopen — fixed 2026-06-11)
  ['venue', 'city', 'date', 'doors', 'curfew', 'tickets'].forEach(k => {
    if (!ctx[k]) return;
    const el = document.getElementById('forge' + k[0].toUpperCase() + k.slice(1));
    if (el) el.value = ctx[k];
  });
  if (ctx.freeform) document.getElementById('forgeFreeform').value = ctx.freeform;
  forgeGeneratedContent = item.content;
  _hideCaptionBox();   // caption box is a generate-flow feature; Stash uses the output area
  forgeGeneratedImageUrl = item.imageUrl || '';
  // Restore a carousel set's slide strip (Phase B).
  const _slides = Array.isArray(ctx.slideUrls) ? ctx.slideUrls : [];
  _forgeSlideUrls = _slides.slice();
  _forgeSlideTexts = _slides.length ? _splitSlides(item.content, _slides.length) : [];
  _forgeActiveSlide = 0;
  document.getElementById('forgeOutputArea').innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(item.content)}</textarea>`;
  document.getElementById('forgeActions').style.display = 'block';
  // Restore image (or carousel slide strip) if present
  const imgArea = document.getElementById('forgeImageArea');
  if (_forgeSlideUrls.length > 1) {
    imgArea.style.display = 'block';
    renderSlideStrip();
    document.getElementById('btnRegenImage').style.display = '';
    document.getElementById('btnDownloadImage').style.display = '';
    _seedForgeVersions('');
    document.getElementById('btnRefineImage').style.display = 'none';
  } else if (forgeGeneratedImageUrl) {
    imgArea.style.display = 'block';
    imgArea.innerHTML = `<img src="${forgeGeneratedImageUrl}" class="forge-image-preview" alt="Generated image" title="Click to zoom" onclick="openForgeLightbox(this.src)">`;
    document.getElementById('btnRegenImage').style.display = '';
    document.getElementById('btnDownloadImage').style.display = '';
    _seedForgeVersions(forgeGeneratedImageUrl);   // refine a saved flyer too
    document.getElementById('btnRefineImage').style.display = '';
  } else {
    imgArea.style.display = 'none';
    imgArea.innerHTML = '';
    _seedForgeVersions('');
    document.getElementById('btnRefineImage').style.display = 'none';
  }
  updateCharCount();
}

async function copyStashItem(id) {
  const lib = getContentLibrary();
  const item = lib.find(i => i.id === id);
  if (!item) return;
  try { await navigator.clipboard.writeText(item.content); } catch(e) {}
}

async function deleteStashItem(id) {
  _stashCache = _stashCache.filter(i => i.id !== id);
  renderStash();
  updateStashCount();
  try {
    await scAuth.authedFetch(`${forgeApiUrl}/api/stash/${id}`, { method: 'DELETE' });
  } catch (e) { console.warn('stash delete failed', e); }
}

// ── Content-type picker (custom button grid) ──────────
// Replaces the native <select> so we can render bespoke SVG icons
// (browser <option> elements can't host SVGs). Hidden input keeps
// the .value get/set API the rest of firepit.js depends on.
document.addEventListener('DOMContentLoaded', () => {
  const picker = document.getElementById('forgePicker');
  if (picker) {
    const hidden = document.getElementById('forgeContentType');
    picker.querySelectorAll('.forge-picker-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        picker.querySelectorAll('.forge-picker-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        hidden.value = btn.dataset.value;
        hidden.dispatchEvent(new Event('change'));
      });
    });
  }

  // ── Compositor toolbar wiring (Phase 3) ─────────────
  const toolbar = document.querySelector('#forgeCompositor .compositor-toolbar');
  if (toolbar) {
    toolbar.addEventListener('click', (e) => {
      const t = e.target.closest('[data-action]');
      if (!t || !window.scCompositor) return;
      const action = t.dataset.action;
      if (action === 'text-size-up')   window.scCompositor.adjustTextSize(+0.10);
      if (action === 'text-size-down') window.scCompositor.adjustTextSize(-0.10);
      if (action === 'edit-text')      window.scCompositor.promptTextEdit();
      if (action === 'reset-layout')   window.scCompositor.resetLayout();
    });
  }

  // Selection change → toolbar context updates
  if (window.scCompositor) {
    window.scCompositor.onSelectionChange((node) => {
      const nameEl = document.getElementById('compositorSelectedName');
      const textTools = document.getElementById('compositorTextTools');
      const editWrap = document.getElementById('compositorEditTextWrap');
      const swatchRow = document.getElementById('compositorTextSwatches');
      if (!node) {
        if (nameEl) nameEl.textContent = '—';
        if (textTools) textTools.style.display = 'none';
        if (editWrap)  editWrap.style.display = 'none';
        return;
      }
      const labels = { logo: 'LOGO', headline_text: 'HEADLINE', supporting_text: 'BODY TEXT' };
      if (nameEl) nameEl.textContent = labels[node.layerType] || 'LAYER';
      const isText = node.layerType === 'headline_text' || node.layerType === 'supporting_text';
      if (textTools) textTools.style.display = isText ? 'flex' : 'none';
      if (editWrap)  editWrap.style.display = isText ? 'flex' : 'none';
      if (isText && swatchRow) {
        swatchRow.replaceChildren();
        const brand = window.scCompositor.brand();
        const palette = brand?.palette || {};
        ['primary', 'accent', 'text', 'text_stroke'].forEach(role => {
          if (!palette[role]) return;
          const sw = document.createElement('button');
          sw.type = 'button';
          sw.className = 'compositor-swatch';
          sw.style.background = palette[role];
          sw.title = role;
          sw.addEventListener('click', () => window.scCompositor.setTextColour(palette[role]));
          swatchRow.appendChild(sw);
        });
      }
    });
  }

  // Brand selector change → re-apply compositor brand AND repopulate the template dropdown.
  const brandSel = document.getElementById('forgeBrandSelect');
  if (brandSel) {
    brandSel.addEventListener('change', () => {
      populateTemplateSelect();
      if (!_compositorActive || !window.scCompositor) return;
      const kit = _selectedBrandKit();
      if (kit) window.scCompositor.applyBrandKit(kit);
      else window.scCompositor.hide();
    });
  }

  // Content type change → templates filtered to that type, so repopulate.
  const ctSel = document.getElementById('forgeContentType');
  if (ctSel) {
    ctSel.addEventListener('change', () => populateTemplateSelect());
  }

  // Template picker → load text into draft area.
  const tplSel = document.getElementById('forgeTemplateSelect');
  if (tplSel) {
    tplSel.addEventListener('change', () => {
      if (!tplSel.value) return;
      const brand = _selectedBrandKit();
      const tpl = (brand?.templates || []).find(t => t.id === tplSel.value);
      _loadTemplateIntoDraft(tpl);
      // Reset the selector so picking the same template again re-fires
      tplSel.value = '';
    });
  }

  // Manage templates (delete)
  const manageBtn = document.getElementById('forgeManageTemplates');
  if (manageBtn) {
    manageBtn.addEventListener('click', openManageTemplates);
  }
});
