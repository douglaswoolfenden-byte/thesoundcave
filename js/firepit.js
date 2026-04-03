// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FIREPIT — CONTENT PRODUCTION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
let firepitMode = 'forge';
let forgeGeneratedContent = '';
let forgeApiUrl = localStorage.getItem('sc_api_url') || 'http://localhost:8000';

const CONTENT_TYPES = {
  ig_reel:      { label:'IG Reel Caption',     icon:'📸', fields:['artist','freeform'], maxLength:2200 },
  ig_carousel:  { label:'IG Carousel',         icon:'📸', fields:['artist','freeform'], maxLength:2200 },
  tiktok:       { label:'TikTok Caption',      icon:'🎵', fields:['artist','freeform'], maxLength:300 },
  x_post:       { label:'X/Twitter Post',      icon:'𝕏',  fields:['artist','freeform'], maxLength:280 },
  yt_short:     { label:'YouTube Short Desc',  icon:'▶️', fields:['artist','freeform'], maxLength:5000 },
  lineup_copy:  { label:'Lineup Poster Copy',  icon:'🎪', fields:['event','artist_list','freeform'] },
  aftermovie:   { label:'Aftermovie Script',   icon:'🎬', fields:['event','freeform'] },
  teaser:       { label:'Event Teaser',        icon:'🔥', fields:['event','artist','freeform'] },
  pre_release:  { label:'Pre-Release Teaser',  icon:'💿', fields:['artist','release','freeform'] },
  premiere:     { label:'Premiere Pitch Email', icon:'📧', fields:['artist','release','freeform'] },
  dj_support:   { label:'DJ Support Roundup',  icon:'🎧', fields:['release','freeform'] },
  artist_bio:   { label:'Artist Spotlight/Bio', icon:'✨', fields:['artist','freeform'] },
  press:        { label:'Press Release',       icon:'📰', fields:['artist','release','event','freeform'] },
  newsletter:   { label:'Newsletter Roundup',  icon:'📬', fields:['freeform'] },
  mix_desc:     { label:'Mix Description',     icon:'🎛️', fields:['artist','freeform'] },
  playlist_desc:{ label:'Playlist Description', icon:'📋', fields:['freeform'] },
};

function getContentLibrary() { return JSON.parse(localStorage.getItem('sc_content_library') || '[]'); }
function saveContentLibrary(d) { localStorage.setItem('sc_content_library', JSON.stringify(d)); }

function setFirepitMode(mode, btn) {
  firepitMode = mode;
  document.querySelectorAll('.firepit-mode').forEach(el => el.classList.remove('active'));
  if (btn) btn.classList.add('active');
  ['forge','stash','trailmap'].forEach(m => {
    const el = document.getElementById(`firepit-${m}`);
    if (el) el.style.display = m === mode ? 'block' : 'none';
  });
  if (mode === 'stash') renderStash();
}

function renderFirepit() {
  updateForgeFields();
  updateStashCount();
  populateStashTypeFilter();
  checkApiStatus();
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
  ctx.voice = document.getElementById('forgeVoice')?.value || 'default';
  return ctx;
}

