"""
Image composer — Phase 3 v0.5

Minimal viable composition for campaign post images.
- Output: 1080x1350 PNG (Instagram portrait)
- Layers: dark background (with brand-color accent bar) + foreground photo
  (artist hero for spotlights, event flyer otherwise) + typography overlay
  (event/artist name + date in DM Mono)
- No AI-generated backgrounds yet — v0.6 swaps the bg layer for Fal FLUX
- One image per post (not yet 2 variants)
- Idempotent storage path per post: {user}/{post_id}.png — re-runs overwrite

Returns the public Supabase Storage URL of the composed image.
"""
import hashlib
import io
import os
import re
from datetime import datetime
from pathlib import Path

import requests
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from sb_helpers import supabase

PROJECT_ROOT = Path(__file__).resolve().parent
FONT_MONO = str(PROJECT_ROOT / 'brand' / 'fonts' / 'DMMono-Regular.ttf')
FONT_SANS = str(PROJECT_ROOT / 'brand' / 'fonts' / 'DMSans-Regular.ttf')

# IMPORTANT: this module is the asset factory for promoter campaigns.
# NO Sound Cave branding is allowed in any output — no S0UNDCAV3 wordmark,
# no Sound Cave red as a fallback accent. Outputs must read as the
# promoter's brand alone. If the promoter hasn't set brand colours, we
# default to neutral white — never our brand.
BUCKET = 'campaign_images'
WIDTH = 1080
HEIGHT = 1350
BG_DEFAULT = (10, 10, 12)         # neutral near-black
ACCENT_DEFAULT = (240, 240, 240)  # neutral off-white — NOT Sound Cave red
TEXT_HEADING = (245, 245, 245)
TEXT_BODY = (180, 180, 180)
MARGIN = 64


def _hex_to_rgb(s, fallback):
    if not s or not isinstance(s, str):
        return fallback
    m = re.fullmatch(r'#?([0-9a-fA-F]{6})', s.strip())
    if not m:
        return fallback
    h = m.group(1)
    return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def _font(path, size):
    try:
        return ImageFont.truetype(path, size)
    except Exception:
        return ImageFont.load_default()


def _fetch_image(url):
    """Best-effort fetch + open as PIL Image. Returns None on any failure."""
    if not url:
        return None
    try:
        r = requests.get(url, timeout=10, stream=True)
        if r.status_code != 200:
            return None
        img = Image.open(io.BytesIO(r.content)).convert('RGB')
        return img
    except Exception:
        return None


def _cover_crop(img, target_w, target_h):
    """Resize + center-crop so img fills (target_w, target_h) with no distortion."""
    src_w, src_h = img.size
    src_ratio = src_w / src_h
    tgt_ratio = target_w / target_h
    if src_ratio > tgt_ratio:
        # source is wider — scale to height, crop sides
        new_h = target_h
        new_w = int(src_ratio * new_h)
    else:
        new_w = target_w
        new_h = int(new_w / src_ratio)
    img = img.resize((new_w, new_h), Image.LANCZOS)
    left = (new_w - target_w) // 2
    top = (new_h - target_h) // 2
    return img.crop((left, top, left + target_w, top + target_h))


def _wrap_text(draw, text, font, max_width):
    """Greedy word-wrap. Returns list of lines."""
    if not text:
        return []
    words = text.split()
    lines = []
    current = ''
    for w in words:
        candidate = (current + ' ' + w).strip()
        bbox = draw.textbbox((0, 0), candidate, font=font)
        if bbox[2] - bbox[0] <= max_width or not current:
            current = candidate
        else:
            lines.append(current)
            current = w
    if current:
        lines.append(current)
    return lines


def _format_event_date(iso):
    if not iso:
        return ''
    try:
        if 'T' in iso:
            d = datetime.fromisoformat(iso.replace('Z', '+00:00'))
        else:
            d = datetime.fromisoformat(iso)
        return d.strftime('%d %b %Y · %H:%M').upper()
    except Exception:
        return iso


def _draw_image_card(canvas, photo_url, area):
    """Place a photo inside `area` (l,t,r,b). Falls back to a brand-tinted
    placeholder if no photo or fetch fails."""
    x0, y0, x1, y1 = area
    w, h = x1 - x0, y1 - y0
    img = _fetch_image(photo_url) if photo_url else None
    if img:
        cropped = _cover_crop(img, w, h)
        canvas.paste(cropped, (x0, y0))
    else:
        # Solid dark slab as fallback
        placeholder = Image.new('RGB', (w, h), (24, 24, 28))
        canvas.paste(placeholder, (x0, y0))


