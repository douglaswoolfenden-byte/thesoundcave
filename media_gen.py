"""
The Sound Cave — Media Generation Module
Generates images and videos for content. Successor to image_gen.py.

Tiers (per wiki/decisions/0003_saas_architecture.md):
  - image            — Fal AI FLUX schnell, Replicate fallback
  - video_composite  — FFmpeg: still image + audio waveform + Ken Burns (Tier 1)
  - video_standard   — Fal LTX / Hunyuan text-to-video (Tier 2)
  - video_premium    — Fal Kling / Replicate Veo (Tier 3)

Claude builds optimised prompts from content context.
"""
import base64
import os
import time
import hashlib
import io
import base64
import uuid
from datetime import datetime, timezone
from enum import Enum
import requests as http_requests
from dotenv import load_dotenv
import anthropic
from PIL import Image


class MediaType(str, Enum):
    IMAGE = 'image'
    VIDEO_COMPOSITE = 'video_composite'  # Tier 1 — FFmpeg
    VIDEO_STANDARD = 'video_standard'    # Tier 2 — Fal LTX/Hunyuan
    VIDEO_PREMIUM = 'video_premium'      # Tier 3 — Kling/Veo

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# ── Cost + safety guardrails ───────────────────────────────
# All set conservatively for v1; Phase H or a dedicated decision lifts them.
MAX_VIDEO_DURATION_SECONDS = 10        # Tier 2/3 cost scales linearly; cap is the brake
MAX_AUDIO_FILE_BYTES = 25 * 1024 * 1024  # 25MB
# Per-model poll timeouts. Video models are genuinely slow:
#   LTX     ~60–180s warm, ~3 min cold
#   Hunyuan ~3–5 min routinely
#   Kling   ~2–4 min
#   Veo     ~2–4 min
# Tuned to "long enough for normal cold-start, short enough that a stuck job dies cleanly".
POLL_TIMEOUT_LTX = 240        # 4 min
POLL_TIMEOUT_HUNYUAN = 420    # 7 min
POLL_TIMEOUT_KLING = 300      # 5 min
POLL_TIMEOUT_VEO = 300        # 5 min
POLL_VERBOSE = os.getenv('MEDIA_GEN_POLL_VERBOSE') == '1'  # set to log each poll status

# DRY_RUN short-circuits all paid video providers (Fal LTX/Hunyuan/Kling, Replicate Veo).
# Returns a tiny FFmpeg-generated placeholder mp4 instead of calling the API.
# Image generation (Flux schnell, ~$0.003) is NOT dry-runned — too cheap to bother.
DRY_RUN = os.getenv('MEDIA_GEN_DRY_RUN') == '1'

# Estimated USD per call — surfaced in API responses for cost transparency.
# Tune from real invoices; these are upper-bound public list prices as of 2026-04.
COST_USD = {
    'image':             0.15,  # nano-banana-pro/edit (est. — verify vs real invoice)
    'video_composite':   0.003, # only the cover image (Flux schnell)
    'video_standard':    0.10,  # Fal LTX 5s @ 720p
    'video_premium':     2.00,  # Fal Kling 5s
    'video_premium_10s': 4.00,  # Fal Kling 10s (~2x the 5s clip)
}

# Supabase Storage client (service role — server-side only, bypasses RLS)
_supabase = None
def _get_supabase():
    global _supabase
    if _supabase is None:
        from supabase import create_client
        _supabase = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_KEY'],
        )
    return _supabase

# Until Phase B (auth) lands, server-side gens are owned by this dev user.
# Matches the seeded row in public.users.
DEV_USER_ID = os.getenv('DEV_USER_ID', '00000000-0000-0000-0000-000000000001')
IMAGE_BUCKET = 'generated_images'
VIDEO_BUCKET = 'generated_videos'
AUDIO_BUCKET = 'audio_tracks'

# ── Per-content-type image dimensions ──────────────────────
# Per wiki/spec/forge_output_recipes.md (Approved 2026-06-09): all 5 types are 4:5 portrait
# feed format. The model generates the BACKDROP only; the Konva compositor overlays type.
IMAGE_DIMENSIONS = {
    'social_post':     (1080, 1350),   # 4:5 portrait — IG/FB feed
    'social_carousel': (1080, 1350),   # 4:5 portrait — IG/FB carousel slide
    'event_promo':     (1080, 1350),   # 4:5 portrait — atmospheric teaser
    'event_poster':    (1080, 1350),   # 4:5 portrait — full lineup poster
    'artist_bio':      (1080, 1350),   # 4:5 portrait — artist spotlight feed post
}

# ── Style hints per content type ───────────────────────────
# House style is non-negotiable dark (#0a0a0a / #e8e8e8 / single #ff4500). These hints describe
# the BACKDROP intent only — type/logo are composited on top, never rendered by the model.
STYLE_HINTS = {
    'social_post':     'Full-bleed near-black backdrop, single focal texture or subject, crushed toward monochrome, deliberate empty zone, grain, high contrast.',
    'social_carousel': 'Dark carousel-slide backdrop, consistent grid and motif across slides, restrained, room for slide numbering.',
    'event_promo':     'Atmospheric and mysterious, near-black, minimal, fog or smoke or a lone figure, heavy negative space, anticipation.',
    'event_poster':    'Dark brutalist backdrop for a poster, smoke/grain/concrete texture, subordinate to typography, room for a type hierarchy.',
    'artist_bio':      'Artist spotlight backdrop, figure as silhouette/duotone/abstract (never a detailed face), dramatic backlight, grain, near-black.',
}

IMAGE_PROMPT_SYSTEM = """You are an expert image prompt engineer for AI image generation (FLUX/Stable Diffusion models).

Your job: translate music content context into a single, detailed image generation prompt.

Rules:
- Output ONLY the prompt text, nothing else — no quotes, no explanation
- Describe composition, lighting, colour palette, mood, textures, and style
- NEVER include text, words, letters, or typography in the image — AI models render text badly
- NEVER include human faces in detail — use silhouettes, back views, or abstract figures
- Draw from underground electronic music visual culture: dark rooms, strobes, haze, concrete, neon, vinyl, waveforms, brutalist architecture, warehouse aesthetics
- Be specific about camera angle, depth of field, and lighting direction
- Keep prompts under 200 words
- End with style modifiers (e.g., "shot on 35mm film, grain, high contrast")"""


def build_image_prompt(content_type, ctx, generated_text=''):
    """Use Claude to generate an optimised image prompt from content context.

    If ctx['reference_images'] is a list of data:image/... URLs, they're passed
    to Claude as vision input so the generated prompt mirrors their visual
    style (palette, composition, mood).
    """
    style = STYLE_HINTS.get(content_type, 'Modern, clean, music-related.')

    parts = [f"Content type: {content_type}", f"Style direction: {style}"]

    artist_data = ctx.get('artist_data')
    if artist_data:
        name = artist_data.get('name', '')
        genre = artist_data.get('genre', '')
        if name:
            parts.append(f"Artist: {name}")
        if genre:
            parts.append(f"Genre: {genre}")

    event = ctx.get('event')
    if event:
        parts.append(f"Event: {event}")

    # Lineup + structured event fields (input-usage audit 2026-06-10: collected by
    # the Forge but never passed). Scene/mood context only — the renderable facts
    # (date/doors/tickets) belong to the compositor overlay, not the image.
    artist_list = ctx.get('artist_list')
    if artist_list:
        parts.append(f"Lineup (context, not text to render): {artist_list}")
    place = ' — '.join(v for v in (ctx.get('venue'), ctx.get('city')) if v)
    if place:
        parts.append(f"Setting: {place}")

    release = ctx.get('release')
    if release:
        parts.append(f"Release: {release}")

    # L4b — carousel slide series (backdrop route stays text-free: the system
    # prompt forbids rendered text; slide text rides the caption instead).
    slide = _slide_block(ctx, bake_text=False)
    if slide:
        parts.append(slide)

    # L5 — binding direction first, then mood (parsed from Additional Context;
    # unparsed legacy boxes pass through whole, unclipped).
    direction = (ctx.get('direction') or '').strip()
    if direction:
        parts.append(f"The promoter's design instructions — obey closely (placement, scale, type size, composition): {direction}")
    mood = (ctx.get('mood') or '').strip()
    if mood:
        parts.append(f"Mood: {mood}")
    elif not direction and ctx.get('freeform'):
        parts.append(f"Context: {ctx['freeform']}")

    voice_energy = _VOICE_IMAGE_ENERGY.get(ctx.get('voice'))
    if voice_energy:
        parts.append(f"Energy: {voice_energy}")

    brand_palette = (ctx.get('brand') or {}).get('palette') or {}
    brand_hexes = [v for v in brand_palette.values() if isinstance(v, str) and v.startswith('#')]
    if brand_hexes:
        parts.append(f"Brand palette to lean toward: {', '.join(brand_hexes[:5])}")

    if generated_text:
        preview = generated_text[:300]
        parts.append(f"Generated copy (for mood reference): {preview}")

    image_blocks = _ref_image_blocks(ctx.get('reference_images'))
    if image_blocks:
        parts.append('Visual references attached — mirror their palette, composition, and mood.')

    user_msg = '\n'.join(parts)
    user_content = (
        image_blocks + [{'type': 'text', 'text': user_msg}]
        if image_blocks else user_msg
    )

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=300,
        system=IMAGE_PROMPT_SYSTEM,
        messages=[{'role': 'user', 'content': user_content}]
    )
    return message.content[0].text.strip()


