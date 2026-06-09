// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREPIT — CONTENT PRODUCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let firepitMode = 'forge';
let forgeGeneratedContent = '';
let forgeGeneratedImageUrl = '';
let _brandKits = [];
let _compositorActive = false;
// Three-angle variant state (Phase A of Forge text rework)
let _forgeVariants = [];           // last response's variants, when variant mode fired
let _forgePickedIndex = null;      // index into _forgeVariants the user picked
let _forgePickedSnapshot = '';     // textarea content at pick time — used to detect edits on swap
let forgeApiUrl = localStorage.getItem('sc_api_url') || 'http://localhost:8000';

// Reference images uploaded for the current generation (base64 data URLs).
let _forgeRefImages = [];
const REF_IMAGES_MAX_COUNT = 5;
const REF_IMAGES_MAX_BYTES = 5 * 1024 * 1024; // 5MB per image
// Must match the backend allow-list in content_api._ref_images_to_blocks.
// HEIC (Mac), AVIF and SVG are NOT accepted by the image API.
const REF_IMAGES_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

// Which content types should auto-generate an image alongside the text.
const OUTPUT_MEDIA = {
  social_post:     'image',
  social_carousel: 'image',
  event_promo:     'image',
  event_poster:    'image',
  artist_bio:      'image',
};

// Forge content types — slim set focused on Meta + TikTok + Reddit.
// Captions are auto-generated inside the social types; no standalone "caption" type.
// Per wiki/spec/forge_output_recipes.md (Approved 2026-06-09): 5 types, each with its own recipe.
const CONTENT_TYPES = {
  social_post:     { label:'Post',                  icon:'', iconKey:'carousel',     fields:['artist','freeform'], maxLength:2200 },
  social_carousel: { label:'Carousel',              icon:'', iconKey:'carousel',     fields:['artist','freeform'], maxLength:2200 },
  event_promo:     { label:'Event Promotion',       icon:'', iconKey:'event_promo',  fields:['event','artist','freeform'] },
  event_poster:    { label:'Event Poster',          icon:'', iconKey:'lineup',       fields:['event','artist_list','freeform'] },
  artist_bio:      { label:'Artist Spotlight / Bio', icon:'', iconKey:'artist_bio',   fields:['artist','freeform'] },
};

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
  ['forge','stash','trailmap'].forEach(m => {
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

async function saveDraftAsTemplate() {
  const brand = _selectedBrandKit();
  if (!brand) {
    window.alert('Pick a brand first — templates are saved against the selected brand.');
    return;
  }
  const ta = document.getElementById('forgeOutputText');
  const text = (ta?.value || '').trim();
  if (!text) {
    window.alert('Nothing to save — generate or paste a draft first.');
    return;
  }
  const ct = _currentContentType();
  const suggested = (document.getElementById('forgeEvent')?.value || '').trim() || 'Untitled template';
  const name = window.prompt('Template name:', suggested);
  if (name == null) return;
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) { window.alert('Name cannot be empty.'); return; }
  const next = (Array.isArray(brand.templates) ? brand.templates : []).concat([{
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: trimmed,
    text,
    content_type: ct || null,
    created_at: new Date().toISOString(),
  }]);
  try {
    await _patchBrandTemplates(brand.id, next);
    populateTemplateSelect();
  } catch (e) {
    console.error('saveDraftAsTemplate failed', e);
    window.alert(`Save failed: ${e.message || e}`);
  }
}

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
  _forgeVariants = [];
  _forgePickedIndex = null;
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
  const container = document.getElementById('forgeDynamicFields');
  const favs = getFavourites();
  const artists = Object.entries(favs).filter(([,a]) => a.status !== 'cut').map(([u,a]) => ({username:u, name:a.display_name||u}));
  let html = '';

  if (ct.fields.includes('artist')) {
    html += `<div class="forge-input-group">
      <label class="forge-label">Artist</label>
      <select class="input" id="forgeArtist">
        <option value="">Select artist...</option>
        ${artists.map(a => `<option value="${esc(a.username)}">${esc(a.name)}</option>`).join('')}
        <option value="__custom">Custom (type below)</option>
      </select>
    </div>`;
  }
  if (ct.fields.includes('artist_list')) {
    html += `<div class="forge-input-group">
      <label class="forge-label">Artists (lineup)</label>
      <textarea class="input" id="forgeArtistList" rows="2" placeholder="One artist per line, or comma-separated"></textarea>
    </div>`;
  }
  if (ct.fields.includes('event')) {
    html += `<div class="forge-input-group">
      <label class="forge-label">Event</label>
      <input class="input" id="forgeEvent" placeholder="Event name, venue, date...">
    </div>`;
  }
  if (ct.fields.includes('release')) {
    html += `<div class="forge-input-group">
      <label class="forge-label">Release</label>
      <input class="input" id="forgeRelease" placeholder="Track/EP/album title, catalogue number...">
    </div>`;
  }
  container.innerHTML = html;
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
  if (ct.fields.includes('release')) {
    const el = document.getElementById('forgeRelease');
    if (el) ctx.release = el.value;
  }
  ctx.freeform = document.getElementById('forgeFreeform')?.value || '';
  ctx.voice = document.getElementById('forgeVoice')?.value || 'underground';
  if (_forgeRefImages.length) ctx.reference_images = _forgeRefImages.slice();
  // A summoned Spirit contributes its reference images + routes to the avatar model.
  const spirit = _selectedSpirit();
  if (spirit) {
    ctx.avatar_id = spirit.id;
    if (spirit.preview_url) ctx.avatar_image_url = spirit.preview_url;
  }
  return ctx;
}