def compose_post_image(event, profile, post_type, brand_kit=None, campaign_id=None, generated_text=''):
    """Build one PNG for a post. Returns raw bytes.

    Routing:
    - If a style reference is available (event.flyer_image_url or
      brand_kit.reference_image_urls), generate a brand-anchored canvas via the
      v2 router (FLUX.2 [pro], reference + seed honoured) from a Claude-built
      prompt + Pillow typography overlay.
    - Otherwise fall back to the v0.5 Pillow-only composition.

    `generated_text` is the post's selected copy — fed into the image prompt so
    the canvas reflects what the post actually says (was: hardcoded 2-word strings).

    v0.7 (regen variance fix):
    - `campaign_id` pins a deterministic seed so a campaign's posts are drawn
      from adjacent latent space and regen is reproducible.
    - The brand kit logo is composited server-side (fixed, never drifts).

    Image gen errors fall through to Pillow — the post still ships.
    """
    style_ref = _pick_style_reference(event, brand_kit)
    if style_ref:
        try:
            return _compose_brand_aware(event, profile, post_type, style_ref, brand_kit, campaign_id, generated_text)
        except Exception as e:
            print(f'[image_composer] brand-aware path failed ({e}); falling back to Pillow')
    return _compose_pillow_fallback(event, profile, post_type, brand_kit)


# ── v0.7 — deterministic seed ──────────────────────────────

# Stable per-post-type offset so post types differ slightly while every
# regen of the SAME campaign stays identical. Order is fixed; new post
# types append at the end so existing offsets never shift.
_POST_TYPE_SEED_OFFSET = {
    pt: i for i, pt in enumerate([
        'announcement', 'headliner_spotlight', 'support_spotlight',
        'mid_campaign_push', 'countdown_7d', 'countdown_3d', 'countdown_1d',
        'countdown_day_of', 'day_of_doors', 'recap', 'throwback',
        'ticket_push', 'custom',
    ])
}


def _campaign_seed(campaign_id, post_type):
    """Deterministic FLUX seed for a post. Same campaign + post_type → same
    seed every time. Returns None if there's no campaign_id (non-campaign
    callers keep random-seed behaviour)."""
    if not campaign_id:
        return None
    base = int(hashlib.sha256(str(campaign_id).encode()).hexdigest()[:8], 16)
    return base + _POST_TYPE_SEED_OFFSET.get(post_type, 0)


# ── v0.7 — logo lockup overlay ─────────────────────────────

# 9-position grid matches the Brand Kits UI selector (#bfPositionGrid).
# Values are (anchor_x, anchor_y) as fractions; the logo is then nudged
# inward by MARGIN on whichever edges it touches.
_LOGO_ANCHORS = {
    'top_left': (0.0, 0.0), 'top_center': (0.5, 0.0), 'top_right': (1.0, 0.0),
    'center_left': (0.0, 0.5), 'center': (0.5, 0.5), 'center_right': (1.0, 0.5),
    'bottom_left': (0.0, 1.0), 'bottom_center': (0.5, 1.0), 'bottom_right': (1.0, 1.0),
}


def _draw_logo_overlay(canvas, brand_kit):
    """Composite the brand kit logo at a fixed position. Pure server-side —
    FLUX never renders the logo, so it can't drift between posts.

    Position + scale come from brand_kit.defaults (logo_position, logo_scale),
    matching the Brand Kits UI. Missing logo or any failure → skip silently;
    the post still ships."""
    if not brand_kit or not brand_kit.get('logo_url'):
        return
    logo = _fetch_image_rgba(brand_kit['logo_url'])
    if logo is None:
        return

    defaults = brand_kit.get('defaults') or {}
    pos = defaults.get('logo_position', 'bottom_right')
    if pos not in _LOGO_ANCHORS:
        pos = 'bottom_right'
    scale = defaults.get('logo_scale', 0.18)
    try:
        scale = float(scale)
    except (TypeError, ValueError):
        scale = 0.18
    scale = max(0.05, min(0.5, scale))

    # Scale logo to `scale` fraction of canvas width, preserving aspect.
    max_w = int(WIDTH * scale)
    lw, lh = logo.size
    new_w = max_w
    new_h = max(1, int(lh * (new_w / lw)))
    logo = logo.resize((new_w, new_h), Image.LANCZOS)

    ax, ay = _LOGO_ANCHORS[pos]
    x = int((WIDTH - new_w) * ax)
    y = int((HEIGHT - new_h) * ay)
    # Nudge inward by MARGIN on touched edges.
    if ax == 0.0:
        x += MARGIN
    elif ax == 1.0:
        x -= MARGIN
    if ay == 0.0:
        y += MARGIN
    elif ay == 1.0:
        y -= MARGIN

    canvas.paste(logo, (x, y), logo)