async function generateContent(variation) {
  const ctx = gatherForgeContext();
  if (variation) ctx.variation = variation;

  const outputArea = document.getElementById('forgeOutputArea');
  const actionsEl = document.getElementById('forgeActions');
  outputArea.innerHTML = `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px">
    <span>Generating<span class="dot">.</span><span class="dot" style="animation-delay:0.2s">.</span><span class="dot" style="animation-delay:0.4s">.</span></span>
  </div>`;
  actionsEl.style.display = 'none';

  try {
    const r = await fetch(`${forgeApiUrl}/api/generate`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(ctx)
    });
    if (!r.ok) throw new Error(`API error: ${r.status}`);
    const data = await r.json();
    forgeGeneratedContent = data.content || '';
    outputArea.innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(forgeGeneratedContent)}</textarea>`;
    actionsEl.style.display = 'block';
    updateCharCount();
  } catch(e) {
    outputArea.innerHTML = `<div class="forge-loading" style="border:1px dashed var(--border);border-radius:8px;flex-direction:column;gap:8px">
      <span style="font-size:20px">⚠️</span>
      <span style="color:var(--red)">${e.message}</span>
      <span style="color:var(--muted);font-size:11px">Make sure content_api.py is running: <code>python content_api.py</code></span>
    </div>`;
  }
}

function generateVariation(type) { generateContent(type); }

async function copyForgeOutput() {
  try {
    await navigator.clipboard.writeText(forgeGeneratedContent);
    const btn = event.target;
    const orig = btn.textContent;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = orig, 1500);
  } catch(e) {}
}

function saveToStash() {
  if (!forgeGeneratedContent) return;
  const type = document.getElementById('forgeContentType').value;
  const ct = CONTENT_TYPES[type];
  const lib = getContentLibrary();
  lib.unshift({
    id: 'c_' + Date.now() + '_' + Math.random().toString(36).slice(2,6),
    type: type,
    label: ct ? ct.label : type,
    icon: ct ? ct.icon : '📝',
    content: forgeGeneratedContent,
    context: gatherForgeContext(),
    status: 'draft',
    created: new Date().toISOString(),
    modified: new Date().toISOString()
  });
  saveContentLibrary(lib);
  updateStashCount();
  const btn = event.target;
  const orig = btn.innerHTML;
  btn.innerHTML = '✅ Saved!';
  setTimeout(() => btn.innerHTML = orig, 1500);
}

function updateStashCount() {
  const lib = getContentLibrary();
  const el = document.getElementById('stashCount');
  if (el) el.textContent = lib.length || '';
  const fp = document.getElementById('firepitCount');
  if (fp) fp.textContent = lib.filter(i => i.status === 'draft').length || '';
}

function populateStashTypeFilter() {
  const sel = document.getElementById('stashTypeFilter');
  if (!sel) return;
  const types = new Set(getContentLibrary().map(i => i.type));
  const existing = sel.value;
  sel.innerHTML = '<option value="">All types</option>' +
    [...types].map(t => {
      const ct = CONTENT_TYPES[t];
      return `<option value="${t}">${ct ? ct.icon + ' ' + ct.label : t}</option>`;
    }).join('');
  sel.value = existing;
}

function renderStash() {
  const lib = getContentLibrary();
  const search = (document.getElementById('stashSearch')?.value || '').toLowerCase();
  const typeFilter = document.getElementById('stashTypeFilter')?.value || '';
  const statusFilter = document.getElementById('stashStatusFilter')?.value || '';

  let items = lib;
  if (search) items = items.filter(i => i.content.toLowerCase().includes(search) || (i.label||'').toLowerCase().includes(search));
  if (typeFilter) items = items.filter(i => i.type === typeFilter);
  if (statusFilter) items = items.filter(i => i.status === statusFilter);

  const el = document.getElementById('stashList');
  if (!items.length) {
    el.innerHTML = `<div class="empty"><div class="ico">📦</div><p>${lib.length ? 'No content matches your filters.' : 'Your stash is empty. Generate content in the Forge and save it here.'}</p></div>`;
    return;
  }
  el.innerHTML = items.map(item => {
    const preview = item.content.slice(0, 100).replace(/\n/g, ' ');
    const date = new Date(item.created).toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
    return `<div class="stash-item">
      <div class="stash-info">
        <div class="stash-type">${item.icon || '📝'} ${item.label || item.type}</div>
        <div class="stash-preview">${esc(preview)}</div>
        <div class="stash-date">${date}</div>
      </div>
      <span class="stash-status ${item.status}">${item.status}</span>
      <div class="stash-actions">
        <button class="action-btn" onclick="editStashItem('${item.id}')" title="Edit in Forge"><span class="icon">✏️</span></button>
        <button class="action-btn" onclick="copyStashItem('${item.id}')" title="Copy"><span class="icon">📋</span></button>
        <button class="action-btn" onclick="deleteStashItem('${item.id}')" title="Delete"><span class="icon">🗑️</span></button>
      </div>
    </div>`;
  }).join('');
}

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
  document.getElementById('forgeOutputArea').innerHTML = `<textarea class="forge-output" id="forgeOutputText" oninput="forgeGeneratedContent=this.value;updateCharCount()">${esc(item.content)}</textarea>`;
  document.getElementById('forgeActions').style.display = 'block';
  updateCharCount();
}

async function copyStashItem(id) {
  const lib = getContentLibrary();
  const item = lib.find(i => i.id === id);
  if (!item) return;
  try { await navigator.clipboard.writeText(item.content); } catch(e) {}
}

function deleteStashItem(id) {
  let lib = getContentLibrary();
  lib = lib.filter(i => i.id !== id);
  saveContentLibrary(lib);
  renderStash();
  updateStashCount();
}