# L1 FORMAT — what we're producing, stated first in every prompt (Context Stack).
_FORMAT_INTENT = {
    'social_post':     'a single striking social-feed image',
    'social_carousel': 'a social carousel slide',
    'event_promo':     'an atmospheric event teaser image',
    'event_poster':    'a flyer for an underground music event',
    'artist_bio':      'an artist spotlight image',
}


def _slide_block(ctx, bake_text=True):
    """Phase B (real carousel): series-consistency instruction + this slide's
    own line. ctx['slide'] = {'index': 1-based, 'count': N, 'text': str}.
    The whole set shares one seed (frontend) + this block — slides are ordered
    L4 facts (master spec §6). bake_text=False on routes whose system prompt
    forbids rendered text (the Claude-written backdrop path)."""
    s = ctx.get('slide') or {}
    if not s:
        return ''
    block = (f"This is slide {s.get('index')} of a {s.get('count')}-slide "
             "carousel — one continuous series: keep the palette, grid, motif "
             "placement and graphic language IDENTICAL on every slide; only the "
             "focal content changes slide to slide.")
    txt = (s.get('text') or '').strip()
    if txt and bake_text:
        short = txt if len(txt) <= 160 else txt[:157] + '…'
        block += (f"\nRender this slide's text crisp and legible, exactly as "
                  f'written: "{short}". Every other piece of text — including '
                  "any small print, address blocks, badges or dates from the "
                  "reference — must NOT appear: fill those zones with graphic "
                  "texture in the same style.")
    return block


def _direction_block(ctx):
    """L5 DIRECTION — the promoter's binding design instructions (master spec
    2026-06-12: 'followed closely as instruction of design'). Beats style
    DEFAULTS on application (placement, scale, type size, composition); never
    overrides the quoted facts, the WHO carbon-copy law, or the style ref's
    aesthetic language."""
    d = (ctx.get('direction') or '').strip()
    if not d:
        return ''
    return ("The promoter's design instructions — follow them closely; they "
            "override default placement, scale, type sizing and composition "
            "(but never the quoted text content or the reference aesthetic): "
            + d)


# Voice profile → image energy. The voice presets shape the COPY's tone; these
# give the image the matching energy (style words only — never rendered text).
_VOICE_IMAGE_ENERGY = {
    'underground': 'raw, gritty, unpolished authenticity',
    'industry':    'restrained, considered, premium polish',
    'hype':        'high-energy, bold, electric intensity',
    'personal':    'intimate, candid, close and warm',
}


def _vibe_cues(ctx, generated_text='', include_brand=True):
    """Collect the promoter's NON-TEXT mood inputs as style cues for image prompts.

    Forge input-usage audit (2026-06-10) found these were collected but discarded
    on the image path. Everything here describes mood/theme only — event facts
    (date/venue/tickets) stay OUT: they belong to the compositor overlay.

    include_brand=False when a STYLE reference is present: per the context-pipeline
    spec (signed off 2026-06-11) an uploaded style ref outranks the brand palette.
    """
    cues = []
    genre = (ctx.get('artist_data') or {}).get('genre')
    if genre:
        cues.append(f"{genre} scene")
    event = (ctx.get('event') or '').strip()
    if event:
        cues.append(f'themed around "{event}"')
    # L5 MOOD: the parsed vibe (directives travel separately via _direction_block).
    # The old 200-char clip is dead (master spec 2026-06-12). Legacy callers
    # without the parsed split fall back to the raw box, unclipped within reason.
    mood = (ctx.get('mood') or '').strip()
    if mood:
        cues.append(mood)
    elif not (ctx.get('direction') or '').strip():
        freeform = (ctx.get('freeform') or '').strip()
        if freeform:
            cues.append(freeform[:500])
    voice = _VOICE_IMAGE_ENERGY.get(ctx.get('voice'))
    if voice:
        cues.append(voice)
    if include_brand:
        brand = ctx.get('brand') or {}
        palette = brand.get('palette') or {}
        hexes = [v for v in palette.values() if isinstance(v, str) and v.startswith('#')]
        if hexes:
            cues.append(f"lean toward the brand palette: {', '.join(hexes[:5])}")
    return cues


def _baked_text_lines(ctx):
    """Event facts as render-in-image text instructions — each string quoted and
    given a typographic ROLE. Roles describe INTENT (the model matches the
    reference's hierarchy), not absolute pixel size.
    Returns [] when no facts exist; callers then forbid text instead.

    P1.5 (2026-06-11): text is BAKED INTO the generated image (no compositor for
    flyers). P0 fix (2026-06-22): the night/theme name is the HERO display line;
    the lineup is its OWN secondary block in billing order. The old code made the
    whole lineup the "biggest element", so the model rendered a 12-name run as
    headline type, fought the reference's hierarchy, and stranded leftover title
    text. The lineup now renders ONCE, distributed across the reference's lineup
    zones — never duplicated into every block.
    """
    v = lambda k: (ctx.get(k) or '').strip()
    night = v('event')
    acts = [a.strip() for a in v('artist_list').split('\n') if a.strip()]
    lines = []
    # Hero display = the night/theme name. With no night name, the top billing
    # act headlines and the rest stay the supporting lineup.
    hero = night or (acts.pop(0) if acts else '')
    if hero:
        lines.append(f'- Title (the hero display type — the largest text, in the '
                     f'reference\'s main-title treatment): "{hero}"')
    if acts:
        billing = ' · '.join(acts)
        lines.append(f'- Lineup (secondary to the title, in the reference\'s '
                     f'lineup-block style — render this list ONCE, split across the '
                     f'reference\'s lineup zones in this billing order, and NEVER '
                     f'repeat a name): "{billing}"')
    place = ' — '.join(x for x in (v('venue'), v('city')) if x)
    if place:
        lines.append(f'- Venue line: "{place}"')
    when = v('date')
    if v('doors'):
        doors = f"DOORS {v('doors')}" + (f"–{v('curfew')}" if v('curfew') else '')
        when = f'{when} · {doors}' if when else doors
    if when:
        lines.append(f'- Date line: "{when}"')
    if v('tickets'):
        lines.append(f'- Tickets line: "{v("tickets")}"')
    return lines


