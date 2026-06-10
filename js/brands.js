// ─────────────────────────────────────────────────────────
// brands.js — BRANDS tab (brand-kit management)
// Spec: wiki/spec/brand_kits_ui.md
// Phase 2 of the Brand Overlay Compositor build.
//
// Loads kits via /api/brand_kits, renders grid + editor, handles
// file uploads to /api/brand_assets/upload, saves via POST/PATCH.
// All requests are JWT-authed via scAuth.authedFetch.
// ─────────────────────────────────────────────────────────

(function () {
  const apiBase = () => scApiBase();

  // ── State ───────────────────────────────────────────────
  let _kits = [];
  let _editing = null; // { id?: uuid, name, palette, defaults, logo_url, display_font_url, body_font_url }
  let _pendingFiles = { logo: null, display_font: null, body_font: null };
  let _previewFontTag = null; // <style> injected for live font preview

  const DEFAULT_PALETTE = {
    primary: '#3FB7E9', accent: '#F5A8C9',
    text: '#FFFFFF', text_stroke: '#000000',
  };
  const DEFAULT_DEFAULTS = { logo_position: 'top_center', logo_scale: 0.18 };

  // ── DOM helpers ────────────────────────────────────────
  const $ = (id) => document.getElementById(id);

  function setMsg(text, isError) {
    const el = $('brandEditorMsg');
    if (!el) return;
    el.textContent = text || '';
    if (isError) el.setAttribute('data-error', '1');
    else el.removeAttribute('data-error');
  }

  function showGrid() {
    $('brandEditor').hidden = true;
    $('brandsGrid').hidden = false;
    $('brandsEmpty').hidden = _kits.length > 0;
    renderGrid();
  }

  function showEditor() {
    $('brandEditor').hidden = false;
    $('brandsGrid').hidden = true;
    $('brandsEmpty').hidden = true;
  }

  // ── Grid ───────────────────────────────────────────────
  function renderGrid() {
    const grid = $('brandsGrid');
    grid.replaceChildren();

    _kits.forEach(kit => grid.appendChild(buildKitCard(kit)));

    if (_kits.length > 0) {
      const addTile = document.createElement('div');
      addTile.className = 'brand-card brand-card--add';
      addTile.textContent = '+ Add brand kit';
      addTile.addEventListener('click', () => openEditor(null));
      grid.appendChild(addTile);
    }
  }

  function buildKitCard(kit) {
    const card = document.createElement('article');
    card.className = 'brand-card';
    card.dataset.kitId = kit.id;

    // Logo strip
    const logoStrip = document.createElement('div');
    logoStrip.className = 'brand-card-logo-strip';
    if (kit.logo_url) {
      const img = document.createElement('img');
      img.src = kit.logo_url;
      img.alt = `${kit.name} logo`;
      logoStrip.appendChild(img);
    }
    card.appendChild(logoStrip);

    // Name
    const name = document.createElement('div');
    name.className = 'brand-card-name';
    name.textContent = kit.name || 'UNNAMED';
    card.appendChild(name);

    // Palette
    const palette = document.createElement('div');
    palette.className = 'brand-card-palette';
    const p = kit.palette || {};
    ['primary', 'accent', 'text', 'text_stroke'].forEach(role => {
      const sw = document.createElement('span');
      sw.className = 'brand-card-swatch';
      sw.style.background = p[role] || DEFAULT_PALETTE[role];
      sw.title = role;
      palette.appendChild(sw);
    });
    card.appendChild(palette);

    // Fonts
    const fonts = document.createElement('div');
    fonts.className = 'brand-card-fonts';
    const sample = document.createElement('span');
    sample.className = 'brand-card-font-sample';
    sample.textContent = 'Aa';
    if (kit.display_font_url) {
      const ff = `brandFont_${kit.id}`;
      injectFontFace(ff, kit.display_font_url);
      sample.style.fontFamily = `"${ff}", var(--font-body)`;
    }
    fonts.appendChild(sample);
    const caption = document.createElement('span');
    caption.className = 'brand-card-font-caption';
    caption.textContent = kit.display_font_url ? 'custom font' : '(default)';
    fonts.appendChild(caption);
    card.appendChild(fonts);

    // Actions
    const actions = document.createElement('div');
    actions.className = 'brand-card-actions';
    const editBtn = document.createElement('button');
    editBtn.className = 'brand-card-btn';
    editBtn.textContent = 'Edit';
    editBtn.addEventListener('click', () => openEditor(kit));
    const delBtn = document.createElement('button');
    delBtn.className = 'brand-card-btn brand-card-btn-danger';
    delBtn.textContent = 'Delete';
    delBtn.addEventListener('click', () => confirmDelete(kit));
    actions.append(editBtn, delBtn);
    card.appendChild(actions);

    return card;
  }

  function injectFontFace(family, url) {
    // Idempotent — skip if already injected for this family.
    if (document.querySelector(`style[data-font-family="${family}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-font-family', family);
    style.textContent = `@font-face { font-family: "${family}"; src: url("${url}"); font-display: swap; }`;
    document.head.appendChild(style);
  }

  // ── Editor ─────────────────────────────────────────────
  function openEditor(kit) {
    _editing = kit ? { ...kit } : {
      name: '',
      palette: { ...DEFAULT_PALETTE },
      defaults: { ...DEFAULT_DEFAULTS },
      logo_url: null, display_font_url: null, body_font_url: null,
    };
    _pendingFiles = { logo: null, display_font: null, body_font: null };

    $('brandEditorTitle').textContent = kit ? `EDIT — ${kit.name.toUpperCase()}` : 'NEW BRAND KIT';

    $('bfName').value = _editing.name || '';
    $('bfLogoState').textContent = _editing.logo_url ? 'existing logo' : 'no file';
    $('bfLogoState').toggleAttribute('data-loaded', !!_editing.logo_url);
    $('bfDisplayFontState').textContent = _editing.display_font_url ? 'existing font' : 'no file';
    $('bfDisplayFontState').toggleAttribute('data-loaded', !!_editing.display_font_url);
    $('bfBodyFontState').textContent = _editing.body_font_url ? 'existing font' : 'no file';
    $('bfBodyFontState').toggleAttribute('data-loaded', !!_editing.body_font_url);

    const p = _editing.palette || {};
    $('bfPalettePrimary').value = p.primary       || DEFAULT_PALETTE.primary;
    $('bfPaletteAccent').value  = p.accent        || DEFAULT_PALETTE.accent;
    $('bfPaletteText').value    = p.text          || DEFAULT_PALETTE.text;
    $('bfPaletteStroke').value  = p.text_stroke   || DEFAULT_PALETTE.text_stroke;

    const d = _editing.defaults || {};
    selectPosition(d.logo_position || 'top_center');
    const scalePct = Math.round((d.logo_scale || 0.18) * 100);
    $('bfLogoScale').value = scalePct;
    $('bfLogoScaleVal').textContent = `${scalePct}%`;

    setMsg('');
    showEditor();
    renderPreview();
  }

  function selectPosition(pos) {
    _editing.defaults = _editing.defaults || {};
    _editing.defaults.logo_position = pos;
    document.querySelectorAll('#bfPositionGrid .brand-pos').forEach(btn => {
      btn.classList.toggle('is-selected', btn.dataset.pos === pos);
    });
  }

  function readEditorIntoState() {
    _editing.name = ($('bfName').value || '').trim();
    _editing.palette = {
      primary:     $('bfPalettePrimary').value,
      accent:      $('bfPaletteAccent').value,
      text:        $('bfPaletteText').value,
      text_stroke: $('bfPaletteStroke').value,
    };
    _editing.defaults = {
      logo_position: _editing.defaults?.logo_position || 'top_center',
      logo_scale: Number($('bfLogoScale').value) / 100,
    };
  }

  function renderPreview() {
    readEditorIntoState();

    // Logo — size driven by the logo_scale slider so the user SEES the scale they're picking.
    // Slider range is 5%..50% (fraction of canvas). Preview logo strip is ~340px wide → we map
    // 5..50 to 12%..100% of the strip so the logo visibly grows as the slider moves.
    const logoEl = $('bpLogo');
    const logoSrc = _pendingFiles.logo
      ? URL.createObjectURL(_pendingFiles.logo)
      : (_editing.logo_url || '');
    if (logoSrc) { logoEl.src = logoSrc; logoEl.style.display = ''; }
    else { logoEl.removeAttribute('src'); logoEl.style.display = 'none'; }
    const scalePct = Math.round((_editing.defaults?.logo_scale || 0.18) * 100);
    // Map 5..50 → 12..100 (linear)
    const previewPct = 12 + ((scalePct - 5) / 45) * 88;
    logoEl.style.maxWidth = `${Math.max(12, Math.min(100, previewPct))}%`;
    logoEl.style.maxHeight = 'none';
    logoEl.style.width = 'auto';
    logoEl.style.height = 'auto';

    // Name
    $('bpName').textContent = (_editing.name || 'YOUR BRAND').toUpperCase();
    $('bpName').style.color = _editing.palette.text || DEFAULT_PALETTE.text;
    $('bpName').style.textShadow = `1px 1px 0 ${_editing.palette.text_stroke}`;

    // Palette swatches
    const palWrap = $('bpPalette');
    palWrap.replaceChildren();
    ['primary', 'accent', 'text', 'text_stroke'].forEach(role => {
      const sw = document.createElement('span');
      sw.className = 'brand-card-swatch';
      sw.style.background = _editing.palette[role];
      sw.title = role;
      palWrap.appendChild(sw);
    });

    // Display font sample
    const fontUrl = _pendingFiles.display_font
      ? URL.createObjectURL(_pendingFiles.display_font)
      : _editing.display_font_url;
    if (fontUrl) {
      injectPreviewFont(fontUrl);
      $('bpDisplaySample').style.fontFamily = `"BrandPreviewFont", var(--font-body)`;
      $('bpDisplayCaption').textContent = _pendingFiles.display_font?.name || 'custom font';
    } else {
      $('bpDisplaySample').style.fontFamily = '';
      $('bpDisplayCaption').textContent = '(default)';
    }
  }

  function injectPreviewFont(url) {
    if (_previewFontTag) _previewFontTag.remove();
    _previewFontTag = document.createElement('style');
    _previewFontTag.textContent =
      `@font-face { font-family: "BrandPreviewFont"; src: url("${url}"); font-display: swap; }`;
    document.head.appendChild(_previewFontTag);
  }

  // ── Save ───────────────────────────────────────────────
  async function saveKit() {
    readEditorIntoState();
    if (!_editing.name || _editing.name.length < 2) {
      setMsg('Name is required (≥2 chars)', true); return;
    }
    if (!_editing.logo_url && !_pendingFiles.logo) {
      setMsg('Upload a logo before saving', true); return;
    }
    setMsg('Saving…', false);
    try {
      // Upload any pending files
      if (_pendingFiles.logo) {
        _editing.logo_url = await uploadAsset(_pendingFiles.logo, 'logo');
      }
      if (_pendingFiles.display_font) {
        _editing.display_font_url = await uploadAsset(_pendingFiles.display_font, 'display_font');
      }
      if (_pendingFiles.body_font) {
        _editing.body_font_url = await uploadAsset(_pendingFiles.body_font, 'body_font');
      }

      const body = {
        name: _editing.name,
        logo_url: _editing.logo_url,
        display_font_url: _editing.display_font_url,
        body_font_url: _editing.body_font_url,
        palette: _editing.palette,
        defaults: _editing.defaults,
      };

      let r;
      if (_editing.id) {
        r = await scAuth.authedFetch(`${apiBase()}/api/brand_kits/${_editing.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      } else {
        r = await scAuth.authedFetch(`${apiBase()}/api/brand_kits`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
      }
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || `HTTP ${r.status}`);
      }
      const j = await r.json();
      const savedKit = j.kit;
      if (_editing.id) {
        _kits = _kits.map(k => k.id === savedKit.id ? savedKit : k);
      } else {
        _kits = [savedKit, ..._kits];
      }
      _pendingFiles = { logo: null, display_font: null, body_font: null };
      showGrid();
    } catch (err) {
      console.error('saveKit failed:', err);
      setMsg(err.message || 'Save failed', true);
    }
  }

  async function uploadAsset(file, kind) {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', kind);
    const r = await scAuth.authedFetch(`${apiBase()}/api/brand_assets/upload`, {
      method: 'POST',
      body: fd,
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      throw new Error(j.error || `Upload failed (${r.status})`);
    }
    const j = await r.json();
    return j.url;
  }

  // ── Delete ─────────────────────────────────────────────
  async function confirmDelete(kit) {
    const ok = window.confirm(`Delete "${kit.name}"? This can't be undone.`);
    if (!ok) return;
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/brand_kits/${kit.id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      _kits = _kits.filter(k => k.id !== kit.id);
      showGrid();
    } catch (err) {
      console.error('delete failed:', err);
      window.alert(`Delete failed: ${err.message || err}`);
    }
  }

  // ── Load ───────────────────────────────────────────────
  async function loadKits() {
    try {
      const r = await scAuth.authedFetch(`${apiBase()}/api/brand_kits`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const j = await r.json();
      _kits = j.kits || [];
    } catch (err) {
      console.error('loadKits failed:', err);
      _kits = [];
    }
    showGrid();
  }

  // ── Wiring ─────────────────────────────────────────────
  function bind() {
    $('brandsNew')?.addEventListener('click', () => openEditor(null));
    $('brandsEmptyCta')?.addEventListener('click', () => openEditor(null));
    $('brandEditorBack')?.addEventListener('click', showGrid);
    $('brandEditorCancel')?.addEventListener('click', showGrid);
    $('brandEditorSave')?.addEventListener('click', saveKit);

    $('bfName')?.addEventListener('input', renderPreview);

    $('bfLogo')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      _pendingFiles.logo = f;
      $('bfLogoState').textContent = f.name;
      $('bfLogoState').setAttribute('data-loaded', '1');
      renderPreview();
    });
    $('bfDisplayFont')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      _pendingFiles.display_font = f;
      $('bfDisplayFontState').textContent = f.name;
      $('bfDisplayFontState').setAttribute('data-loaded', '1');
      renderPreview();
    });
    $('bfBodyFont')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      _pendingFiles.body_font = f;
      $('bfBodyFontState').textContent = f.name;
      $('bfBodyFontState').setAttribute('data-loaded', '1');
      // Body font isn't shown in the preview card today — change still recorded.
    });

    ['bfPalettePrimary', 'bfPaletteAccent', 'bfPaletteText', 'bfPaletteStroke']
      .forEach(id => $(id)?.addEventListener('input', renderPreview));

    document.querySelectorAll('#bfPositionGrid .brand-pos').forEach(btn => {
      btn.addEventListener('click', () => selectPosition(btn.dataset.pos));
    });

    $('bfLogoScale')?.addEventListener('input', () => {
      const v = $('bfLogoScale').value;
      $('bfLogoScaleVal').textContent = `${v}%`;
      renderPreview();
    });
  }

  // ── Public API ─────────────────────────────────────────
  window.refreshBrands = function () {
    loadKits();
  };

  document.addEventListener('DOMContentLoaded', bind);
})();