// Short-form content types that support 3-variant generation. Long-form stays single-shot.
const VARIANT_TYPES = new Set(['social_post','social_carousel','event_promo','event_poster']);

async function generateContent(variation) {
  const ctx = gatherForgeContext();
  if (variation) ctx.variation = variation;
  // Three-angle variant mode for short-form types — but not on a SHORTER/LONGER/TONE refine.
  if (!variation && VARIANT_TYPES.has(ctx.content_type)) {
    ctx.n_variants = 3;
  }

  const outputArea = document.getElementById('forgeOutputArea');
  const actionsEl = document.getElementById('forgeActions');
  outputArea.innerHTML = `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px">
    <span>Generating<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
  </div>`;
  actionsEl.style.display = 'none';
  // Reset variant state — we're starting a fresh generation
  _forgeVariants = [];
  _forgePickedIndex = null;
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

    if (Array.isArray(data.variants) && data.variants.length > 0) {
      // VARIANT MODE — show picker. Image gen waits for the user to pick one.
      _forgeVariants = data.variants;
      renderVariantPicker(ctx);
      // Hide actions until a variant is picked
      actionsEl.style.display = 'none';
      document.getElementById('forgeImageArea').style.display = 'none';
    } else {
      // SINGLE-BLOCK MODE — long-form types, variations, or backend fallback.
      forgeGeneratedContent = data.content || '';
      outputArea.innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(forgeGeneratedContent)}</textarea>`;
      actionsEl.style.display = 'block';
      updateCharCount();
      if (OUTPUT_MEDIA[ctx.content_type] === 'image') generateImage(ctx);
      else document.getElementById('forgeImageArea').style.display = 'none';
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

function generateVariation(type) { generateContent(type); }

// ── Variant picker (Phase A of Forge text rework) ───────────
function renderVariantPicker(ctx) {
  const out = document.getElementById('forgeOutputArea');
  out.replaceChildren();

  const hint = document.createElement('div');
  hint.className = 'forge-variant-hint';
  hint.textContent = 'Three takes on the same brief. Pick one to edit and ship.';
  out.appendChild(hint);

  const cards = document.createElement('div');
  cards.className = 'forge-variant-cards';
  _forgeVariants.forEach((v, i) => {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'forge-variant-card';
    card.dataset.index = String(i);

    const label = document.createElement('div');
    label.className = 'forge-variant-label';
    label.textContent = v.angle || `VARIANT ${i + 1}`;
    card.appendChild(label);

    const preview = document.createElement('div');
    preview.className = 'forge-variant-preview';
    preview.textContent = v.text || '';
    card.appendChild(preview);

    card.addEventListener('click', () => pickVariant(i, ctx));
    cards.appendChild(card);
  });
  out.appendChild(cards);
}

function pickVariant(i, ctx) {
  const v = _forgeVariants[i];
  if (!v) return;
  // If the user is swapping after edits, confirm.
  if (_forgePickedIndex !== null && _forgePickedIndex !== i) {
    const ta = document.getElementById('forgeOutputText');
    if (ta && ta.value !== _forgePickedSnapshot) {
      if (!window.confirm('Discard your edits and load this variant?')) return;
    }
  }
  _forgePickedIndex = i;
  forgeGeneratedContent = v.text || '';
  _forgePickedSnapshot = forgeGeneratedContent;

  // Replace the picker contents with the editable textarea, keep the cards visible above.
  const out = document.getElementById('forgeOutputArea');
  // Remove previous textarea if present (re-pick path)
  const old = document.getElementById('forgeOutputText');
  if (old) old.remove();
  // Highlight the picked card
  out.querySelectorAll('.forge-variant-card').forEach((c) => {
    c.classList.toggle('is-picked', Number(c.dataset.index) === i);
  });
  // Append the editable textarea below the cards
  const ta = document.createElement('textarea');
  ta.className = 'forge-output';
  ta.id = 'forgeOutputText';
  ta.value = forgeGeneratedContent;
  ta.addEventListener('input', () => {
    forgeGeneratedContent = ta.value;
    updateCharCount();
  });
  out.appendChild(ta);

  document.getElementById('forgeActions').style.display = 'block';
  updateCharCount();

  // Fire image gen once per pick, with the chosen text + image_direction in ctx.
  if (OUTPUT_MEDIA[ctx.content_type] === 'image') {
    const imageCtx = { ...ctx, generated_text: forgeGeneratedContent };
    if (v.image_direction) imageCtx.image_direction = v.image_direction;
    generateImage(imageCtx);
  } else {
    document.getElementById('forgeImageArea').style.display = 'none';
  }
}

// ── Enhance current draft (Phase A) ─────────────────────────
async function enhanceDraft(btn) {
  const ta = document.getElementById('forgeOutputText');
  const draft = (ta?.value || '').trim();
  if (!draft) return;
  const orig = btn ? btn.textContent : '';
  if (btn) { btn.textContent = '⏳ Enhancing…'; btn.disabled = true; }
  try {
    const ctx = gatherForgeContext();
    const body = { ...ctx, text: draft };
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/enhance`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(body),
    });
    if (r.status === 402) {
      const j = await r.json().catch(() => ({}));
      throw new Error(`Insufficient credits — enhance costs ${j.cost || 1}.`);
    }
    if (!r.ok) throw new Error(`enhance ${r.status}`);
    const j = await r.json();
    if (typeof j.credits_balance === 'number') updateCreditsDisplay(j.credits_balance);
    const refined = j.content || draft;
    ta.value = refined;
    forgeGeneratedContent = refined;
    _forgePickedSnapshot = refined;
    updateCharCount();
  } catch (e) {
    console.error('enhanceDraft failed', e);
    if (btn) btn.textContent = '❌ Failed';
    setTimeout(() => { if (btn) { btn.textContent = orig; btn.disabled = false; } }, 1500);
    return;
  }
  if (btn) { btn.textContent = orig; btn.disabled = false; }
}