def _fetch_image_rgba(url):
    """Like _fetch_image but preserves alpha — used for the logo so PNG
    transparency composites correctly."""
    if not url:
        return None
    try:
        r = requests.get(url, timeout=10, stream=True)
        if r.status_code != 200:
            return None
        return Image.open(io.BytesIO(r.content)).convert('RGBA')
    except Exception:
        return None


def _pick_style_reference(event, brand_kit):
    """Return the first available reference image URL or None."""
    if event and event.get('flyer_image_url'):
        return event['flyer_image_url']
    if brand_kit and brand_kit.get('reference_image_urls'):
        refs = brand_kit['reference_image_urls']
        if refs:
            return refs[0]
    return None


# Campaign post_type → Forge content_type, so the shared build_image_prompt
# picks the right STYLE_HINTS. Spotlights are artist-led; announcements are
# poster-led; everything else is promo/atmospheric.
def _campaign_content_type(post_type, profile):
    if profile:
        return 'artist_bio'
    if post_type == 'announcement':
        return 'event_poster'
    return 'event_promo'


def _compose_brand_aware(event, profile, post_type, style_ref, brand_kit=None, campaign_id=None, generated_text=''):
    """Brand-aware path — v2 router (FLUX.2 [pro]) for the canvas + Pillow for typography.

    The image prompt is Claude-built from the event/artist context + the post's
    actual copy (was: hardcoded 2-word strings that ignored the text entirely).
    The style reference goes to FLUX.2 as image_refs (anchors palette/composition),
    and a deterministic per-campaign seed keeps regen reproducible. The brand logo
    is composited server-side (never asked of the model) so it can't drift.

    FLUX.2 (JOB_HERO_ART) is fixed here — it honours image_refs + seed, both of
    which the brand-aware path depends on; Seedream ignores both."""
    from media_gen import build_image_prompt, generate_for_job, JOB_HERO_ART

    content_type = _campaign_content_type(post_type, profile)
    ctx = {'event': event.get('name') or ''}
    venue = event.get('venue_name') or ''
    if event.get('venue_city'):
        venue = (venue + ', ' + event['venue_city']).strip(', ')
    if venue:
        ctx['freeform'] = f'Venue: {venue}'
    if profile:
        genre = profile.get('genre_tags') or profile.get('genre') or ''
        if isinstance(genre, list):
            genre = ', '.join(genre)
        ctx['artist_data'] = {'name': profile.get('display_name') or '', 'genre': genre}

    prompt = build_image_prompt(content_type, ctx, generated_text)
    print(f"🎨 Campaign image — post_type={post_type} content_type={content_type} "
          f"seed={_campaign_seed(campaign_id, post_type)} ref={'yes' if style_ref else 'no'}")
    print(f"   prompt: {prompt[:240]}")

    seed = _campaign_seed(campaign_id, post_type)
    flux_bytes, _, _ = generate_for_job(JOB_HERO_ART, prompt, image_refs=[style_ref],
                                        width=WIDTH, height=HEIGHT, seed=seed)
    canvas = Image.open(io.BytesIO(flux_bytes)).convert('RGB')
    canvas = _cover_crop(canvas, WIDTH, HEIGHT)  # ensure exact dimensions
    draw = ImageDraw.Draw(canvas)

    # Typography overlay — minimal, no Sound Cave branding
    accent = _hex_to_rgb(event.get('brand_color_primary'), ACCENT_DEFAULT)

    # Subtle dark gradient at the bottom so text is always legible over the
    # generated canvas. We don't know what FLUX returned; play it safe.
    grad_h = 480
    grad = Image.new('RGBA', (WIDTH, grad_h), (0, 0, 0, 0))
    g_draw = ImageDraw.Draw(grad)
    for y in range(grad_h):
        alpha = int(180 * (y / grad_h))
        g_draw.rectangle([(0, y), (WIDTH, y + 1)], fill=(0, 0, 0, alpha))
    canvas.paste(grad, (0, HEIGHT - grad_h), grad)

    # Brand logo — fixed server-side composite (v0.7), never drifts.
    _draw_logo_overlay(canvas, brand_kit)
    draw = ImageDraw.Draw(canvas)

    # Post type label (top-left)
    label_font = _font(FONT_MONO, 26)
    label_text = post_type.replace('_', ' ').upper()
    draw.text((MARGIN, MARGIN), label_text, font=label_font, fill=accent)

    # Heading (artist or event name) — bottom block
    is_spotlight = bool(profile)
    heading_text = ((profile.get('display_name') if is_spotlight else event.get('name', '')) or '').upper()
    heading_font = _font(FONT_SANS, 64)
    heading_lines = _wrap_text(draw, heading_text, heading_font, WIDTH - 2 * MARGIN)[:2]

    line_h = 76
    detail_y_offset = 40
    detail_font = _font(FONT_MONO, 26)
    detail_bits = [_format_event_date(event.get('event_date'))]
    venue_str = event.get('venue_name') or ''
    if event.get('venue_city'):
        venue_str = (venue_str + ', ' + event['venue_city']).strip(', ')
    if venue_str:
        detail_bits.append(venue_str.upper())
    detail = '  ·  '.join(b for b in detail_bits if b)

    # Compute bottom-anchored Y for the text block
    text_block_h = line_h * len(heading_lines) + (detail_y_offset + 30 if detail else 0)
    text_top = HEIGHT - MARGIN - text_block_h
    y = text_top
    for line in heading_lines:
        draw.text((MARGIN, y), line, font=heading_font, fill=TEXT_HEADING)
        y += line_h
    if detail:
        draw.text((MARGIN, y + 12), detail, font=detail_font, fill=TEXT_BODY)

    buf = io.BytesIO()
    canvas.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def _compose_pillow_fallback(event, profile, post_type, brand_kit=None):
    """v0.5 fallback — dark canvas + photo + typography. Used when there's
    no style reference available. v0.7: gets the same logo overlay so brand
    consistency holds even on the no-reference path."""
    accent = _hex_to_rgb(event.get('brand_color_primary'), ACCENT_DEFAULT)
    bg = _hex_to_rgb(event.get('brand_color_secondary'), BG_DEFAULT)

    canvas = Image.new('RGB', (WIDTH, HEIGHT), bg)
    draw = ImageDraw.Draw(canvas)

    # Top accent bar (thin)
    draw.rectangle([(0, 0), (WIDTH, 6)], fill=accent)

    # Headline label (post type)
    label_font = _font(FONT_MONO, 26)
    label_text = post_type.replace('_', ' ').upper()
    draw.text((MARGIN, 36), label_text, font=label_font, fill=accent)

    # Photo area — top ~62% of canvas
    photo_top = 96
    photo_h = 820
    photo_area = (MARGIN, photo_top, WIDTH - MARGIN, photo_top + photo_h)
    photo_url = None
    if profile and profile.get('hero_image_url'):
        photo_url = profile['hero_image_url']
    elif event.get('flyer_image_url'):
        photo_url = event['flyer_image_url']
    _draw_image_card(canvas, photo_url, photo_area)

    # Text block below photo
    text_top = photo_top + photo_h + 36

    # Primary heading: artist display name (spotlights) or event name
    is_spotlight = bool(profile)
    heading_text = (profile.get('display_name') if is_spotlight else event.get('name', '')) or ''
    heading_text = heading_text.upper()

    # Sans-bold-ish via DM Sans Regular at large size — punchy enough
    heading_font = _font(FONT_SANS, 64)
    heading_lines = _wrap_text(draw, heading_text, heading_font, WIDTH - 2 * MARGIN)
    # Trim to 2 lines max
    heading_lines = heading_lines[:2]
    y = text_top
    for line in heading_lines:
        draw.text((MARGIN, y), line, font=heading_font, fill=TEXT_HEADING)
        y += 76

    # Secondary line: event date + venue
    detail_font = _font(FONT_MONO, 26)
    detail_bits = [_format_event_date(event.get('event_date'))]
    venue_str = event.get('venue_name') or ''
    if event.get('venue_city'):
        venue_str = (venue_str + ', ' + event['venue_city']).strip(', ')
    if venue_str:
        detail_bits.append(venue_str.upper())
    detail = '  ·  '.join(b for b in detail_bits if b)
    if detail:
        draw.text((MARGIN, y + 12), detail, font=detail_font, fill=TEXT_BODY)

    # Brand logo — fixed server-side composite (v0.7).
    # NB: deliberately no project signature or watermark on output.
    # Generated assets carry the promoter's brand alone (see module docstring).
    _draw_logo_overlay(canvas, brand_kit)

    buf = io.BytesIO()
    canvas.save(buf, format='PNG', optimize=True)
    return buf.getvalue()


def store_post_image(user_id, post_id, png_bytes):
    """Upload to Supabase Storage with upsert; return public URL."""
    path = f"{user_id}/{post_id}.png"
    sb = supabase()
    sb.storage.from_(BUCKET).upload(
        path=path, file=png_bytes,
        file_options={'content-type': 'image/png', 'upsert': 'true'},
    )
    return sb.storage.from_(BUCKET).get_public_url(path)