def build_restyle_prompt(content_type, ctx, generated_text=''):
    """Prompt for JOB_RESTYLE: recreate the uploaded reference's design with the
    REAL event text baked in.

    P1.5 verdict (Doug, 2026-06-11, live review): outputs must follow the style
    reference much more closely, and text is rendered by the model — no editable
    overlay. This reverses the text-free-backdrop approach (which literally
    instructed the model to deviate from the reference by stripping its
    type-driven layout). Built directly (no Claude call).
    """
    n_refs = len(ctx.get('reference_images') or []) or 1
    ref_word = ('these reference flyers — they are one designer\'s series; treat '
                'their shared design language as law' if n_refs > 1
                else 'this exact flyer design')
    # Stack order: L1 format intent → L2 style law → L4 facts → L5 direction → mood.
    intent = _FORMAT_INTENT.get(content_type, 'a piece of underground music artwork')
    has_direction = bool((ctx.get('direction') or '').strip())
    # Direction beats style DEFAULTS on application (alignment law): when the
    # promoter gave layout instructions, the recreate clause must yield on
    # composition or the model resolves the conflict in the reference's favour
    # (proven live, scratch/phaseA_direction_test.png).
    composition_clause = (
        "Keep the colour palette, print texture, graphic elements, motifs and "
        "mascots IDENTICAL to the reference, but ADAPT the layout and "
        "composition wherever the promoter's design instructions below require it"
        if has_direction else
        "Keep the layout, colour palette, print texture, graphic elements, "
        "motifs, mascots and composition IDENTICAL to the reference"
    )
    base = (
        f"You are producing {intent}.\n"
        f"Recreate {ref_word}. {composition_clause} — this is the same designer "
        "making the next flyer in the series."
    )
    text_lines = _baked_text_lines(ctx)
    if text_lines:
        base += (
            "\nReplace ALL existing text with the new event text below, matching "
            "the reference's typographic style (same font feel, weight, case and "
            "placement hierarchy):\n" + '\n'.join(text_lines) +
            "\nReplace the reference's main title ENTIRELY with the new Title above "
            "— no word, fragment or letter of the reference's original title may "
            "survive (if the reference reads 'TECHNO HOUSE', neither 'TECHNO' nor "
            "'HOUSE' remains anywhere). "
            "Render every quoted string EXACTLY as written, correctly spelled, "
            "crisp and legible. Every other piece of text in the reference — "
            "small print, address blocks, badges, dates, slogans — must NOT "
            "appear: where it has no replacement above, fill the zone with "
            "graphic texture in the same style. No other text anywhere in the image."
        )
    elif not (ctx.get('slide') or {}).get('text'):
        base += (
            "\nThis piece carries no text: replace the reference's lettering with "
            "clean graphic texture in the same style."
        )
    # L4b — carousel slide context (series consistency + this slide's line).
    slide = _slide_block(ctx)
    if slide:
        base += '\n' + slide
    # L5 DIRECTION — binding design instructions, after the facts.
    direction = _direction_block(ctx)
    if direction:
        base += '\n' + direction
    # Style law (context-pipeline spec): an uploaded style ref outranks the brand
    # palette, so brand cues stay out of the restyle path.
    cues = _vibe_cues(ctx, generated_text, include_brand=False)
    if cues:
        base += "\nAdapt the mood toward (style only): " + '; '.join(cues) + '.'
    return base


def build_compose_prompt(content_type, ctx, roled_refs, generated_text=''):
    """Prompt for JOB_COMPOSE / JOB_COMPOSE_PERSON (multi-reference /edit models).

    Narrative creative-director prose assembled in CONTEXT STACK order (master
    spec 2026-06-12): L1 format intent → L2 style law → L3 subjects (each named
    by role) → L4 quoted facts → L5 binding direction → mood. The STYLE ref
    governs the aesthetic; direction beats default placement/scale; facts render
    exactly. roled_refs order must match the image_refs order.
    """
    intent = _FORMAT_INTENT.get(content_type, 'a piece of underground music artwork')

    who, where, what, style = [], [], [], []
    for i, ref in enumerate(roled_refs, 1):
        note = (ref.get('note') or '').strip()
        tag = f'image {i}' + (f' ("{note}")' if note else '')
        {'who': who, 'where': where, 'what': what}.get(ref.get('role'), style).append(tag)

    # L1 — format intent
    lines = [f'Create {intent}.']
    # L2 — style law
    if style:
        lines.append(f"The entire image is rendered in the visual style of "
                     f"{' and '.join(style)}: its colour palette, print texture, "
                     "graphic language and layout energy govern everything and win "
                     "every visual conflict.")
    # L3 — subjects, each named by role
    if who:
        lines.append(f"Feature the person from {' and '.join(who)} — preserve "
                     "their exact face, hair and build; never swap them for a "
                     "different figure.")
    if where:
        lines.append(f"Set the scene in the location from {' and '.join(where)}.")
    if what:
        lines.append(f"Include the object from {' and '.join(what)}, recreated "
                     "faithfully but rendered to fit the final style.")
    # Generic style hint is SUPPRESSED when a STYLE ref is present — the
    # reference defines the look. The hardcoded "dark brutalist backdrop" intent
    # was overriding light/cream STYLE references and flipping the palette to
    # black (2026-06-18: Doug's cream TECHNO HOUSE ref came out a dark starfield).
    # With no STYLE ref, the hint still seeds a sensible default backdrop.
    hint = STYLE_HINTS.get(content_type)
    if hint and not style:
        lines.append(f'Output intent: {hint}')
    # L4 — facts, quoted and exact
    text_lines = _baked_text_lines(ctx)
    if text_lines:
        lines.append('Render the following text in the image, in typography that '
                     'matches the style' + (' reference' if style else '') + ':\n'
                     + '\n'.join(text_lines) +
                     '\nEvery quoted string EXACTLY as written, correctly spelled, '
                     'crisp and legible. No other text anywhere.')
    elif not (ctx.get('slide') or {}).get('text'):
        lines.append('Do not render any text, lettering or typography.')
    # L4b — carousel slide context (series consistency + this slide's line).
    slide = _slide_block(ctx)
    if slide:
        lines.append(slide)
    # L5 — binding direction, then mood (style law: STYLE ref outranks brand)
    direction = _direction_block(ctx)
    if direction:
        lines.append(direction)
    cues = _vibe_cues(ctx, generated_text, include_brand=not style)
    if cues:
        lines.append('Mood: ' + '; '.join(cues) + '.')
    return '\n'.join(lines)


def _ref_image_blocks(reference_images):
    """Convert data-URL reference images to Anthropic image blocks. Silent on
    malformed input — boundary validation happens in content_api._ref_images_to_blocks."""
    if not reference_images or not isinstance(reference_images, list):
        return []
    blocks = []
    for data_url in reference_images:
        if not isinstance(data_url, str) or not data_url.startswith('data:image/'):
            continue
        try:
            header, b64 = data_url.split(',', 1)
            media_type = header.split(';')[0].removeprefix('data:')
        except (ValueError, AttributeError):
            continue
        if media_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
            continue
        blocks.append({
            'type': 'image',
            'source': {'type': 'base64', 'media_type': media_type, 'data': b64},
        })
    return blocks


# ── WHO carbon-copy pipeline (Phase C, master spec 2026-06-12) ─────────────
# Real people are PASTED, never drawn: cutout (background removal) → composite
# onto the generated design → grade. Only non-identity edits allowed.

_PLACEMENT_ANCHORS = {
    'top-left':     (0.02, 0.02), 'top-right':    (0.98, 0.02), 'top':    (0.5, 0.02),
    'bottom-left':  (0.02, 0.98), 'bottom-right': (0.98, 0.98), 'bottom': (0.5, 0.98),
    'left':         (0.02, 0.5),  'right':        (0.98, 0.5),  'centre': (0.5, 0.5),
}


def _parse_placement(direction):
    """Deterministic keyword parse of the Direction text for WHO placement.
    Returns {'anchor', 'scale', 'grayscale'}. Defaults: bottom-right, 45% of
    canvas height, full colour. Direction is binding (alignment law) — these
    keywords are the contract, no model call needed."""
    d = (direction or '').lower().replace('center', 'centre')
    anchor = 'bottom-right'
    for name in ('top-left', 'top-right', 'bottom-left', 'bottom-right'):
        if name in d or name.replace('-', ' ') in d:
            anchor = name
            break
    else:
        for name in ('bottom', 'top', 'left', 'right', 'centre'):
            if name in d:
                anchor = name
                break
    scale = 0.45
    if 'tiny' in d: scale = 0.18
    elif 'small' in d: scale = 0.28
    elif 'large' in d or 'big' in d: scale = 0.62
    elif 'huge' in d or 'full height' in d: scale = 0.85
    grayscale = any(k in d for k in ('black and white', 'black & white', 'b&w', 'grayscale', 'greyscale', 'monochrome'))
    return {'anchor': anchor, 'scale': scale, 'grayscale': grayscale}


