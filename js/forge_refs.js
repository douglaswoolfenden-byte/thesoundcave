// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORGE REFERENCE IMAGES — role-tagged uploads
// (wiki/spec/forge_context_pipeline.md, signed off 2026-06-11)
//
// Every uploaded reference carries a ROLE so the compose prompt can name each
// image's job instead of treating uploads as one anonymous style pile:
//   WHO   — a person/artist to feature (must stay recognisable)
//   WHERE — a place/venue/scene the image lives in
//   WHAT  — an object/prop/motif to include, restyled to fit
//   STYLE — a flyer/artwork whose look rules the whole output
// Roles are auto-guessed by Claude vision on upload (/api/classify-ref);
// click a chip to cycle it, ✎ to attach a one-line note ("my logo").
// Owns the state + handlers that previously lived in firepit.js.
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const REF_IMAGES_MAX_COUNT = 5;
const REF_IMAGES_MAX_BYTES = 5 * 1024 * 1024; // 5MB per image
// Must match the backend allow-list in content_api._ref_images_to_blocks.
// HEIC (Mac), AVIF and SVG are NOT accepted by the image API.
const REF_IMAGES_SUPPORTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

const REF_ROLES = ['who', 'where', 'what', 'style'];
const REF_ROLE_HINTS = {
  who:   'WHO — person to feature',
  where: 'WHERE — place / setting',
  what:  'WHAT — object / motif to include',
  style: 'STYLE — copy this look',
};

// Each entry: { data: <dataURL>, role: 'who'|'where'|'what'|'style'|null, note: '' }
// role === null while the auto-guess is in flight.
let _forgeRefImages = [];

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
      const startIndex = _forgeRefImages.length;
      _forgeRefImages = _forgeRefImages.concat(
        dataUrls.map(d => ({ data: d, role: null, note: '' })));
      renderRefImageThumbs();
      event.target.value = '';
      _classifyRefImages(startIndex, dataUrls);
    })
    .catch(err => {
      errEl.textContent = `Read failed: ${err.message}`;
      errEl.style.display = 'block';
    });
}

// Auto-guess roles for newly added images. On any failure default to STYLE —
// the historically dominant use (uploading a flyer to copy), and the safest
// wrong guess (it can't mis-feature a stranger's face).
async function _classifyRefImages(startIndex, dataUrls) {
  let roles = null;
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/classify-ref`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: dataUrls }),
    });
    if (r.ok) roles = (await r.json()).roles;
  } catch (e) {
    console.warn('classify-ref failed, defaulting to style:', e);
  }
  dataUrls.forEach((_, i) => {
    const entry = _forgeRefImages[startIndex + i];
    if (!entry || entry.role) return;       // removed or already hand-set
    const guess = roles && REF_ROLES.includes(roles[i]) ? roles[i] : 'style';
    entry.role = guess;
  });
  renderRefImageThumbs();
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
  _forgeRefImages.forEach((entry, i) => {
    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const img = document.createElement('img');
    img.src = entry.data;
    img.alt = `ref ${i + 1}`;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = `ref-chip ${entry.role || 'guessing'}`;
    chip.textContent = entry.role ? entry.role.toUpperCase() : '…';
    chip.title = entry.role
      ? `${REF_ROLE_HINTS[entry.role]} — click to change`
      : 'Guessing role…';
    chip.addEventListener('click', () => cycleRefRole(i));

    const noteBtn = document.createElement('button');
    noteBtn.type = 'button';
    noteBtn.className = 'ref-note' + (entry.note ? ' has-note' : '');
    noteBtn.textContent = '✎';
    noteBtn.title = entry.note ? `Note: ${entry.note}` : 'Add a note (e.g. "my logo")';
    noteBtn.addEventListener('click', () => editRefNote(i));

    const rm = document.createElement('button');
    rm.type = 'button';
    rm.textContent = '×';
    rm.setAttribute('aria-label', 'Remove');
    rm.addEventListener('click', () => removeRefImage(i));

    thumb.appendChild(img);
    thumb.appendChild(chip);
    thumb.appendChild(noteBtn);
    thumb.appendChild(rm);
    wrap.appendChild(thumb);
  });
}

function cycleRefRole(i) {
  const entry = _forgeRefImages[i];
  if (!entry) return;
  const cur = REF_ROLES.indexOf(entry.role);
  entry.role = REF_ROLES[(cur + 1) % REF_ROLES.length];
  renderRefImageThumbs();
}

function editRefNote(i) {
  const entry = _forgeRefImages[i];
  if (!entry) return;
  const note = window.prompt('What is this image? (one short line, optional)', entry.note || '');
  if (note === null) return; // cancelled
  entry.note = note.trim().slice(0, 120);
  renderRefImageThumbs();
}

function removeRefImage(i) {
  _forgeRefImages.splice(i, 1);
  renderRefImageThumbs();
}

// Payload for gatherForgeContext — still-guessing entries ship as STYLE so a
// fast generate never blocks on classification.
function forgeRefImagesPayload() {
  return _forgeRefImages.map(e => ({
    data: e.data,
    role: e.role || 'style',
    note: e.note || '',
  }));
}

// Add a Cave artist asset (avatar / track art) as a reference. SoundCloud URLs
// aren't data-URLs and CORS blocks a client-side fetch, so the backend proxies
// the image to a data-URL; it then joins the normal ref pipeline.
async function addForgeRefFromUrl(url, role, note) {
  const errEl = document.getElementById('forgeRefImagesError');
  const fail = msg => { if (errEl) { errEl.textContent = msg; errEl.style.display = 'block'; } };
  if (errEl) errEl.style.display = 'none';
  if (_forgeRefImages.length >= REF_IMAGES_MAX_COUNT) { fail(`Max ${REF_IMAGES_MAX_COUNT} references.`); return; }
  try {
    const r = await scAuth.authedFetch(`${forgeApiUrl}/api/proxy-image?url=${encodeURIComponent(url)}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.data) throw new Error(j.error || `HTTP ${r.status}`);
    _forgeRefImages.push({ data: j.data, role: REF_ROLES.includes(role) ? role : 'style', note: note || '' });
    renderRefImageThumbs();
  } catch (e) {
    fail(`Couldn't add that asset: ${e.message}`);
  }
}