// ── Reference image upload ──────────────────────────────────
function handleRefImagesChange(event) {
  const errEl = document.getElementById('forgeRefImagesError');
  errEl.style.display = 'none';
  const files = Array.from(event.target.files || []);
  if (!files.length) return;

  if (_forgeRefImages.length + files.length > REF_IMAGES_MAX_COUNT) {
    errEl.textContent = `Max ${REF_IMAGES_MAX_COUNT} images.`;
    errEl.style.display = 'block';
    event.target.value = '';
    return;
  }
  const oversized = files.find(f => f.size > REF_IMAGES_MAX_BYTES);
  if (oversized) {
    errEl.textContent = `"${oversized.name}" is over 5MB.`;
    errEl.style.display = 'block';
    event.target.value = '';
    return;
  }
  const badType = files.find(f => !REF_IMAGES_SUPPORTED_TYPES.includes(f.type));
  if (badType) {
    errEl.textContent = `"${badType.name}" is ${badType.type || 'an unsupported format'} — use JPG, PNG, WebP or GIF.`;
    errEl.style.display = 'block';
    event.target.value = '';
    return;
  }
  Promise.all(files.map(readFileAsDataURL))
    .then(dataUrls => {
      _forgeRefImages = _forgeRefImages.concat(dataUrls);
      renderRefImageThumbs();
      event.target.value = '';
    })
    .catch(err => {
      errEl.textContent = `Read failed: ${err.message}`;
      errEl.style.display = 'block';
    });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error || new Error('read error'));
    r.readAsDataURL(file);
  });
}