def remove_background(image_bytes_or_data_url):
    """Cutout via fal birefnet v2. Accepts raw bytes or a data URL; returns
    RGBA PNG bytes with transparent background. ~$0.002/call."""
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')
    if isinstance(image_bytes_or_data_url, bytes):
        image_url = 'data:image/png;base64,' + base64.b64encode(image_bytes_or_data_url).decode()
    else:
        image_url = image_bytes_or_data_url
    r = http_requests.post(
        'https://fal.run/fal-ai/birefnet/v2',
        headers={'Authorization': f'Key {api_key}', 'Content-Type': 'application/json'},
        json={'image_url': image_url, 'output_format': 'png'},
        timeout=60,
    )
    r.raise_for_status()
    out_url = r.json()['image']['url']
    img_r = http_requests.get(out_url, timeout=60)
    img_r.raise_for_status()
    return img_r.content


def composite_who(base_png_bytes, cutout_png_bytes, direction=''):
    """Paste the person's cutout onto the generated design, pixel-true.
    Placement/scale/grade come from the binding Direction (keyword contract in
    _parse_placement). The person is never redrawn — PIL paste only."""
    place = _parse_placement(direction)
    base = Image.open(io.BytesIO(base_png_bytes)).convert('RGBA')
    cut = Image.open(io.BytesIO(cutout_png_bytes)).convert('RGBA')

    if place['grayscale']:
        alpha = cut.getchannel('A')
        cut = cut.convert('L').convert('RGBA')
        cut.putalpha(alpha)

    target_h = int(base.height * place['scale'])
    ratio = target_h / cut.height
    cut = cut.resize((max(1, int(cut.width * ratio)), target_h), Image.LANCZOS)

    ax, ay = _PLACEMENT_ANCHORS.get(place['anchor'], _PLACEMENT_ANCHORS['bottom-right'])
    x = int(ax * (base.width - cut.width))
    y = int(ay * (base.height - cut.height))
    base.alpha_composite(cut, (x, y))

    out = io.BytesIO()
    base.convert('RGB').save(out, format='PNG')
    return out.getvalue()


# ── Provider: Fal AI ───────────────────────────────────────

def _generate_fal(prompt, width, height):
    """Generate image via Fal AI FLUX schnell. Returns image bytes."""
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')

    r = http_requests.post(
        'https://fal.run/fal-ai/flux/schnell',
        headers={
            'Authorization': f'Key {api_key}',
            'Content-Type': 'application/json',
        },
        json={
            'prompt': prompt,
            'image_size': {'width': width, 'height': height},
            'num_images': 1,
            'enable_safety_checker': True,
        },
        timeout=30,
    )
    r.raise_for_status()
    data = r.json()

    image_url = data['images'][0]['url']
    img_r = http_requests.get(image_url, timeout=30)
    img_r.raise_for_status()
    return img_r.content, 'fal-ai', 'flux-schnell'


