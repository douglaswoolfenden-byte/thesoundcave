// ─────────────────────────────────────────────────────────
// compositor_templates.js — default Konva-stage layouts per content type
// Spec: wiki/spec/brand_overlay_compositor.md § 4
//
// All coords are FRACTIONS of canvas (0..1) so they survive resolution
// changes. Anchors: tl, tc, tr, cl, c, cr, bl, bc, br.
// Layer types: background | logo | headline_text | supporting_text | accent_shape
// ─────────────────────────────────────────────────────────

// Dimensions mirror media_gen.py:IMAGE_DIMENSIONS — 5 types, all 4:5 portrait.
// Per wiki/spec/forge_output_recipes.md (Approved 2026-06-09).
window.COMPOSITOR_DIMENSIONS = {
  social_post:     { w: 1080, h: 1350 },
  social_carousel: { w: 1080, h: 1350 },
  event_promo:     { w: 1080, h: 1350 },
  event_poster:    { w: 1080, h: 1350 },
  artist_bio:      { w: 1080, h: 1350 },
};

window.COMPOSITOR_TEMPLATES = {
  event_poster: {
    headline_default: 'SET TIMES',
    layers: [
      { type: 'logo',            x: 0.5,  y: 0.10, scale: 0.20, anchor: 'tc' },
      { type: 'headline_text',   x: 0.5,  y: 0.22, size: 0.08, anchor: 'tc', text: 'SET TIMES' },
      { type: 'supporting_text', x: 0.5,  y: 0.55, size: 0.04, anchor: 'tc', source: 'generated' },
    ],
  },
  event_promo: {
    layers: [
      { type: 'logo',            x: 0.5,  y: 0.10, scale: 0.18, anchor: 'tc' },
      { type: 'headline_text',   x: 0.5,  y: 0.78, size: 0.10, anchor: 'tc', text: '{{event}}' },
      { type: 'supporting_text', x: 0.5,  y: 0.88, size: 0.035, anchor: 'tc', source: 'generated' },
    ],
  },
  social_post: {
    layers: [
      { type: 'logo',            x: 0.92, y: 0.92, scale: 0.10, anchor: 'br' },
      { type: 'headline_text',   x: 0.06, y: 0.08, size: 0.07, anchor: 'tl', text: '' },
      { type: 'supporting_text', x: 0.06, y: 0.20, size: 0.035, anchor: 'tl', source: 'generated' },
    ],
  },
  social_carousel: {
    layers: [
      { type: 'logo',            x: 0.92, y: 0.92, scale: 0.10, anchor: 'br' },
      { type: 'headline_text',   x: 0.06, y: 0.08, size: 0.07, anchor: 'tl', text: '' },
      { type: 'supporting_text', x: 0.06, y: 0.20, size: 0.035, anchor: 'tl', source: 'generated' },
    ],
  },
  artist_bio: {
    // Name-as-hero spotlight: heavy display name, genre/bio line below.
    layers: [
      { type: 'logo',            x: 0.92, y: 0.08, scale: 0.10, anchor: 'tr' },
      { type: 'headline_text',   x: 0.06, y: 0.66, size: 0.11, anchor: 'tl', text: '{{artist}}' },
      { type: 'supporting_text', x: 0.06, y: 0.82, size: 0.035, anchor: 'tl', source: 'generated' },
    ],
  },
};
