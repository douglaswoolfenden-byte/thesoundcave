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
import os
import time
import hashlib
import uuid
from enum import Enum
import requests as http_requests
from dotenv import load_dotenv
import anthropic


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
POLL_TIMEOUT_SECONDS = 120             # kills runaway provider polls

# DRY_RUN short-circuits all paid video providers (Fal LTX/Hunyuan/Kling, Replicate Veo).
# Returns a tiny FFmpeg-generated placeholder mp4 instead of calling the API.
# Image generation (Flux schnell, ~$0.003) is NOT dry-runned — too cheap to bother.
DRY_RUN = os.getenv('MEDIA_GEN_DRY_RUN') == '1'

# Estimated USD per call — surfaced in API responses for cost transparency.
# Tune from real invoices; these are upper-bound public list prices as of 2026-04.
COST_USD = {
    'video_composite': 0.003,   # only the cover image (Flux schnell)
    'video_standard':  0.10,    # Fal LTX 5s @ 720p
    'video_premium':   2.00,    # Fal Kling 5s
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


def generate_video_composite(prompt, audio_path, width, height, duration_seconds=15):
    """Tier 1: FFmpeg composite video. Returns (mp4_bytes, provider, model, duration_seconds).

    Generates a cover image via the existing image router, then muxes the user's
    audio underneath with Ken Burns motion and a waveform overlay.

    `audio_path` is a local file path (caller is responsible for fetching the
    track from Supabase Storage and writing to a temp file before calling).
    """
    if duration_seconds <= 0 or duration_seconds > 30:
        raise ValueError('duration_seconds must be 0 < d <= 30 (Phase H lifts the cap)')
    if not _ffmpeg_available():
        raise RuntimeError('ffmpeg not on PATH — install via `brew install ffmpeg`')

    img_bytes, img_provider, img_model = generate_image(prompt, width, height)
    mp4_bytes = _ffmpeg_composite(img_bytes, audio_path, width, height, duration_seconds)
    return mp4_bytes, 'ffmpeg', f'composite+{img_provider}/{img_model}', duration_seconds


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


def _fal_queue_generate(model_path, payload):
    """Submit to Fal queue, poll until COMPLETED, return final response JSON.

    Single submission, single poll loop, no retries. POLL_TIMEOUT_SECONDS is the brake.
    """
    api_key = os.getenv('FAL_KEY')
    if not api_key:
        raise RuntimeError('FAL_KEY not set')
    headers = {'Authorization': f'Key {api_key}', 'Content-Type': 'application/json'}

    submit = http_requests.post(
        f'https://queue.fal.run/{model_path}', headers=headers, json=payload, timeout=30,
    )
    submit.raise_for_status()
    data = submit.json()
    status_url = data.get('status_url') or f"https://queue.fal.run/{model_path}/requests/{data['request_id']}/status"
    response_url = data.get('response_url') or f"https://queue.fal.run/{model_path}/requests/{data['request_id']}"

    deadline = time.time() + POLL_TIMEOUT_SECONDS
    while time.time() < deadline:
        time.sleep(3)
        s = http_requests.get(status_url, headers=headers, timeout=10)
        s.raise_for_status()
        sd = s.json()
        status = sd.get('status')
        if status == 'COMPLETED':
            r = http_requests.get(response_url, headers=headers, timeout=30)
            r.raise_for_status()
            return r.json()
        if status in ('FAILED', 'ERROR'):
            raise RuntimeError(f"Fal {model_path} failed: {sd}")
    raise RuntimeError(f"Fal {model_path} poll timed out after {POLL_TIMEOUT_SECONDS}s")


def _generate_fal_ltx(prompt, width, height, duration_seconds):
    """Fal LTX-Video. Cheap, fast, lower quality — Tier 2 default."""
    out = _fal_queue_generate('fal-ai/ltx-video', {
        'prompt': prompt,
        'aspect_ratio': _aspect_ratio_str(width, height),
        'num_frames': max(24, min(int(duration_seconds * 24), 240)),
        'resolution': '720p',
    })
    video_url = out['video']['url']
    v = http_requests.get(video_url, timeout=60)
    v.raise_for_status()
    return v.content, 'fal-ai', 'ltx-video'


def _generate_fal_hunyuan(prompt, width, height, duration_seconds):
    """Fal Hunyuan-Video. Slower, higher quality — Tier 2 fallback."""
    out = _fal_queue_generate('fal-ai/hunyuan-video', {
        'prompt': prompt,
        'aspect_ratio': _aspect_ratio_str(width, height),
        'num_frames': max(24, min(int(duration_seconds * 24), 240)),
        'resolution': '720p',
    })
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

    errors = []
    video_bytes = None
    used_provider, used_model = None, None
    for fn, name, model in [
        (_generate_fal_ltx, 'fal-ai', 'ltx-video'),
        (_generate_fal_hunyuan, 'fal-ai', 'hunyuan-video'),
    ]:
        try:
            video_bytes, used_provider, used_model = fn(prompt, width, height, duration_seconds)
            break
        except Exception as e:
            errors.append(f"{model}: {e}")
    if video_bytes is None:
        raise RuntimeError(f"All Tier 2 providers failed: {'; '.join(errors)}")

    if audio_path:
        video_bytes = _mux_audio_onto_video(video_bytes, audio_path, duration_seconds)
    return video_bytes, used_provider, used_model, duration_seconds


# ── Audio storage ──────────────────────────────────────────

def upload_audio_track(file_bytes, filename, user_id=None, mime_type='audio/mpeg'):
    """Upload an audio file to Supabase Storage + insert audio_tracks row.

    Returns dict: {id, bucket_path, local_path, duration_seconds, bytes}.
    `local_path` is always populated (a tempfile cached for the FFmpeg run);
    callers should clean it up when done.

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
    row = sb.table('audio_tracks').insert({
        'user_id': user_id,
        'filename': safe_name,
        'bucket_path': bucket_path,
        'mime_type': mime_type,
        'duration_seconds': duration,
        'bytes': len(file_bytes),
    }).execute()
    track_id = row.data[0]['id'] if row.data else None
    return {
        'id': track_id,
        'bucket_path': bucket_path,
        'local_path': local_path,
        'duration_seconds': duration,
        'bytes': len(file_bytes),
    }


# ── Storage ────────────────────────────────────────────────

def save_image(image_bytes, content_type, user_id=None):
    """Upload image to Supabase Storage. Returns public URL.

    If LOCAL_IMAGE_FALLBACK=1, also writes to data/generated_images/ for offline dev.
    """
    user_id = user_id or DEV_USER_ID
    ts = int(time.time())
    short_hash = hashlib.md5(image_bytes[:1024]).hexdigest()[:8]
    filename = f"{content_type}_{ts}_{short_hash}_{uuid.uuid4().hex[:6]}.png"
    object_path = f"{user_id}/{filename}"

    sb = _get_supabase()
    sb.storage.from_(IMAGE_BUCKET).upload(
        path=object_path,
        file=image_bytes,
        file_options={'content-type': 'image/png', 'upsert': 'true'},
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