def generate_fal_with_reference(prompt, reference_image_url, width, height, timeout=60, seed=None):
    """Generate image via Fal AI FLUX Redux — takes a style reference URL.

    Used by Phase 3 v0.6 brand-aware image gen: feed in one of the
    promoter's past flyers or their event master flyer as the style anchor,
    plus a per-post prompt for content variation.

    `seed` (v0.7): when set, pins FLUX to a fixed seed so a campaign's posts
    are drawn from adjacent latent space and regen is deterministic. When
    None, Fal picks a random seed (unchanged behaviour).

    Returns (image_bytes, provider, model). Raises on failure — callers
    decide whether to fall back to the Pillow-only composer.
    """
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')
    if not reference_image_url:
        raise ValueError('reference_image_url is required')

    payload = {
        'prompt': prompt,
        'image_url': reference_image_url,
        'image_size': {'width': width, 'height': height},
        'num_inference_steps': 28,
        'num_images': 1,
        'enable_safety_checker': True,
    }
    if seed is not None:
        payload['seed'] = int(seed)

    r = http_requests.post(
        'https://fal.run/fal-ai/flux/dev/redux',
        headers={
            'Authorization': f'Key {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    out_url = data['images'][0]['url']
    img_r = http_requests.get(out_url, timeout=timeout)
    img_r.raise_for_status()
    return img_r.content, 'fal-ai', 'flux-dev-redux'


# ── Provider: Replicate ────────────────────────────────────

def _generate_replicate(prompt, width, height):
    """Generate image via Replicate FLUX schnell. Returns image bytes."""
    api_token = os.getenv('REPLICATE_API_TOKEN')
    if not api_token:
        raise RuntimeError('REPLICATE_API_TOKEN not set')

    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json',
    }

    # Create prediction
    r = http_requests.post(
        'https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions',
        headers=headers,
        json={
            'input': {
                'prompt': prompt,
                'go_fast': True,
                'num_outputs': 1,
                'aspect_ratio': _aspect_ratio(width, height),
                'output_format': 'png',
            }
        },
        timeout=15,
    )
    r.raise_for_status()
    prediction = r.json()

    # Poll for completion (max 60s)
    poll_url = prediction.get('urls', {}).get('get', f"https://api.replicate.com/v1/predictions/{prediction['id']}")
    for _ in range(30):
        time.sleep(2)
        poll_r = http_requests.get(poll_url, headers=headers, timeout=10)
        poll_r.raise_for_status()
        status = poll_r.json()
        if status['status'] == 'succeeded':
            output_url = status['output'][0]
            img_r = http_requests.get(output_url, timeout=30)
            img_r.raise_for_status()
            return img_r.content, 'replicate', 'flux-schnell'
        if status['status'] == 'failed':
            raise RuntimeError(f"Replicate prediction failed: {status.get('error', 'unknown')}")

    raise RuntimeError('Replicate prediction timed out')


def _aspect_ratio(width, height):
    """Convert dimensions to Replicate aspect ratio string."""
    ratio = width / height
    if abs(ratio - 1.0) < 0.1:
        return '1:1'
    elif ratio > 1.5:
        return '16:9'
    elif ratio > 1.2:
        return '3:2'
    elif ratio < 0.6:
        return '9:16'
    elif ratio < 0.8:
        return '4:5'
    return '1:1'


# ── Image Gen v2 Router (job-type → model) ─────────────────
# Spec: wiki/spec/image_gen_v2.md (approved 2026-05-28).
# Principle: pixels vs text are separated. Text overlay happens client-side
# in the Composer (Fabric.js); this layer only produces the underlying art.
#
# Slugs verified against fal.ai docs 2026-05-29:
#   Seedream v5 Lite → fal-ai/bytedance/seedream/v5/lite/text-to-image
#                      (no seed input — endpoint strips negatives + seed + steps)
#   FLUX.2 [pro]     → fal-ai/flux-2-pro (text-to-image) / .../edit (multi-ref)
#   Nano Banana Pro  → fal-ai/nano-banana-pro (text-to-image) / .../edit (refs)
# Adobe Firefly is NOT on fal yet (partnership runs the other way — fal
# models hosted inside Adobe Express), so safe_commercial is dropped from v2.

JOB_BACKGROUND      = 'background'
JOB_HERO_ART        = 'hero_art'
JOB_AVATAR          = 'avatar'
JOB_EDIT            = 'edit'
JOB_RESTYLE         = 'restyle'
JOB_COMPOSE         = 'compose'          # mixed-role refs, no person
JOB_COMPOSE_PERSON  = 'compose_person'   # any WHO ref present

# job_type → (model_slug, payload_builder). Changing a model = swap the slug
# (and possibly the builder). One-line swap point as required by the spec.
# Avatar uses Nano Banana Pro's /edit endpoint — its explicit "character
# consistency" feature is the strongest fit for our recurring-mascot use.
# Restyle uses FLUX.2's /edit endpoint — verified (bake-off 2026-06-09) to
# recreate an uploaded flyer's *style* with new event text, legible and faithful.
# This is the reference-native route: when a promoter uploads flyers to match,
# the bytedance/flux text-to-image endpoints ignore or under-use them; /edit does not.
_JOB_REGISTRY = {
    JOB_BACKGROUND:     ('fal-ai/bytedance/seedream/v5/lite/text-to-image', '_payload_for_seedream'),
    JOB_HERO_ART:       ('fal-ai/flux-2-pro',                                '_payload_for_flux2'),
    JOB_AVATAR:         ('fal-ai/nano-banana-pro/edit',                      '_payload_for_nano_banana'),
    JOB_EDIT:           ('fal-ai/nano-banana-pro/edit',                      '_payload_for_nano_banana'),
    # Restyle moved FLUX.2-pro/edit → Nano Banana Pro (bake-off 2, 2026-06-11,
    # Doug's verdict): best style fidelity AND perfect baked-in typography on
    # both seeds; FLUX garbled small print on 1 of 2. scratch/forge_bakeoff2/.
    JOB_RESTYLE:        ('fal-ai/nano-banana-pro/edit',                      '_payload_for_nano_banana'),
    # Role-tagged compose routes (context-pipeline spec, 2026-06-11):
    # person present → Nano Banana Pro (strongest character consistency, ≤14 refs).
    # 2026-06-18: mixed refs WITHOUT a person also route to Nano Banana Pro.
    # fal-ai/flux-2-pro/edit was returning 422 Unprocessable Entity for this path,
    # so generate_image_endpoint silently fell back to text-only flux-schnell —
    # which ignores all reference images and garbles baked text. Nano Banana Pro
    # handles multi-ref compose reliably; one proven model for every compose path.
    JOB_COMPOSE_PERSON: ('fal-ai/nano-banana-pro/edit',                      '_payload_for_nano_banana'),
    JOB_COMPOSE:        ('fal-ai/nano-banana-pro/edit',                      '_payload_for_nano_banana'),
}


def _payload_for_flux2(prompt, image_refs, width, height, seed):
    """FLUX.2 [pro] — supports up to 10 reference images via image_urls."""
    p = {
        'prompt': prompt,
        'image_size': {'width': width, 'height': height},
        'num_images': 1,
        'enable_safety_checker': True,
    }
    if seed is not None:
        p['seed'] = int(seed)
    if image_refs:
        p['image_urls'] = list(image_refs)[:10]
    return p


def _payload_for_seedream(prompt, image_refs, width, height, seed):
    """Seedream v5.0 Lite — backdrop / textured-scene workhorse.
    ByteDance stripped seed/negatives/steps from this endpoint — model
    chooses internally — so `seed` and `image_refs` are intentionally ignored
    here. If you need deterministic seedreams, switch to FLUX.2."""
    return {
        'prompt': prompt,
        'image_size': {'width': width, 'height': height},
        'num_images': 1,
    }


def _nearest_aspect_ratio(width, height):
    """Snap pixel dims to nano-banana-pro's aspect_ratio enum."""
    options = {'1:1': 1.0, '4:5': 0.8, '3:4': 0.75, '2:3': 2 / 3, '9:16': 9 / 16,
               '5:4': 1.25, '4:3': 4 / 3, '3:2': 1.5, '16:9': 16 / 9}
    target = width / height
    return min(options, key=lambda k: abs(options[k] - target))


def _payload_for_nano_banana(prompt, image_refs, width, height, seed):
    """Nano Banana Pro — conversational edits + character consistency.

    BUG FIX 2026-06-11: this endpoint does NOT accept image_size — it wants
    aspect_ratio (enum) + resolution. We were silently generating at auto-ratio
    and 1K on every avatar/person call. 2K keeps baked-in typography sharp.
    """
    p = {
        'prompt': prompt,
        'aspect_ratio': _nearest_aspect_ratio(width, height),
        'resolution': '2K',
        'output_format': 'png',
        'num_images': 1,
    }
    if seed is not None:
        p['seed'] = int(seed)
    if image_refs:
        p['image_urls'] = list(image_refs)[:10]
    return p


_PAYLOAD_BUILDERS = {
    '_payload_for_flux2':       _payload_for_flux2,
    '_payload_for_seedream':    _payload_for_seedream,
    '_payload_for_nano_banana': _payload_for_nano_banana,
}


def generate_for_job(job_type, prompt, *, image_refs=None, width=1080, height=1350,
                     seed=None, model_override=None, timeout=180):
    """Image Gen v2 router — picks model by job type.

    Returns (image_bytes, provider, model_slug). Raises on any failure;
    the caller decides whether to retry or fall back.
    """
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')

    if model_override:
        model_slug, builder_name = model_override, '_payload_for_flux2'  # safe default shape
    else:
        entry = _JOB_REGISTRY.get(job_type)
        if not entry:
            raise ValueError(f'unknown job_type: {job_type!r} '
                             f'(expected one of {list(_JOB_REGISTRY)})')
        model_slug, builder_name = entry

    build = _PAYLOAD_BUILDERS[builder_name]
    payload = build(prompt, image_refs, width, height, seed)

    r = http_requests.post(
        f'https://fal.run/{model_slug}',
        headers={
            'Authorization': f'Key {api_key}',
            'Content-Type': 'application/json',
        },
        json=payload,
        timeout=timeout,
    )
    r.raise_for_status()
    data = r.json()
    out_url = data['images'][0]['url']
    img_r = http_requests.get(out_url, timeout=timeout)
    img_r.raise_for_status()
    # Return the BARE model name (consistent with the other generators, which return
    # e.g. 'flux-schnell'). model_slug keeps its 'fal-ai/' prefix for the fal.run URL
    # above; callers prepend `provider` themselves, so stripping it here avoids the
    # doubled 'fal-ai/fal-ai/…' label in the Forge caption + video-composite path.
    bare_model = model_slug[len('fal-ai/'):] if model_slug.startswith('fal-ai/') else model_slug
    return img_r.content, 'fal-ai', bare_model


def job_registry():
    """Read-only view of the job_type → model registry (for diagnostics / UI)."""
    return {k: v[0] for k, v in _JOB_REGISTRY.items()}


# Forge content_type → v2 job_type. Source: wiki/spec/forge_output_recipes.md.
# Principle: the model makes the backdrop/hero only; the Konva compositor lays type on top.
_CONTENT_JOB_TYPE = {
    'social_post':     JOB_BACKGROUND,   # Seedream — cheap scroll-stop backdrop
    'social_carousel': JOB_HERO_ART,     # FLUX.2 seed-locked (Seedream ignores seed → slides drift)
    'event_promo':     JOB_HERO_ART,     # FLUX.2 — atmospheric, ref-anchored
    'event_poster':    JOB_HERO_ART,     # FLUX.2 — full composition, seedable
    'artist_bio':      JOB_HERO_ART,     # FLUX.2 (→ JOB_AVATAR when an avatar is set)
}


def job_type_for(content_type, has_avatar=False, has_style_refs=False, ref_roles=None):
    """Resolve a Forge content_type to a v2 router job_type.

    `ref_roles` (context-pipeline spec): the roles of the references being sent,
    in order. 'spirit' (a drawn cartoon character) → semantic compose on Nano
    Banana. 'who' does NOT route here — carbon-copy law (master spec
    2026-06-12): real people are excluded from generation and composited from
    the photo afterwards (content_api splits them out before calling this).

    `has_style_refs` is the legacy signal (untagged uploads = style) — kept for
    callers that don't pass roles.
    """
    roles = set(ref_roles or [])
    if 'spirit' in roles or 'who' in roles:
        # 'who' here only via legacy callers that didn't split — drawn fallback.
        return JOB_COMPOSE_PERSON
    if roles and roles != {'style'}:
        return JOB_COMPOSE
    if content_type == 'artist_bio' and has_avatar:
        return JOB_AVATAR
    if has_style_refs or roles == {'style'}:
        return JOB_RESTYLE
    if has_avatar:
        # A Spirit on a non-bio type: Seedream (JOB_BACKGROUND) silently drops
        # image_refs, so the spirit's references would be ignored. FLUX.2 accepts
        # them (input-usage audit 2026-06-10).
        return JOB_HERO_ART
    return _CONTENT_JOB_TYPE.get(content_type, JOB_HERO_ART)


# ── Router (legacy — Forge text-to-image fallback chain) ───
# Kept intact for backwards compatibility while Forge migrates to
# generate_for_job(). Once Forge is fully on v2, this can retire.

def generate_image(prompt, width, height):
    """Try Fal AI first, fall back to Replicate. Returns (bytes, provider, model)."""
    errors = []

    # Try Fal AI
    try:
        return _generate_fal(prompt, width, height)
    except Exception as e:
        errors.append(f"Fal AI: {e}")

    # Fallback to Replicate
    try:
        return _generate_replicate(prompt, width, height)
    except Exception as e:
        errors.append(f"Replicate: {e}")

    raise RuntimeError(f"All image providers failed: {'; '.join(errors)}")


# ── Tier 1: FFmpeg composite video ─────────────────────────
# Audio + still image + Ken Burns + waveform overlay → mp4. No AI touches user audio.
# Audio is muxed at 320kbps AAC (sonically transparent). Video is h264 yuv420p.

def probe_audio_duration(audio_path):
    """Return audio duration in seconds via ffprobe. Raises on failure."""
    import subprocess
    r = subprocess.run(
        ['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
         '-of', 'default=noprint_wrappers=1:nokey=1', audio_path],
        capture_output=True, text=True, timeout=10,
    )
    if r.returncode != 0:
        raise RuntimeError(f"ffprobe failed: {r.stderr.strip()}")
    return float(r.stdout.strip())


def _ffmpeg_composite(image_bytes, audio_path, width, height, duration_seconds, fps=30):
    """Run the FFmpeg pipeline. Returns mp4 bytes.

    Pipeline:
      [image] scale + Ken Burns zoompan
      [audio] showwaves overlay (bottom strip, semi-transparent white)
      mux: h264 + aac@320k, yuv420p, -shortest

    Notes:
      - waveform_height = 12% of video height, capped 200px (visual balance)
      - zoompan goes 1.00 → 1.15 over the duration (slow Ken Burns)
      - -shortest stops at the shorter of audio/video tracks
    """
    import subprocess
    import tempfile

    waveform_h = min(200, int(height * 0.12))
    total_frames = int(duration_seconds * fps)

    with tempfile.TemporaryDirectory() as tmp:
        img_path = os.path.join(tmp, 'cover.png')
        out_path = os.path.join(tmp, 'out.mp4')
        with open(img_path, 'wb') as f:
            f.write(image_bytes)

        # zoompan needs an integer 'd' (frames). z grows linearly toward 1.15.
        # showwaves rate must match output fps so frames line up; cline = filled line.
        filter_graph = (
            f"[0:v]scale={width}:{height},"
            f"zoompan=z='min(zoom+{(0.15/total_frames):.6f},1.15)':"
            f"d={total_frames}:s={width}x{height}:fps={fps}[bg];"
            f"[1:a]showwaves=s={width}x{waveform_h}:mode=cline:colors=white@0.7:rate={fps},"
            f"format=yuva420p[wave];"
            f"[bg][wave]overlay=0:H-h:format=auto[v]"
        )

        cmd = [
            'ffmpeg', '-y', '-hide_banner', '-loglevel', 'error',
            '-loop', '1', '-i', img_path,
            '-i', audio_path,
            '-filter_complex', filter_graph,
            '-map', '[v]', '-map', '1:a',
            '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
            '-c:a', 'aac', '-b:a', '320k',
            '-pix_fmt', 'yuv420p',
            '-t', str(duration_seconds),
            '-shortest',
            out_path,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=180)
        if r.returncode != 0:
            raise RuntimeError(f"ffmpeg failed: {r.stderr.strip()[-500:]}")

        with open(out_path, 'rb') as f:
            return f.read()


def generate_video_composite(prompt, audio_path, width, height, duration_seconds=15,
                             base_image_bytes=None):
    """Tier 1: FFmpeg composite video. Returns (mp4_bytes, provider, model, duration_seconds).

    Muxes the user's audio under a still with Ken Burns motion + a waveform that
    pulses to the track. The flagship "make THIS flyer move" flow passes the
    already-generated still as `base_image_bytes`; otherwise a cover is generated
    from `prompt` (legacy path).

    `audio_path` is a local file path (caller fetches the track from Storage and
    writes a temp file first).
    """
    if duration_seconds <= 0 or duration_seconds > 30:
        raise ValueError('duration_seconds must be 0 < d <= 30 (Phase H lifts the cap)')
    if not _ffmpeg_available():
        raise RuntimeError('ffmpeg not on PATH — install via `brew install ffmpeg`')

    if base_image_bytes is not None:
        img_bytes, src = base_image_bytes, 'still'
    else:
        img_bytes, img_provider, img_model = generate_image(prompt, width, height)
        src = f'{img_provider}/{img_model}'
    mp4_bytes = _ffmpeg_composite(img_bytes, audio_path, width, height, duration_seconds)
    return mp4_bytes, 'ffmpeg', f'composite+{src}', duration_seconds


# ── Dry-run fixture ────────────────────────────────────────
# Used when MEDIA_GEN_DRY_RUN=1 to bypass paid providers during dev/CI.

def _dry_run_video(width, height, duration_seconds, label):
    """Return a tiny FFmpeg-generated placeholder mp4. `label` is logged, not drawn
    (drawtext requires freetype-enabled ffmpeg, which isn't guaranteed)."""
    import subprocess, tempfile
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, 'dry.mp4')
        # Solid magenta block — instantly recognisable as a placeholder.
        cmd = [
            'ffmpeg','-y','-hide_banner','-loglevel','error',
            '-f','lavfi','-i', f'color=c=#ff00ff:s={width}x{height}:d={duration_seconds}:r=24',
            '-f','lavfi','-i', f'sine=frequency=220:duration={duration_seconds}',
            '-c:v','libx264','-preset','ultrafast','-crf','28',
            '-c:a','aac','-b:a','128k','-pix_fmt','yuv420p',
            '-shortest', out,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            raise RuntimeError(f"dry-run ffmpeg failed [{label}]: {r.stderr.strip()[-300:]}")
        return open(out, 'rb').read()


# ── Tier 2: Fal text-to-video (LTX primary, Hunyuan fallback) ──
# Calls Fal's queue API. POLL_TIMEOUT_SECONDS bounds total wait.
# DRY_RUN=1 returns a placeholder mp4 — no API spend.

def _aspect_ratio_str(width, height):
    """Map dims to Fal's aspect_ratio enum strings."""
    ratio = width / height
    if abs(ratio - 1.0) < 0.1:
        return '1:1'
    if ratio > 1.5:
        return '16:9'
    if ratio < 0.7:
        return '9:16'
    return '1:1'


def _fal_queue_generate(model_path, payload, poll_timeout):
    """Submit to Fal queue, poll until COMPLETED, return final response JSON.

    Single submission, single poll loop, no retries. `poll_timeout` is the brake;
    set per-model since LTX, Hunyuan, Kling each have different latency profiles.
    """
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')
    headers = {'Authorization': f'Key {api_key}', 'Content-Type': 'application/json'}

    started = time.time()
    submit = http_requests.post(
        f'https://queue.fal.run/{model_path}', headers=headers, json=payload, timeout=30,
    )
    submit.raise_for_status()
    data = submit.json()
    status_url = data.get('status_url') or f"https://queue.fal.run/{model_path}/requests/{data['request_id']}/status"
    response_url = data.get('response_url') or f"https://queue.fal.run/{model_path}/requests/{data['request_id']}"

    deadline = started + poll_timeout
    last_status = None
    while time.time() < deadline:
        time.sleep(3)
        s = http_requests.get(status_url, headers=headers, timeout=10)
        s.raise_for_status()
        sd = s.json()
        status = sd.get('status')
        if POLL_VERBOSE and status != last_status:
            queue_pos = sd.get('queue_position')
            elapsed = int(time.time() - started)
            print(f"[fal poll {model_path} t+{elapsed}s] status={status} queue_pos={queue_pos}", flush=True)
            last_status = status
        if status == 'COMPLETED':
            r = http_requests.get(response_url, headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
        if status in ('FAILED', 'ERROR'):
            raise RuntimeError(f"Fal {model_path} failed: {sd}")
    raise RuntimeError(f"Fal {model_path} poll timed out after {poll_timeout}s (last status: {last_status})")


def _generate_fal_ltx(prompt, width, height, duration_seconds):
    """Fal LTX-Video. Cheap (~$0.05–0.10), fast (~60–180s), lower quality — Tier 2 default."""
    out = _fal_queue_generate('fal-ai/ltx-video', {
        'prompt': prompt,
        'aspect_ratio': _aspect_ratio_str(width, height),
        'num_frames': max(24, min(int(duration_seconds * 24), 240)),
        'resolution': '720p',
    }, poll_timeout=POLL_TIMEOUT_LTX)
    video_url = out['video']['url']
    v = http_requests.get(video_url, timeout=60)
    v.raise_for_status()
    return v.content, 'fal-ai', 'ltx-video'


def _generate_fal_hunyuan(prompt, width, height, duration_seconds):
    """Fal Hunyuan-Video. Slower (~3–5 min), higher quality, ~$0.40–0.50 — Tier 2 fallback."""
    out = _fal_queue_generate('fal-ai/hunyuan-video', {
        'prompt': prompt,
        'aspect_ratio': _aspect_ratio_str(width, height),
        'num_frames': max(24, min(int(duration_seconds * 24), 240)),
        'resolution': '720p',
    }, poll_timeout=POLL_TIMEOUT_HUNYUAN)
    video_url = out['video']['url']
    v = http_requests.get(video_url, timeout=60)
    v.raise_for_status()
    return v.content, 'fal-ai', 'hunyuan-video'


def _mux_audio_onto_video(video_bytes, audio_path, duration_seconds):
    """Stream-copy audio onto AI-generated video. Bit-perfect on audio side.

    Used by Tier 2/3 to attach user audio after the visuals come back. Video
    track is copied (no re-encode); audio is re-encoded only once at 320k AAC.
    """
    import subprocess, tempfile
    with tempfile.TemporaryDirectory() as tmp:
        vin = os.path.join(tmp, 'in.mp4')
        out = os.path.join(tmp, 'out.mp4')
        with open(vin, 'wb') as f:
            f.write(video_bytes)
        cmd = [
            'ffmpeg','-y','-hide_banner','-loglevel','error',
            '-i', vin, '-i', audio_path,
            '-map','0:v:0','-map','1:a:0',
            '-c:v','copy', '-c:a','aac','-b:a','320k',
            '-t', str(duration_seconds), '-shortest', out,
        ]
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if r.returncode != 0:
            raise RuntimeError(f"audio mux failed: {r.stderr.strip()[-400:]}")
        return open(out, 'rb').read()


def generate_video_standard(prompt, audio_path, width, height, duration_seconds=5):
    """Tier 2: Fal text-to-video + user audio mux. Returns (mp4_bytes, provider, model, dur).

    - LTX primary, Hunyuan fallback within Fal.
    - DRY_RUN=1 returns a placeholder mp4 (no API call).
    - audio_path optional (None = no audio track muxed).
    """
    if duration_seconds <= 0 or duration_seconds > MAX_VIDEO_DURATION_SECONDS:
        raise ValueError(f'duration_seconds must be 0 < d <= {MAX_VIDEO_DURATION_SECONDS}')

    if DRY_RUN:
        mp4 = _dry_run_video(width, height, duration_seconds, 'tier2/dryrun')
        return mp4, 'dry-run', 'placeholder', duration_seconds

    # LTX primary, Hunyuan fallback. Each has its own per-model timeout.
    errors = []
    video_bytes = None
    used_provider, used_model = None, None
    for fn, name in [
        (_generate_fal_ltx, 'ltx-video'),
        (_generate_fal_hunyuan, 'hunyuan-video'),
    ]:
        try:
            video_bytes, used_provider, used_model = fn(prompt, width, height, duration_seconds)
            break
        except Exception as e:
            errors.append(f"{name}: {e}")
    if video_bytes is None:
        raise RuntimeError(f"All Tier 2 providers failed: {'; '.join(errors)}")

    if audio_path:
        video_bytes = _mux_audio_onto_video(video_bytes, audio_path, duration_seconds)
    return video_bytes, used_provider, used_model, duration_seconds


# ── Tier 3: Premium video (Fal Kling primary, Replicate Veo fallback) ──
# Most expensive. Hero moments only. DRY_RUN=1 returns placeholder.

def _generate_fal_kling(prompt, width, height, duration_seconds):
    """Fal Kling 1.6. Premium quality, ~$1–2 per 5s clip."""
    out = _fal_queue_generate('fal-ai/kling-video/v1.6/standard/text-to-video', {
        'prompt': prompt,
        'aspect_ratio': _aspect_ratio_str(width, height),
        'duration': str(min(int(duration_seconds), 10)),  # Kling accepts '5' or '10'
    }, poll_timeout=POLL_TIMEOUT_KLING)
    video_url = out['video']['url']
    v = http_requests.get(video_url, timeout=60)
    v.raise_for_status()
    return v.content, 'fal-ai', 'kling-1.6-standard'


def _generate_replicate_veo(prompt, width, height, duration_seconds):
    """Replicate Veo 3 fast. Premium fallback, ~$0.50–1.50."""
    api_token = os.getenv('REPLICATE_API_TOKEN')
    if not api_token:
        raise RuntimeError('REPLICATE_API_TOKEN not set')
    headers = {
        'Authorization': f'Bearer {api_token}',
        'Content-Type': 'application/json',
        'Prefer': 'wait',  # synchronous-ish — Replicate returns when done up to ~60s
    }
    payload = {
        'input': {
            'prompt': prompt,
            'aspect_ratio': _aspect_ratio_str(width, height),
            'duration': min(int(duration_seconds), 8),  # Veo 3 fast caps at 8s
        }
    }
    started = time.time()
    r = http_requests.post(
        'https://api.replicate.com/v1/models/google/veo-3-fast/predictions',
        headers=headers, json=payload, timeout=30,
    )
    r.raise_for_status()
    prediction = r.json()
    poll_url = prediction.get('urls', {}).get('get', f"https://api.replicate.com/v1/predictions/{prediction['id']}")
    last_status = None
    while time.time() - started < POLL_TIMEOUT_VEO:
        if prediction.get('status') in ('succeeded', 'failed', 'canceled'):
            status = prediction['status']
        else:
            time.sleep(3)
            poll_r = http_requests.get(poll_url, headers={'Authorization': f'Bearer {api_token}'}, timeout=10)
            poll_r.raise_for_status()
            prediction = poll_r.json()
            status = prediction.get('status')
        if POLL_VERBOSE and status != last_status:
            elapsed = int(time.time() - started)
            print(f"[replicate poll veo-3-fast t+{elapsed}s] status={status}", flush=True)
            last_status = status
        if status == 'succeeded':
            output = prediction['output']
            video_url = output if isinstance(output, str) else output[0]
            vr = http_requests.get(video_url, timeout=60)
            vr.raise_for_status()
            return vr.content, 'replicate', 'veo-3-fast'
        if status in ('failed', 'canceled'):
            raise RuntimeError(f"Replicate Veo failed: {prediction.get('error', status)}")
    raise RuntimeError(f"Replicate Veo poll timed out after {POLL_TIMEOUT_VEO}s (last status: {last_status})")


def generate_video_premium(prompt, audio_path, width, height, duration_seconds=5):
    """Tier 3: Premium video. Returns (mp4_bytes, provider, model, dur).

    - Fal Kling primary, Replicate Veo fallback.
    - DRY_RUN=1 returns a placeholder mp4 (no API call).
    - audio_path optional (None = no audio track muxed).
    """
    if duration_seconds <= 0 or duration_seconds > MAX_VIDEO_DURATION_SECONDS:
        raise ValueError(f'duration_seconds must be 0 < d <= {MAX_VIDEO_DURATION_SECONDS}')

    if DRY_RUN:
        mp4 = _dry_run_video(width, height, duration_seconds, 'tier3/dryrun')
        return mp4, 'dry-run', 'placeholder', duration_seconds

    errors = []
    video_bytes = None
    used_provider, used_model = None, None
    for fn, name in [
        (_generate_fal_kling, 'fal-kling'),
        (_generate_replicate_veo, 'replicate-veo'),
    ]:
        try:
            video_bytes, used_provider, used_model = fn(prompt, width, height, duration_seconds)
            break
        except Exception as e:
            errors.append(f"{name}: {e}")
    if video_bytes is None:
        raise RuntimeError(f"All Tier 3 providers failed: {'; '.join(errors)}")

    if audio_path:
        video_bytes = _mux_audio_onto_video(video_bytes, audio_path, duration_seconds)
    return video_bytes, used_provider, used_model, duration_seconds


# ── Audio storage ──────────────────────────────────────────

def upload_audio_track(file_bytes, filename, user_id=None, mime_type='audio/mpeg',
                       rights=None):
    """Upload an audio file to Supabase Storage + insert audio_tracks row.

    Returns dict: {id, bucket_path, local_path, duration_seconds, bytes}.
    `local_path` is always populated (a tempfile cached for the FFmpeg run);
    callers should clean it up when done.

    `rights` (optional dict) carries the Beat rights gate (see
    wiki/features/firepit_beat.md): {category, proof_url, license_notes,
    source_artist_profile_id, attested_by}. Stored on the audio_tracks row; the
    scheduling gate reads it back. Caller validates the category — this just
    persists what it's given.

    If LOCAL_IMAGE_FALLBACK=1, skips the Supabase upload and DB insert — returns
    the local-only shape so offline dev / smoke tests don't need cloud access.
    """
    import tempfile
    user_id = user_id or DEV_USER_ID
    ts = int(time.time())
    safe_name = filename.replace('/', '_').replace('\\', '_')
    object_filename = f"{ts}_{uuid.uuid4().hex[:8]}_{safe_name}"
    bucket_path = f"{user_id}/{object_filename}"

    # Write to a temp file so callers can hand the path to ffmpeg/ffprobe.
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(safe_name)[1] or '.mp3')
    tmp.write(file_bytes)
    tmp.close()
    local_path = tmp.name
    duration = probe_audio_duration(local_path)

    if os.getenv('LOCAL_IMAGE_FALLBACK') == '1':
        return {
            'id': None,
            'bucket_path': None,
            'local_path': local_path,
            'duration_seconds': duration,
            'bytes': len(file_bytes),
        }

    sb = _get_supabase()
    sb.storage.from_(AUDIO_BUCKET).upload(
        path=bucket_path,
        file=file_bytes,
        file_options={'content-type': mime_type, 'upsert': 'true'},
    )
    track_row = {
        'user_id': user_id,
        'filename': safe_name,
        'bucket_path': bucket_path,
        'mime_type': mime_type,
        'duration_seconds': duration,
        'bytes': len(file_bytes),
    }
    if rights and rights.get('category'):
        track_row.update({
            'rights_category': rights.get('category'),
            'rights_proof_url': rights.get('proof_url'),
            'license_notes': rights.get('license_notes'),
            'source_artist_profile_id': rights.get('source_artist_profile_id'),
            'rights_attested_by': rights.get('attested_by'),
            'rights_attested_at': datetime.now(timezone.utc).isoformat(),
        })
    row = sb.table('audio_tracks').insert(track_row).execute()
    track_id = row.data[0]['id'] if row.data else None
    return {
        'id': track_id,
        'bucket_path': bucket_path,
        'local_path': local_path,
        'duration_seconds': duration,
        'bytes': len(file_bytes),
    }


# ── Storage ────────────────────────────────────────────────

def _to_jpeg(image_bytes, quality=92):
    """Convert any image bytes (PNG/WEBP/etc) to JPEG bytes.
    Instagram's Graph API only accepts JPEG."""
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ('RGBA', 'LA', 'P'):
        bg = Image.new('RGB', img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[-1] if img.mode == 'RGBA' else None)
        img = bg
    elif img.mode != 'RGB':
        img = img.convert('RGB')
    out = io.BytesIO()
    img.save(out, format='JPEG', quality=quality, optimize=True)
    return out.getvalue()


def save_image(image_bytes, content_type, user_id=None):
    """Upload image to Supabase Storage as JPEG. Returns public URL.

    Always converts to JPEG — Instagram Graph API rejects PNG/WEBP.
    If LOCAL_IMAGE_FALLBACK=1, also writes to data/generated_images/ for offline dev.
    """
    image_bytes = _to_jpeg(image_bytes)
    user_id = user_id or DEV_USER_ID
    ts = int(time.time())
    short_hash = hashlib.md5(image_bytes[:1024]).hexdigest()[:8]
    filename = f"{content_type}_{ts}_{short_hash}_{uuid.uuid4().hex[:6]}.jpg"
    object_path = f"{user_id}/{filename}"

    sb = _get_supabase()
    sb.storage.from_(IMAGE_BUCKET).upload(
        path=object_path,
        file=image_bytes,
        file_options={'content-type': 'image/jpeg', 'upsert': 'true'},
    )
    public_url = sb.storage.from_(IMAGE_BUCKET).get_public_url(object_path)

    if os.getenv('LOCAL_IMAGE_FALLBACK') == '1':
        img_dir = os.path.join(os.path.dirname(__file__), 'data', 'generated_images')
        os.makedirs(img_dir, exist_ok=True)
        with open(os.path.join(img_dir, filename), 'wb') as f:
            f.write(image_bytes)

    return public_url


def save_video(video_bytes, content_type, user_id=None, ext='mp4'):
    """Upload video to Supabase Storage. Returns public URL.

    If LOCAL_IMAGE_FALLBACK=1, also writes to data/generated_videos/ for offline dev.
    Same fallback flag as images — keeps offline dev one-switch.
    """
    user_id = user_id or DEV_USER_ID
    ts = int(time.time())
    short_hash = hashlib.md5(video_bytes[:1024]).hexdigest()[:8]
    filename = f"{content_type}_{ts}_{short_hash}_{uuid.uuid4().hex[:6]}.{ext}"
    object_path = f"{user_id}/{filename}"

    content_type_header = 'video/mp4' if ext == 'mp4' else f'video/{ext}'
    sb = _get_supabase()
    sb.storage.from_(VIDEO_BUCKET).upload(
        path=object_path,
        file=video_bytes,
        file_options={'content-type': content_type_header, 'upsert': 'true'},
    )
    public_url = sb.storage.from_(VIDEO_BUCKET).get_public_url(object_path)

    if os.getenv('LOCAL_IMAGE_FALLBACK') == '1':
        vid_dir = os.path.join(os.path.dirname(__file__), 'data', 'generated_videos')
        os.makedirs(vid_dir, exist_ok=True)
        with open(os.path.join(vid_dir, filename), 'wb') as f:
            f.write(video_bytes)

    return public_url


def provider_status():
    """Check which providers have API keys configured.

    Nested by media type so the frontend can show per-tier health.
    Phase 1 only reports image providers; video tiers fill in as Phases 2–4 land.
    """
    fal = bool(os.getenv('FAL_KEY'))
    replicate = bool(os.getenv('REPLICATE_API_TOKEN'))
    return {
        # Flat keys for backward compat with the existing /api/health consumer.
        'fal_ai': fal,
        'replicate': replicate,
        # Nested view — preferred shape going forward.
        'image': {'fal': fal, 'replicate': replicate},
        'video_composite': {'ffmpeg': _ffmpeg_available()},
        'video_standard': {'fal_ltx': fal, 'fal_hunyuan': fal},
        'video_premium': {'fal_kling': fal, 'replicate_veo': replicate},
        'dry_run': DRY_RUN,
    }


def _ffmpeg_available():
    """Best-effort check that ffmpeg binary is on PATH. Cheap, ~5ms."""
    import shutil
    return shutil.which('ffmpeg') is not None
