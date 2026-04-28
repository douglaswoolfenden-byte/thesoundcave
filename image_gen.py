"""
The Sound Cave — Image Generation Module
Generates images for content using Fal AI (primary) and Replicate (fallback).
Claude builds optimised image prompts from content context.
"""
import os
import time
import hashlib
import requests as http_requests
from dotenv import load_dotenv
import anthropic

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# ── Per-content-type image dimensions ──────────────────────
IMAGE_DIMENSIONS = {
    'ig_reel':      (1080, 1920),   # 9:16 vertical
    'ig_carousel':  (1080, 1080),   # 1:1 square
    'tiktok':       (1080, 1920),   # 9:16 vertical
    'x_post':       (1200, 675),    # 16:9 landscape
    'yt_short':     (1080, 1920),   # 9:16 vertical
    'lineup_copy':  (1080, 1080),   # 1:1 square (poster)
    'aftermovie':   (1280, 720),    # 16:9 landscape
    'teaser':       (1080, 1350),   # 4:5 portrait (IG feed)
    'pre_release':  (1080, 1080),   # 1:1 square
    'premiere':     (1200, 675),    # 16:9 landscape
    'dj_support':   (1080, 1080),   # 1:1 square
    'artist_bio':   (1200, 675),    # 16:9 landscape
    'press':        (1200, 675),    # 16:9 landscape
    'newsletter':   (1200, 675),    # 16:9 landscape
    'mix_desc':     (1080, 1080),   # 1:1 square
    'playlist_desc':(1080, 1080),   # 1:1 square
}

# ── Style hints per content type ───────────────────────────
STYLE_HINTS = {
    'ig_reel':      'Vertical composition, bold and eye-catching, social media aesthetic, high contrast.',
    'ig_carousel':  'Square format, clean and graphic, modern editorial feel.',
    'tiktok':       'Vertical, vibrant, energetic, youth culture aesthetic, bold typography-friendly.',
    'x_post':       'Wide landscape, minimal, moody, editorial photography style.',
    'yt_short':     'Vertical, cinematic, dramatic lighting, thumbnail-worthy.',
    'lineup_copy':  'Square poster design, dark background, neon or metallic accents, event flyer aesthetic.',
    'aftermovie':   'Wide cinematic, strobe lights, crowd silhouettes, atmospheric haze, motion blur.',
    'teaser':       'Portrait, mysterious, dark and moody, minimal elements, fog or smoke.',
    'pre_release':  'Square, abstract or textural, vinyl/waveform motifs, anticipation mood.',
    'premiere':     'Wide, professional, clean with subtle music elements, press-ready.',
    'dj_support':   'Square, decks/mixer close-up, warm club lighting, authentic feel.',
    'artist_bio':   'Wide portrait orientation, dramatic lighting, artist-spotlight feel.',
    'press':        'Wide, professional press kit aesthetic, clean and modern.',
    'newsletter':   'Wide header image, warm editorial style, curated feel.',
    'mix_desc':     'Square, abstract soundwave visuals, deep colours, immersive.',
    'playlist_desc':'Square, mood-driven, colour palette matching the playlist vibe.',
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
    """Use Claude to generate an optimised image prompt from content context."""
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

    release = ctx.get('release')
    if release:
        parts.append(f"Release: {release}")

    freeform = ctx.get('freeform')
    if freeform:
        parts.append(f"Context: {freeform}")

    if generated_text:
        preview = generated_text[:300]
        parts.append(f"Generated copy (for mood reference): {preview}")

    user_msg = '\n'.join(parts)

    message = client.messages.create(
        model='claude-haiku-4-5-20251001',
        max_tokens=300,
        system=IMAGE_PROMPT_SYSTEM,
        messages=[{'role': 'user', 'content': user_msg}]
    )
    return message.content[0].text.strip()


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


# ── Router ─────────────────────────────────────────────────

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


# ── Storage ────────────────────────────────────────────────

def save_image(image_bytes, content_type):
    """Save image to data/generated_images/. Returns filename."""
    img_dir = os.path.join(os.path.dirname(__file__), 'data', 'generated_images')
    os.makedirs(img_dir, exist_ok=True)

    ts = int(time.time())
    short_hash = hashlib.md5(image_bytes[:1024]).hexdigest()[:8]
    filename = f"{content_type}_{ts}_{short_hash}.png"

    filepath = os.path.join(img_dir, filename)
    with open(filepath, 'wb') as f:
        f.write(image_bytes)

    return filename


def provider_status():
    """Check which providers have API keys configured."""
    return {
        'fal_ai': bool(os.getenv('FAL_KEY')),
        'replicate': bool(os.getenv('REPLICATE_API_TOKEN')),
    }
