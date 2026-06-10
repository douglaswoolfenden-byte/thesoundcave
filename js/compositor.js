// ─────────────────────────────────────────────────────────
// compositor.js — Konva-based two-layer image compositor
// Spec: wiki/spec/brand_overlay_compositor.md (Phase 3)
//
// Stage = Konva.Stage with a fixed virtual resolution per content type
// (1080×1350 / 1080×1920 / 1200×675). The DOM container is scaled down to
// fit the viewport; coordinates stay in virtual pixels so the saved PNG is
// always full-resolution.
//
// Public surface (window.scCompositor):
//   show(contentType)              — mount + reset to default template
//   hide()                         — unmount and clean up
//   applyBackground(url)           — load + display the AI-generated background
//   applyBrandKit(kit)             — logo + fonts + palette
//   applyContent({headline, supp}) — fill the two text layers
//   resetLayout()                  — re-apply the template defaults
//   toBlob()                       — Promise<Blob> of the flat PNG
//   getSelected()                  — current selected layer or null
//
// Five layer types, exactly as the spec locks them:
//   background | logo | headline_text | supporting_text | accent_shape
// ─────────────────────────────────────────────────────────

(function () {
  // Brand-less default — the locked S0UNDCAV3 palette + fonts (css/style.css :root).
  // Used when no brand kit is selected so posters still get on-brand, legible text
  // (no logo is drawn brand-less — addLogo() returns null without a logo_url).
  const DEFAULT_STYLE = {
    palette: { text: '#f5f5f5', body: '#e0dcd9', text_stroke: '#0f0d0c', accent: '#ff4500' },
    display_font: 'DM Mono, monospace',
    body_font: 'DM Sans, sans-serif',
  };

  // Lightweight internal state
  let stage = null;
  let bgLayer = null;
  let designLayer = null;
  let transformer = null;
  let selected = null;
  let currentContentType = null;
  let currentBrand = null;
  let displayFontFamily = null;
  let bodyFontFamily = null;
  let lastBgUrl = null;

  // For deselect-on-empty-click + listener cleanup
  let _stageClickBound = false;
  let _onSelectionChange = null;

  // Anchor → offset translator (so x/y can refer to logical anchor point)
  const ANCHORS = {
    tl: { ax: 0,   ay: 0 },
    tc: { ax: 0.5, ay: 0 },
    tr: { ax: 1,   ay: 0 },
    cl: { ax: 0,   ay: 0.5 },
    c:  { ax: 0.5, ay: 0.5 },
    cr: { ax: 1,   ay: 0.5 },
    bl: { ax: 0,   ay: 1 },
    bc: { ax: 0.5, ay: 1 },
    br: { ax: 1,   ay: 1 },
  };

  function dims() {
    return (window.COMPOSITOR_DIMENSIONS && window.COMPOSITOR_DIMENSIONS[currentContentType])
        || { w: 1080, h: 1350 };
  }

  function fitToContainer() {
    if (!stage) return;
    const wrap = document.querySelector('.compositor-stage-frame');
    const { w, h } = dims();
    if (!wrap) return;
    // Available width = frame width minus padding; height capped so stage fits viewport
    const maxW = wrap.clientWidth - 24;
    const maxH = Math.min(window.innerHeight - 280, 900);
    const scale = Math.min(maxW / w, maxH / h);
    stage.width(w * scale);
    stage.height(h * scale);
    stage.scale({ x: scale, y: scale });
    stage.batchDraw();
  }

  function ensureStage() {
    if (stage) return stage;
    const { w, h } = dims();
    stage = new Konva.Stage({
      container: 'compositorStage',
      width: w,
      height: h,
    });
    bgLayer = new Konva.Layer({ listening: false });
    designLayer = new Konva.Layer();
    transformer = new Konva.Transformer({
      rotateEnabled: false,
      anchorSize: 10,
      anchorStroke: '#ff4500',
      anchorFill: '#0a0a0a',
      borderStroke: '#ff4500',
      borderDash: [4, 4],
      keepRatio: false,
    });
    designLayer.add(transformer);
    stage.add(bgLayer);
    stage.add(designLayer);

    if (!_stageClickBound) {
      stage.on('click tap', (e) => {
        if (e.target === stage) {
          select(null);
        }
      });
      window.addEventListener('resize', fitToContainer);
      _stageClickBound = true;
    }
    return stage;
  }

  function clearDesignLayer() {
    // Keep transformer, drop other nodes
    designLayer.find('.layer').forEach(n => n.destroy());
    transformer.nodes([]);
    selected = null;
    notifySelectionChange();
  }

  function select(node) {
    selected = node;
    if (node) {
      transformer.nodes([node]);
    } else {
      transformer.nodes([]);
    }
    designLayer.draw();
    notifySelectionChange();
  }

  function notifySelectionChange() {
    if (typeof _onSelectionChange === 'function') {
      _onSelectionChange(selected);
    }
  }

  // ── Layer factories ──────────────────────────────────
  function placeWithAnchor(node, x, y, anchor, w, h) {
    const a = ANCHORS[anchor] || ANCHORS.tc;
    node.x(x - w * a.ax);
    node.y(y - h * a.ay);
  }

  function addLogo(layerDef) {
    if (!currentBrand?.logo_url) return null;
    const { w: cw, h: ch } = dims();
    const ax = layerDef.x * cw;
    const ay = layerDef.y * ch;
    const targetW = (layerDef.scale ?? 0.18) * cw;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    const node = new Konva.Image({
      x: ax, y: ay,
      width: targetW,
      height: targetW,  // square placeholder until natural ratio loads
      image: null,
      draggable: true,
      name: 'layer layer-logo',
    });
    node.layerType = 'logo';
    img.onload = () => {
      const ratio = img.naturalHeight / img.naturalWidth;
      const finalW = targetW;
      const finalH = targetW * ratio;
      node.image(img);
      node.width(finalW);
      node.height(finalH);
      placeWithAnchor(node, ax, ay, layerDef.anchor, finalW, finalH);
      designLayer.draw();
    };
    img.onerror = (e) => console.warn('logo load failed', e);
    img.src = currentBrand.logo_url;

    node.on('click tap', (e) => { e.cancelBubble = true; select(node); });
    designLayer.add(node);
    return node;
  }

  function addText(layerDef, role) {
    const { w: cw, h: ch } = dims();
    const ax = layerDef.x * cw;
    const ay = layerDef.y * ch;
    const fontSize = (layerDef.size || 0.05) * cw;
    const palette = currentBrand?.palette || DEFAULT_STYLE.palette;
    const text = layerDef.text != null ? layerDef.text : '';

    const fontFamily = role === 'headline_text'
      ? (displayFontFamily || DEFAULT_STYLE.display_font)
      : (bodyFontFamily || displayFontFamily || DEFAULT_STYLE.body_font);

    const fill = role === 'headline_text'
      ? (palette.text || DEFAULT_STYLE.palette.text)
      : (palette.body || palette.text || DEFAULT_STYLE.palette.body);

    const node = new Konva.Text({
      x: ax, y: ay,
      text,
      fontSize,
      fontFamily,
      fontStyle: role === 'headline_text' ? 'bold' : 'normal',
      fill,
      stroke: palette.text_stroke || DEFAULT_STYLE.palette.text_stroke,
      strokeWidth: role === 'headline_text' ? Math.max(2, fontSize * 0.05) : 0,
      align: layerDef.anchor?.endsWith('c') ? 'center' : (layerDef.anchor?.endsWith('r') ? 'right' : 'left'),
      width: cw * 0.88,
      draggable: true,
      name: `layer layer-${role}`,
    });
    node.layerType = role;
    node._anchor = layerDef.anchor || 'tc';

    // Anchor x adjustment for the wrapped text block
    requestAnimationFrame(() => {
      placeWithAnchor(node, ax, ay, layerDef.anchor, node.width(), node.height());
      designLayer.draw();
    });

    node.on('click tap', (e) => { e.cancelBubble = true; select(node); });
    node.on('dblclick dbltap', () => promptTextEdit(node));
    designLayer.add(node);
    return node;
  }

  function promptTextEdit(node) {
    const next = window.prompt('Edit text:', node.text());
    if (next == null) return;
    node.text(next);
    designLayer.draw();
  }

  // ── Public surface ───────────────────────────────────
  function show(contentType) {
    currentContentType = contentType;
    const wrap = document.getElementById('forgeCompositor');
    if (wrap) wrap.style.display = 'block';
    const imgArea = document.getElementById('forgeImageArea');
    if (imgArea) imgArea.style.display = 'none';
    ensureStage();
    // Resize stage if content type changed
    const { w, h } = dims();
    if (stage.width() !== w) {
      stage.width(w); stage.height(h);
    }
    fitToContainer();
    resetLayout();
  }

  function hide() {
    const wrap = document.getElementById('forgeCompositor');
    if (wrap) wrap.style.display = 'none';
  }

  function applyBackground(url) {
    lastBgUrl = url;
    if (!stage) return;
    bgLayer.destroyChildren();
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const { w, h } = dims();
      const kImg = new Konva.Image({ image: img, x: 0, y: 0, width: w, height: h });
      bgLayer.add(kImg);
      bgLayer.draw();
    };
    img.onerror = (e) => console.warn('background load failed', e);
    img.src = url;
  }

  function applyBrandKit(kit) {
    currentBrand = kit;
    displayFontFamily = null;
    bodyFontFamily = null;
    if (kit?.display_font_url) {
      const family = `BrandDisplay_${kit.id || 'preview'}`;
      injectFontFace(family, kit.display_font_url);
      displayFontFamily = `"${family}"`;
    }
    if (kit?.body_font_url) {
      const family = `BrandBody_${kit.id || 'preview'}`;
      injectFontFace(family, kit.body_font_url);
      bodyFontFamily = `"${family}"`;
    }
    // Re-render text layers + logo with new brand
    if (currentContentType) resetLayout();
  }

  function injectFontFace(family, url) {
    if (document.querySelector(`style[data-cmp-font="${family}"]`)) return;
    const style = document.createElement('style');
    style.setAttribute('data-cmp-font', family);
    style.textContent = `@font-face { font-family: "${family}"; src: url("${url}"); font-display: swap; }`;
    document.head.appendChild(style);
  }

  function applyContent({ headline, supporting, event } = {}) {
    if (!designLayer) return;
    const headlineNode = designLayer.findOne('.layer-headline_text');
    const suppNode = designLayer.findOne('.layer-supporting_text');
    const tpl = window.COMPOSITOR_TEMPLATES[currentContentType];

    if (headlineNode) {
      let t = headline;
      if (t == null) {
        const defLayer = tpl?.layers?.find(l => l.type === 'headline_text');
        t = (defLayer?.text || '').replace('{{event}}', event || '');
      }
      headlineNode.text(t || '');
    }
    if (suppNode && supporting != null) {
      // Trim very long generated copy so it fits the canvas
      const trimmed = supporting.length > 320 ? supporting.slice(0, 320) + '…' : supporting;
      suppNode.text(trimmed);
    }
    designLayer.draw();
  }

  function resetLayout() {
    if (!stage) return;
    clearDesignLayer();
    const tpl = window.COMPOSITOR_TEMPLATES[currentContentType];
    if (!tpl) { designLayer.draw(); return; }
    tpl.layers.forEach(def => {
      if (def.type === 'logo') addLogo(def);
      else if (def.type === 'headline_text') addText(def, 'headline_text');
      else if (def.type === 'supporting_text') addText(def, 'supporting_text');
      // accent_shape: deferred to a follow-up (no template uses it yet by default)
    });
    designLayer.draw();
  }

  function toBlob() {
    // Render at full virtual resolution by passing pixelRatio = 1 / scale
    return new Promise((resolve, reject) => {
      if (!stage) return reject(new Error('compositor not initialised'));
      // Temporarily deselect so transformer doesn't render in the export
      const wasSelected = selected;
      select(null);
      const currentScale = stage.scaleX() || 1;
      const exportPixelRatio = 1 / currentScale;
      try {
        stage.toBlob({
          mimeType: 'image/png',
          pixelRatio: exportPixelRatio,
          callback: (blob) => {
            if (wasSelected) select(wasSelected);
            blob ? resolve(blob) : reject(new Error('toBlob returned null'));
          },
        });
      } catch (err) {
        if (wasSelected) select(wasSelected);
        reject(err);
      }
    });
  }

  function getSelected() { return selected; }

  // ── Toolbar interactions ─────────────────────────────
  function adjustTextSize(deltaPct) {
    if (!selected) return;
    if (selected.layerType !== 'headline_text' && selected.layerType !== 'supporting_text') return;
    const next = Math.max(8, selected.fontSize() * (1 + deltaPct));
    selected.fontSize(next);
    designLayer.draw();
  }

  function setTextColour(hex) {
    if (!selected) return;
    if (selected.layerType !== 'headline_text' && selected.layerType !== 'supporting_text') return;
    selected.fill(hex);
    designLayer.draw();
  }

  // ── Expose ───────────────────────────────────────────
  window.scCompositor = {
    show, hide,
    applyBackground, applyBrandKit, applyContent,
    resetLayout,
    toBlob,
    getSelected,
    adjustTextSize, setTextColour,
    onSelectionChange(cb) { _onSelectionChange = cb; },
    promptTextEdit() { if (selected) promptTextEdit(selected); },
    contentType() { return currentContentType; },
    brand() { return currentBrand; },
    lastBackgroundUrl() { return lastBgUrl; },
  };
})();