// Build thumbs via DOM methods (no innerHTML with dynamic content).
function renderRefImageThumbs() {
  const wrap = document.getElementById('forgeRefImagesPreview');
  if (!wrap) return;
  wrap.replaceChildren();
  _forgeRefImages.forEach((src, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = src;
    img.alt = `ref ${i + 1}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = '×';
    btn.setAttribute('aria-label', 'Remove');
    btn.addEventListener('click', () => removeRefImage(i));
    thumb.appendChild(img);
    thumb.appendChild(btn);
    wrap.appendChild(thumb);
  });
}

function removeRefImage(i) {
  _forgeRefImages.splice(i, 1);
  renderRefImageThumbs();
}

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
    if (_brand && window.scCompositor) {
      _compositorActive = true;
      imgArea.style.display = 'none';
      window.scCompositor.show(ctx.content_type);
      window.scCompositor.applyBrandKit(_brand);
      window.scCompositor.applyBackground(forgeGeneratedImageUrl);
      window.scCompositor.applyContent({
        supporting: forgeGeneratedContent || '',
        event: ctx.event || '',
      });
    } else {
      _compositorActive = false;
      const _cmp = document.getElementById('forgeCompositor');
      if (_cmp) _cmp.style.display = 'none';
      imgArea.innerHTML = `<img src="${forgeGeneratedImageUrl}" class="forge-image-preview" alt="Generated image">
        <div class="forge-image-meta">
          ${data.dimensions.width}x${data.dimensions.height} | ${data.provider}/${data.model}
        </div>`;
    }

    document.getElementById('btnRegenImage').style.display = '';
    document.getElementById('btnDownloadImage').style.display = '';
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
  await generateImage(ctx);
}

function downloadForgeImage() {
  if (!forgeGeneratedImageUrl) return;
  const a = document.createElement('a');
  a.href = forgeGeneratedImageUrl;
  a.download = `soundcave_${Date.now()}.png`;
  a.click();
}

async function copyForgeOutput() {
  try {
    await navigator.clipboard.writeText(forgeGeneratedContent);
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  } catch(e) {}
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
        context: gatherForgeContext(),
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
  document.getElementById('forgeContentType').value = item.type;
  updateForgeFields();
  const ctx = item.context || {};
  if (ctx.artist_username) { const el = document.getElementById('forgeArtist'); if (el) el.value = ctx.artist_username; }
  if (ctx.event) { const el = document.getElementById('forgeEvent'); if (el) el.value = ctx.event; }
  if (ctx.release) { const el = document.getElementById('forgeRelease'); if (el) el.value = ctx.release; }
  if (ctx.artist_list) { const el = document.getElementById('forgeArtistList'); if (el) el.value = ctx.artist_list; }
  if (ctx.freeform) document.getElementById('forgeFreeform').value = ctx.freeform;
  forgeGeneratedContent = item.content;
  forgeGeneratedImageUrl = item.imageUrl || '';
  document.getElementById('forgeOutputArea').innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(item.content)}</textarea>`;
  document.getElementById('forgeActions').style.display = 'block';
  // Restore image if present
  const imgArea = document.getElementById('forgeImageArea');
  if (forgeGeneratedImageUrl) {
    imgArea.style.display = 'block';
    imgArea.innerHTML = `<img src="${forgeGeneratedImageUrl}" class="forge-image-preview" alt="Generated image">`;
    document.getElementById('btnRegenImage').style.display = '';
    document.getElementById('btnDownloadImage').style.display = '';
  } else {
    imgArea.style.display = 'none';
    imgArea.innerHTML = '';
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
