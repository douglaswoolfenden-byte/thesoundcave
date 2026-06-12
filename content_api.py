"""
The Sound Cave — Content Generation API
Lightweight Flask server that calls Claude API to generate music industry content.
Run: python content_api.py
"""
import os
import re
import json
import time
from datetime import datetime, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
import anthropic
import requests as http_requests
from media_gen import (
    build_image_prompt, build_restyle_prompt, build_compose_prompt,
    generate_image, generate_for_job, job_type_for,
    save_image, save_video,
    IMAGE_DIMENSIONS, provider_status,
    generate_video_composite, generate_video_standard, generate_video_premium,
    upload_audio_track,
    MediaType, COST_USD, MAX_AUDIO_FILE_BYTES, MAX_VIDEO_DURATION_SECONDS,
)

# Load .env from workspace root (one level up from project)
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

app = Flask(__name__)
CORS(app)

# Phase 2/3 module split (2026-05-13). Routes register here as they land.
from events_api import events_bp
from artist_profiles_api import artist_profiles_bp
from campaigns_api import campaigns_bp
from brand_kits_api import brand_kits_bp
from avatars_api import avatars_bp, generate_bp, _owned_avatar
from roster_api import roster_bp
app.register_blueprint(events_bp)
app.register_blueprint(artist_profiles_bp)
app.register_blueprint(campaigns_bp)
app.register_blueprint(brand_kits_bp)
app.register_blueprint(avatars_bp)
app.register_blueprint(generate_bp)
app.register_blueprint(roster_bp)

client = anthropic.Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))

# ── Content type templates ──────────────────────────────────
# Channel-aware captions are baked into the social types. artist_bio is editorial
# long-form. Active channels: Meta (IG+FB), TikTok, Reddit.
# 5 types per wiki/spec/forge_output_recipes.md (Approved 2026-06-09).
TEMPLATES = {
    'social_post': {
        'instruction': (
            'Write a single Instagram/Facebook/TikTok post. The first sentence must contain one specific concrete image — '
            'a piece of kit, a room, a time, a sound, a surface, a person doing something — that earns the second sentence. '
            'No generic openers. Then 2-4 short lines (line breaks for readability). End with 2-3 scene-literate hashtags '
            '(specific scene/genre/venue/event tags — not generic ones). For Reddit: drop hashtags, stay conversational.'
        ),
        'max_tokens': 400,
    },
    'social_carousel': {
        'instruction': (
            'Write a carousel: opening hook caption, then 4-6 slides separated by "---" (slide 1 first). '
            'Each slide does ONE job: one fact, one observation, one quote. No filler slides, no "swipe to find out". '
            'Closing slide is a single concrete CTA (date+venue / link / specific action). 2-3 hashtags after the final slide. '
            'For Reddit, drop hashtags and number the slides as a text post.'
        ),
        'max_tokens': 800,
    },
    'event_promo': {
        'instruction': (
            'Write event promotion copy. MUST include venue + date if given. MUST include one specific sensory detail about '
            'the night (the soundsystem, the BPM range, the room layout, the temperature, what the floor looks like at 3am). '
            'Banned openers: "Join us", "Get ready for", "We are excited to announce", "Don\'t miss". 3-5 short lines. '
            '2-3 specific hashtags. Suits Meta + TikTok; for Reddit drop hashtags and stay conversational.'
        ),
        'max_tokens': 400,
    },
    'event_poster': {
        'instruction': (
            'Write very short copy paired with an event poster. Maximum 6 lines: '
            '(1) one-line headline (no clichés), (2) lineup as a flowing list with em-dashes, (3) date + venue + door times, '
            '(4) one descriptive line about the night, (5) ticket line if known. End with a single line prefixed "POSTER:" '
            'describing the visual treatment in one sentence.'
        ),
        'max_tokens': 500,
    },
    'artist_bio': {
        'instruction': (
            'Write an artist bio. Third person, 2-3 paragraphs. Paragraph 1: where they come from and what they sound like — '
            'name reference points (other artists, scenes, labels) rather than abstract adjectives. Paragraph 2: a specific '
            'recent achievement, release, or moment. Paragraph 3: one line about where they\'re heading. Suitable for press kit.'
        ),
        'max_tokens': 600,
    },
}

VARIATION_PROMPTS = {
    'shorter': 'Cut this to roughly half the length. Keep the strongest concrete image; drop the rest. Keep the voice.',
    'longer': 'Expand with one more concrete sensory detail and one more line of context. Do not add hashtags. Do not pad.',
    'tone': 'Rewrite with a different register. If hype, go understated. If formal, go conversational. Keep the same facts and the same concrete images.',
}

ENHANCE_PROMPT = (
    'Refine this draft. Keep the message, the voice, and any specific references the user wrote. '
    'Sharpen weak verbs, drop filler ("really", "very", "amazing"), and if you can name one more specific thing without inventing, do. '
    'Do not add hashtags that weren\'t already there. Do not change the length by more than 20%.'
)

SYSTEM_PROMPT = """You are a copywriter embedded in European underground electronic music — clubs, labels, events, artist PR. You write for the audience that already knows the scene.

WHAT TO DO:
- Lead with a concrete image. Name a piece of kit, a room, a sound, a surface, a time. "Strobes claw the ceiling" not "atmospheric strobes".
- Use specific references the user provides. If they wrote artist names, venues, BPMs, dates — use them by name, not paraphrased.
- If reference images are attached, name what's in them in the writing where it fits naturally.
- British English: realise, colour, grey, practise. No US idioms.
- Verbs over adjectives. Specifics over abstractions.

WHAT NOT TO DO:
- Banned openers: "Join us…", "Get ready for…", "Don't miss…", "We are excited to announce…", "Are you ready to…".
- Banned filler: "absolute fire", "unmissable", "must-attend", "vibes" (standalone), "energy" (standalone), "iconic", "legendary" (unless literally true), "the way I…", "tell me you're…", "if you know, you know", "no thoughts just…".
- No 🔥 stacks. No emoji decoration of headlines. One purposeful emoji per piece if at all.
- No hashtag spam. 2-3 specific, scene-literate hashtags — never 7 generic ones. Reddit = zero.
- No invented facts. If you don't know a date, a name, a venue — don't make one up.

REGISTER:
You're writing for someone who reads Resident Advisor, knows what a B2B is, has been to a 12-hour party, owns vinyl. Don't explain culture to them. Don't perform it back at them either."""


# ── Voice presets ───────────────────────────────────────────
# Appended to SYSTEM_PROMPT per request to shape register without
# rewriting the base voice. Default = 'underground' (no addendum).
VOICE_PROMPTS = {
    'underground': '',
    'industry': (
        'Voice override — INDUSTRY: measured, professional, suitable for press releases, '
        'artist bios, and B2B communication with labels, promoters, agents, and journalists. '
        'Drop slang. Keep the cultural literacy but treat the reader as a peer in the industry, '
        'not a club-goer.'
    ),
    'hype': (
        'Voice override — HYPE: high-energy, urgent, exclamation-friendly. '
        'Capslock OK in moderation. This is club-night promo voice — make people feel they '
        'have to be there. Stay credible: no generic influencer phrases, no "absolute fire 🔥🔥🔥".'
    ),
    'personal': (
        'Voice override — PERSONAL: first-person singular, conversational, like the artist '
        'or promoter posting from their own account. Drop the industry-observer perspective. '
        'Talk like a friend, not a brand.'
    ),
}


def _system_prompt_for(voice):
    """SYSTEM_PROMPT augmented by the chosen voice preset."""
    addendum = VOICE_PROMPTS.get(voice, '')
    if not addendum:
        return SYSTEM_PROMPT
    return SYSTEM_PROMPT + '\n\n' + addendum


# ── Reference image handling ────────────────────────────────
REF_IMAGES_MAX_COUNT = 5
REF_IMAGES_MAX_BYTES = 5 * 1024 * 1024  # 5MB per image (base64-decoded size)

# Role-tagged references (wiki/spec/forge_context_pipeline.md, 2026-06-11):
# each upload carries WHO/WHERE/WHAT/STYLE so the compose prompt can name its job.
REF_ROLES = ('who', 'where', 'what', 'style')


def _normalize_reference_images(raw):
    """Accept both legacy reference_images (list of data-URL strings) and the
    role-tagged shape ([{data, role, note}, ...]). Returns a list of dicts with
    keys data/role/note. Unknown roles fall back to 'style' — the legacy
    meaning of an untagged upload. Data validation stays in _ref_images_to_blocks.
    """
    if not raw or not isinstance(raw, list):
        return []
    out = []
    for item in raw:
        if isinstance(item, str):
            out.append({'data': item, 'role': 'style', 'note': ''})
        elif isinstance(item, dict):
            role = item.get('role')
            out.append({
                'data': item.get('data') or item.get('url') or '',
                'role': role if role in REF_ROLES else 'style',
                'note': str(item.get('note') or '')[:120],
            })
    return out


def _ref_images_to_blocks(reference_images):
    """Convert frontend reference images to Anthropic image content blocks.
    Accepts legacy strings or role-tagged dicts (normalized here).

    Returns (blocks, error_message). Blocks empty if no refs or on validation
    failure. Validates count/size at the boundary, per CLAUDE.md guidance.
    """
    if not reference_images:
        return [], None
    if not isinstance(reference_images, list):
        return [], 'reference_images must be a list'
    reference_images = [r['data'] for r in _normalize_reference_images(reference_images)]
    if len(reference_images) > REF_IMAGES_MAX_COUNT:
        return [], f'Max {REF_IMAGES_MAX_COUNT} reference images'

    blocks = []
    for i, data_url in enumerate(reference_images):
        if not isinstance(data_url, str) or not data_url.startswith('data:image/'):
            return [], f'reference_images[{i}] is not a data:image/... URL'
        try:
            header, b64 = data_url.split(',', 1)
            media_type = header.split(';')[0].removeprefix('data:')
        except (ValueError, AttributeError):
            return [], f'reference_images[{i}] malformed'
        if media_type not in ('image/jpeg', 'image/png', 'image/webp', 'image/gif'):
            return [], f'reference_images[{i}] unsupported type: {media_type}'
        # Rough size check on base64 length (decoded ≈ 0.75x).
        if len(b64) * 0.75 > REF_IMAGES_MAX_BYTES:
            return [], f'reference_images[{i}] exceeds 5MB'
        blocks.append({
            'type': 'image',
            'source': {'type': 'base64', 'media_type': media_type, 'data': b64},
        })
    return blocks, None


def build_user_prompt(ctx):
    """Build the user prompt from the request context."""
    content_type = ctx.get('content_type', 'social_post')
    template = TEMPLATES.get(content_type, TEMPLATES['social_post'])

    parts = [template['instruction']]

    # Artist context
    artist_data = ctx.get('artist_data')
    if artist_data:
        name = artist_data.get('name', 'Unknown')
        genre = artist_data.get('genre', '')
        followers = artist_data.get('followers')
        parts.append(f"\nArtist: {name}")
        if genre:
            parts.append(f"Genre: {genre}")
        if followers:
            parts.append(f"Followers: {followers:,}")

    artist_list = ctx.get('artist_list')
    if artist_list:
        parts.append(f"\nLineup:\n{artist_list}")

    event = ctx.get('event')
    if event:
        parts.append(f"\nEvent: {event}")

    # Structured event facts (Forge event_details fields) — so the copy references
    # the real venue/date/doors, matching what the compositor overlay shows.
    detail_labels = [('venue', 'Venue'), ('city', 'Location'), ('date', 'Date'),
                     ('doors', 'Doors'), ('curfew', 'Curfew'), ('tickets', 'Tickets')]
    for key, label in detail_labels:
        val = ctx.get(key)
        if val:
            parts.append(f"{label}: {val}")

    release = ctx.get('release')
    if release:
        parts.append(f"\nRelease: {release}")

    freeform = ctx.get('freeform')
    if freeform:
        parts.append(f"\nAdditional context: {freeform}")

    # Handle variations
    variation = ctx.get('variation')
    if variation and variation in VARIATION_PROMPTS:
        existing = ctx.get('existing_content', '')
        if existing:
            parts.append(f"\n\nHere is the existing content to modify:\n\"\"\"\n{existing}\n\"\"\"\n\n{VARIATION_PROMPTS[variation]}")

    return '\n'.join(parts)


@app.route('/api/health', methods=['GET'])
def health():
    has_key = bool(os.getenv('ANTHROPIC_API_KEY'))
    media = provider_status()
    return jsonify({
        'status': 'ok',
        'has_api_key': has_key,
        'media_providers': media,        # nested per-tier (preferred)
        'image_providers': media,        # legacy alias for the existing frontend consumer
    })


# ── Credits pricing (placeholder; tune later) ─────────────
# Video costs scale with provider price — see COST_USD in media_gen.py.
CREDIT_COST = {
    'text': 1,
    'image': 5,
    'video_composite': 10,
    'video_standard': 20,
    'video_premium': 100,
}

def _debit(uid, kind, reason):
    """Atomic debit via SQL helper. Returns (new_balance, error_response_or_None)."""
    cost = CREDIT_COST[kind]
    sb = _stash_client()
    try:
        res = sb.rpc('debit_credits', {
            'p_user_id': uid, 'p_amount': cost, 'p_reason': reason
        }).execute()
        return res.data, None
    except Exception as e:
        msg = str(e)
        if 'insufficient_credits' in msg:
            return None, (jsonify({'error': 'insufficient_credits', 'cost': cost}), 402)
        print('debit failed:', e)
        return None, (jsonify({'error': f'credit debit failed: {msg}'}), 500)

def _refund(uid, kind, reason):
    cost = CREDIT_COST[kind]
    try:
        _stash_client().rpc('refund_credits', {
            'p_user_id': uid, 'p_amount': cost, 'p_reason': reason
        }).execute()
    except Exception as e:
        # Refund failure is logged but doesn't surface to the user — they
        # already saw the gen error. A reconciliation job (later) can sweep.
        print('refund failed (will need reconciliation):', e)


# Content types that support 3-variant generation. Long-form types stay single-shot.
VARIANT_ENABLED_TYPES = {'social_post', 'social_carousel', 'event_promo', 'event_poster'}

# Default angle labels per content type — Claude is asked to return variants with exactly these labels.
VARIANT_ANGLES = {
    'social_post':     ['PUNCHY', 'ATMOSPHERIC', 'PERSONAL'],
    'social_carousel': ['NARRATIVE', 'LISTICLE', 'NAMECHECK'],
    'event_promo':     ['SCENE-SETTER', 'NAMECHECK', 'DARE'],
    'event_poster':    ['SET-TIMES', 'THEME', 'NAMECHECK'],
}


def _variant_prompt_suffix(angles):
    """Instruction appended when n_variants is requested. Forces strict JSON output."""
    labels = ', '.join(f'"{a}"' for a in angles)
    return (
        f'\n\n---\n'
        f'Produce THREE distinct variants from THREE different angles. Each angle takes the same brief in a different direction — '
        f'do not write three near-copies. Angle labels (use EXACTLY): {labels}.\n\n'
        f'Return STRICT JSON only — no markdown fence, no preamble, no commentary. Shape:\n'
        f'{{"variants":[{{"angle":"<LABEL>","text":"<full caption>","image_direction":"<one line>"}}]}}\n\n'
        f'Rules:\n'
        f'- Exactly 3 variants, in the order of the labels above.\n'
        f'- "text" is the full caption ready to post, NOT truncated.\n'
        f'- "image_direction" is one line describing the background image we should generate for this variant.\n'
        f'- Do NOT escape line breaks as \\\\n inside "text" — use actual JSON \\n strings.\n'
        f'- Do NOT include any prose outside the JSON object.'
    )


def _parse_variants_response(raw_text, expected_angles):
    """Parse a strict-JSON 3-variant response. Returns list of variants or None on failure.

    Tolerant of markdown fences around the JSON (rare leak), strips them before parsing.
    """
    text = raw_text.strip()
    if text.startswith('```'):
        # Strip the first fence + optional language tag, and any trailing fence.
        text = text.split('\n', 1)[1] if '\n' in text else text
        if text.rstrip().endswith('```'):
            text = text.rstrip()[:-3]
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    variants = data.get('variants') if isinstance(data, dict) else None
    if not isinstance(variants, list) or not variants:
        return None
    out = []
    for v in variants[:3]:
        if not isinstance(v, dict):
            continue
        out.append({
            'angle': str(v.get('angle', '')).strip() or 'VARIANT',
            'text': str(v.get('text', '')).strip(),
            'image_direction': str(v.get('image_direction', '')).strip(),
        })
    if len(out) < 1:
        return None
    return out


@app.route('/api/generate', methods=['POST'])
def generate():
    uid, err = _require_user()
    if err: return err
    ctx = request.get_json()
    if not ctx:
        return jsonify({'error': 'No JSON body provided'}), 400

    content_type = ctx.get('content_type', 'social_post')
    template = TEMPLATES.get(content_type, TEMPLATES['social_post'])
    user_prompt = build_user_prompt(ctx)

    image_blocks, ref_err = _ref_images_to_blocks(ctx.get('reference_images'))
    if ref_err:
        return jsonify({'error': ref_err}), 400

    voice = ctx.get('voice', 'underground')
    system = _system_prompt_for(voice)

    # Three-angle variant mode: only for short-form content types and not when running a variation.
    want_variants = (
        ctx.get('n_variants') == 3
        and content_type in VARIANT_ENABLED_TYPES
        and not ctx.get('variation')
    )
    if want_variants:
        angles = VARIANT_ANGLES.get(content_type, ['ANGLE A', 'ANGLE B', 'ANGLE C'])
        user_prompt = user_prompt + _variant_prompt_suffix(angles)
        max_tokens = int(template.get('max_tokens', 500) * 2.6)
    else:
        max_tokens = template.get('max_tokens', 500)

    user_content = (
        image_blocks + [{'type': 'text', 'text': user_prompt}]
        if image_blocks else user_prompt
    )

    balance, err = _debit(uid, 'text', f'gen:{content_type}')
    if err: return err

    try:
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=max_tokens,
            system=system,
            messages=[{'role': 'user', 'content': user_content}]
        )
        raw = message.content[0].text

        if want_variants:
            variants = _parse_variants_response(raw, VARIANT_ANGLES.get(content_type, []))
            if variants:
                return jsonify({
                    'variants': variants,
                    'content_type': content_type,
                    'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
                    'model': message.model,
                    'credits_balance': balance,
                })
            # Fallback: malformed JSON → degrade to single-block. Don't refund (work was done).
            print(f'[generate] variant parse failed for {content_type}; falling back to single block')

        return jsonify({
            'content': raw,
            'content_type': content_type,
            'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
            'model': message.model,
            'credits_balance': balance,
        })
    except anthropic.APIError as e:
        _refund(uid, 'text', f'refund:gen:{content_type}')
        return jsonify({'error': str(e)}), 500


@app.route('/api/enhance', methods=['POST'])
def enhance():
    """Refine an existing draft. Same voice/context as the original generation,
    but the draft text is the seed and ENHANCE_PROMPT directs the rewrite."""
    uid, err = _require_user()
    if err: return err
    ctx = request.get_json() or {}
    draft = (ctx.get('text') or '').strip()
    if not draft:
        return jsonify({'error': 'text is required'}), 400

    image_blocks, ref_err = _ref_images_to_blocks(ctx.get('reference_images'))
    if ref_err:
        return jsonify({'error': ref_err}), 400

    voice = ctx.get('voice', 'underground')
    system = _system_prompt_for(voice)
    content_type = ctx.get('content_type', 'social_post')
    template = TEMPLATES.get(content_type, TEMPLATES['social_post'])

    parts = [ENHANCE_PROMPT]
    # Carry through the original brief so the refiner knows what to preserve.
    if ctx.get('artist_data'):
        a = ctx['artist_data']
        if a.get('name'): parts.append(f"Artist: {a['name']}")
        if a.get('genre'): parts.append(f"Genre: {a['genre']}")
    if ctx.get('event'):    parts.append(f"Event: {ctx['event']}")
    if ctx.get('release'):  parts.append(f"Release: {ctx['release']}")
    if ctx.get('freeform'): parts.append(f"Additional context: {ctx['freeform']}")
    parts.append(f'\nDraft to refine:\n"""\n{draft}\n"""')

    user_text = '\n'.join(parts)
    user_content = (
        image_blocks + [{'type': 'text', 'text': user_text}]
        if image_blocks else user_text
    )

    balance, err = _debit(uid, 'text', f'enhance:{content_type}')
    if err: return err

    try:
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=template.get('max_tokens', 500),
            system=system,
            messages=[{'role': 'user', 'content': user_content}]
        )
        return jsonify({
            'content': message.content[0].text,
            'tokens_used': message.usage.input_tokens + message.usage.output_tokens,
            'model': message.model,
            'credits_balance': balance,
        })
    except anthropic.APIError as e:
        _refund(uid, 'text', f'refund:enhance:{content_type}')
        return jsonify({'error': str(e)}), 500


# ── Media generation (image + video) ────────────────────────
# /api/generate-media is the canonical endpoint. /api/generate-image is kept
# as a thin alias for the existing frontend until Stream 1 wires the new shape.

VALID_MEDIA_TYPES = {'image', 'video_composite', 'video_standard', 'video_premium'}

# Delivery layer (Context Stack L7): platform output sizes.
SIZE_DIMENSIONS = {
    '4:5':  (1080, 1350),   # IG/FB feed
    '9:16': (1080, 1920),   # TikTok / Reels / Stories
    '1:1':  (1080, 1080),   # square
}

# ── Audio rights gate (Beat) ───────────────────────────────
# See wiki/features/firepit_beat.md. A scheduled post embeds its audio into the
# uploaded MP4, which TikTok/Meta fingerprint and enforce retroactively. POSTABLE
# categories may be scheduled *only with proof on file*; BLOCKED categories are
# undefendable and can never be scheduled. Encodes the platforms' actual rules.
AUDIO_RIGHTS_POSTABLE = {'own_master', 'artist_permission', 'royalty_free', 'cc0_public_domain'}
AUDIO_RIGHTS_BLOCKED = {'commercial_release', 'app_sound_or_rip', 'undocumented'}
AUDIO_RIGHTS_CATEGORIES = AUDIO_RIGHTS_POSTABLE | AUDIO_RIGHTS_BLOCKED
_AUDIO_RIGHTS_BLOCKED_LABEL = {
    'commercial_release': 'a commercially-released / major-label recording',
    'app_sound_or_rip': 'a trending app sound or a track ripped from streaming',
    'undocumented': 'a third-party track with no documented permission',
}


def _audio_rights_ok(category, proof_url, license_notes):
    """Gate logic for Beat audio. Returns (ok: bool, reason: str|None).

    Blocked → never postable. Postable → needs proof (a licence/permission URL or
    notes) on file. Unknown/missing → must be classified first.
    """
    if not category:
        return False, 'Classify this audio’s rights before scheduling it.'
    if category in AUDIO_RIGHTS_BLOCKED:
        label = _AUDIO_RIGHTS_BLOCKED_LABEL.get(category, 'unlicensed for commercial use')
        return False, (
            f'This audio is {label}. TikTok and Meta fingerprint embedded audio and will '
            'mute, remove, or strike the post — often weeks or months later. It can’t be '
            'scheduled. Use your own track, a royalty-free/licensed track, or a lineup '
            'artist’s track with written permission.'
        )
    if category in AUDIO_RIGHTS_POSTABLE:
        if not (proof_url or license_notes):
            return False, (
                'Add proof of rights (licence receipt, written permission, or CC0/public-domain '
                'link) before scheduling this audio.'
            )
        return True, None
    return False, f'Unknown rights category: {category}.'


def _parse_media_request():
    """Return (ctx_dict, audio_bytes_or_None, audio_filename_or_None, error_response_or_None).

    Accepts either:
      - application/json: ctx in body, no audio
      - multipart/form-data: ctx as JSON in 'data' field, audio in 'audio_file'
    """
    if request.content_type and request.content_type.startswith('multipart/form-data'):
        raw = request.form.get('data')
        if not raw:
            return None, None, None, (jsonify({'error': "multipart request missing 'data' field"}), 400)
        try:
            ctx = json.loads(raw)
        except json.JSONDecodeError as e:
            return None, None, None, (jsonify({'error': f'invalid JSON in data: {e}'}), 400)
        f = request.files.get('audio_file')
        if f is None:
            return ctx, None, None, None
        audio_bytes = f.read()
        if len(audio_bytes) > MAX_AUDIO_FILE_BYTES:
            return None, None, None, (
                jsonify({'error': f'audio_file exceeds {MAX_AUDIO_FILE_BYTES // (1024*1024)}MB limit'}), 413
            )
        return ctx, audio_bytes, f.filename or 'upload.mp3', None
    ctx = request.get_json(silent=True)
    if not ctx:
        return None, None, None, (jsonify({'error': 'No JSON body provided'}), 400)
    return ctx, None, None, None


def _dispatch_media(media_type, image_prompt, audio_path, w, h, duration_seconds):
    """Route to the right media_gen function. Returns (bytes, provider, model, ext)."""
    if media_type == 'image':
        b, p, m = generate_image(image_prompt, w, h)
        return b, p, m, 'png'
    if media_type == 'video_composite':
        if not audio_path:
            raise ValueError('video_composite requires an audio_file')
        b, p, m, _ = generate_video_composite(image_prompt, audio_path, w, h, duration_seconds)
        return b, p, m, 'mp4'
    if media_type == 'video_standard':
        b, p, m, _ = generate_video_standard(image_prompt, audio_path, w, h, duration_seconds)
        return b, p, m, 'mp4'
    if media_type == 'video_premium':
        b, p, m, _ = generate_video_premium(image_prompt, audio_path, w, h, duration_seconds)
        return b, p, m, 'mp4'
    raise ValueError(f'unknown media_type: {media_type}')


@app.route('/api/generate-media', methods=['POST'])
def generate_media_endpoint():
    uid, err = _require_user()
    if err: return err

    ctx, audio_bytes, audio_filename, err = _parse_media_request()
    if err: return err

    media_type = ctx.get('media_type', 'image')
    if media_type not in VALID_MEDIA_TYPES:
        return jsonify({'error': f'media_type must be one of {sorted(VALID_MEDIA_TYPES)}'}), 400

    content_type = ctx.get('content_type', 'social_post')
    generated_text = ctx.get('generated_text', '')
    duration_seconds = int(ctx.get('duration_seconds', 5))
    if duration_seconds <= 0 or duration_seconds > MAX_VIDEO_DURATION_SECONDS:
        return jsonify({'error': f'duration_seconds must be 1..{MAX_VIDEO_DURATION_SECONDS}'}), 400

    if media_type == 'video_composite' and audio_bytes is None:
        return jsonify({'error': 'video_composite requires an audio_file (multipart)'}), 400

    # Beat rights gate (upload step): every supplied audio MUST be classified so
    # the scheduling gate has provenance to check. Blocked categories are still
    # allowed to generate (they can sit in the library), but can't be scheduled.
    audio_rights = None
    if audio_bytes is not None:
        rights_in = ctx.get('rights') or {}
        category = rights_in.get('category')
        if category not in AUDIO_RIGHTS_CATEGORIES:
            return jsonify({
                'error': 'audio_rights_required',
                'detail': 'Audio must be classified. rights.category must be one of: '
                          + ', '.join(sorted(AUDIO_RIGHTS_CATEGORIES)),
            }), 400
        audio_rights = {
            'category': category,
            'proof_url': rights_in.get('proof_url'),
            'license_notes': rights_in.get('license_notes'),
            'source_artist_profile_id': rights_in.get('source_artist_profile_id'),
            'attested_by': uid,
        }

    cost_kind = media_type if media_type != 'image' else 'image'
    balance, err = _debit(uid, cost_kind, f'{media_type}:{content_type}')
    if err: return err

    audio_track = None
    try:
        # If audio supplied, upload + register first so we have a track id to
        # link from the generated stash item later.
        if audio_bytes is not None:
            audio_track = upload_audio_track(audio_bytes, audio_filename, user_id=uid,
                                             rights=audio_rights)

        image_prompt = build_image_prompt(content_type, ctx, generated_text)
        w, h = IMAGE_DIMENSIONS.get(content_type, (1200, 675))

        media_bytes, provider, model, ext = _dispatch_media(
            media_type, image_prompt,
            audio_path=(audio_track['local_path'] if audio_track else None),
            w=w, h=h, duration_seconds=duration_seconds,
        )

        if ext == 'png':
            media_url = save_image(media_bytes, content_type, user_id=uid)
        else:
            media_url = save_video(media_bytes, content_type, user_id=uid, ext=ext)

        return jsonify({
            'media_url': media_url,
            'media_type': media_type,
            'image_prompt': image_prompt,
            'provider': provider,
            'model': model,
            'dimensions': {'width': w, 'height': h},
            'duration_seconds': duration_seconds if media_type != 'image' else None,
            'audio_track_id': audio_track['id'] if audio_track else None,
            'audio_rights_category': audio_rights['category'] if audio_rights else None,
            'audio_rights_postable': (audio_rights['category'] in AUDIO_RIGHTS_POSTABLE) if audio_rights else None,
            'estimated_cost_usd': COST_USD.get(media_type, 0),
            'credits_balance': balance,
        })
    except Exception as e:
        _refund(uid, cost_kind, f'refund:{media_type}:{content_type}')
        return jsonify({'error': str(e)}), 500
    finally:
        if audio_track and audio_track.get('local_path') and os.path.exists(audio_track['local_path']):
            try: os.unlink(audio_track['local_path'])
            except OSError: pass


# Structured slots that the Additional Context box may also carry. Extraction
# fills EMPTY slots only — typed structured input always wins (Context Stack).
_FREEFORM_FACT_KEYS = ('event', 'venue', 'city', 'date', 'doors', 'curfew', 'tickets', 'artist_list')


def _parse_additional_context(ctx):
    """Parse the Additional Context box into Context Stack layers (master spec,
    2026-06-12): FACTS → fill empty structured slots (L4, typed input wins);
    DIRECTION → ctx['direction'], binding design instructions (L5 — placement,
    type size, composition; followed closely per Doug's law); VIBE →
    ctx['mood'] (L5, fills gaps only). The old 200-char clip is dead.

    Returns {'facts': {...}, 'direction': str, 'mood': str} for response
    transparency. Failure-safe: on any error the WHOLE box becomes binding
    direction (never silently dropped — Doug's law says follow it closely).
    """
    freeform = (ctx.get('freeform') or '').strip()
    if not freeform:
        return {}
    fallback = {'facts': {}, 'direction': freeform, 'mood': ''}
    if len(freeform) < 20:
        ctx['direction'] = freeform
        ctx['mood'] = ''
        return fallback
    try:
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=600,
            system=('Split a music promoter\'s notes for an image-generation tool into '
                    'three parts. Respond with ONLY a JSON object: '
                    '"facts" — object with keys ONLY where the text clearly states them: '
                    'event (night/event name), venue, city, date, doors (opening time), '
                    'curfew (end time), tickets (price/link), artist_list (newline-'
                    'separated lineup); '
                    '"direction" — string: every explicit design/layout instruction, '
                    'verbatim where possible (placement of people or objects, font/type '
                    'size, scale, composition, colour treatment, graphic directives); '
                    '"mood" — string: the vibe/atmosphere/feel words only. '
                    'No prose, no markdown fences.'),
            messages=[{'role': 'user', 'content': freeform[:4000]}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith('```'):
            raw = raw.strip('`').removeprefix('json').strip()
        parsed = json.loads(raw)
        facts = parsed.get('facts') or {}
        filled = {}
        for k in _FREEFORM_FACT_KEYS:
            v = facts.get(k)
            if isinstance(v, str) and v.strip() and not (ctx.get(k) or '').strip():
                ctx[k] = v.strip()
                filled[k] = v.strip()
        ctx['direction'] = str(parsed.get('direction') or '').strip()
        ctx['mood'] = str(parsed.get('mood') or '').strip()
        return {'facts': filled, 'direction': ctx['direction'], 'mood': ctx['mood']}
    except Exception as e:
        print(f'⚠️  additional-context parse failed ({e}) — whole box treated as direction')
        ctx['direction'] = freeform
        ctx['mood'] = ''
        return fallback


# /api/classify-ref — auto-guess WHO/WHERE/WHAT/STYLE for uploaded references
# (context-pipeline spec). Cheap Haiku vision call; the frontend falls back to
# 'style' if this fails, and the promoter can always tap the chip to correct.
@app.route('/api/classify-ref', methods=['POST'])
def classify_ref_endpoint():
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    images = body.get('images')
    blocks, ref_err = _ref_images_to_blocks(images)
    if ref_err:
        return jsonify({'error': ref_err}), 400
    if not blocks:
        return jsonify({'roles': []})
    try:
        content = []
        for i, b in enumerate(blocks, 1):
            content.append({'type': 'text', 'text': f'Image {i}:'})
            content.append(b)
        content.append({'type': 'text', 'text': (
            f'Classify each of the {len(blocks)} images above for a music-event '
            'design tool. Roles: "who" = a photo of a person/artist/DJ; '
            '"where" = a place, venue, building or scene; "what" = an object, '
            'prop or motif; "style" = a designed artwork (flyer, poster, album '
            'art) whose aesthetic would be copied. Respond with ONLY a JSON '
            f'array of {len(blocks)} strings, e.g. ["style","who"].')})
        message = client.messages.create(
            model='claude-haiku-4-5-20251001',
            max_tokens=100,
            messages=[{'role': 'user', 'content': content}],
        )
        raw = message.content[0].text.strip()
        if raw.startswith('```'):
            raw = raw.strip('`').removeprefix('json').strip()
        roles = json.loads(raw)
        roles = [r if r in REF_ROLES else 'style' for r in roles][:len(blocks)]
        roles += ['style'] * (len(blocks) - len(roles))
        return jsonify({'roles': roles})
    except Exception as e:
        print(f'⚠️  classify-ref failed: {e}')
        return jsonify({'roles': ['style'] * len(blocks)})


# /api/generate-image — Forge image generation.
# Routes through the v2 job router (FLUX.2 / Seedream / Nano Banana) per
# wiki/spec/forge_output_recipes.md, with a guarded fallback to the legacy
# Fal→Replicate chain so a v2/Fal outage degrades instead of 500-ing.
@app.route('/api/generate-image', methods=['POST'])
def generate_image_endpoint():
    uid, err = _require_user()
    if err: return err
    ctx = request.get_json()
    if not ctx:
        return jsonify({'error': 'No JSON body provided'}), 400

    content_type = ctx.get('content_type', 'social_post')
    generated_text = ctx.get('generated_text', '')

    balance, err = _debit(uid, 'image', f'image:{content_type}')
    if err: return err

    try:
        # Delivery layer (L7): per-generation output size; format default as fallback.
        w, h = SIZE_DIMENSIONS.get(ctx.get('size'), IMAGE_DIMENSIONS.get(content_type, (1080, 1350)))

        # Context Stack L4/L5: parse the Additional Context box into facts
        # (fill empty structured slots — typed input wins), binding direction,
        # and vibe. The 200-char clip is dead (master spec, 2026-06-12).
        parsed_context = _parse_additional_context(ctx)
        extracted_facts = parsed_context.get('facts', {})

        # A selected Spirit (avatar) contributes its reference images for
        # character consistency — in the role-tagged model a Spirit is just a
        # set of WHO references. Spirit refs lead, then the promoter's uploads
        # (each with its WHO/WHERE/WHAT/STYLE role); fal caps image inputs at 10.
        avatar_id = ctx.get('avatar_id')
        avatar_refs = []
        if avatar_id:
            av = _owned_avatar(avatar_id, uid)
            if av:
                avatar_refs = list(av.get('reference_image_urls') or [])
        if not avatar_refs and ctx.get('avatar_image_url'):
            avatar_refs = [ctx['avatar_image_url']]
        ctx_refs = _normalize_reference_images(ctx.get('reference_images'))
        roled_refs = ([{'data': u, 'role': 'who', 'note': 'the summoned spirit'}
                       for u in avatar_refs] + ctx_refs)[:10]
        image_refs = [r['data'] for r in roled_refs] or None
        ref_roles = [r['role'] for r in roled_refs]
        role_set = set(ref_roles)

        has_avatar = bool(avatar_id or ctx.get('avatar_image_url'))
        # Prompt by reference situation (context-pipeline spec, 2026-06-11):
        # style-only refs keep the proven restyle prompt; any other mix gets the
        # compose prompt that names each reference's job; no refs → backdrop.
        if role_set == {'style'}:
            image_prompt = build_restyle_prompt(content_type, ctx, generated_text)
        elif role_set:
            image_prompt = build_compose_prompt(content_type, ctx, roled_refs, generated_text)
        else:
            image_prompt = build_image_prompt(content_type, ctx, generated_text)
        job_type = job_type_for(content_type, has_avatar=has_avatar,
                                has_style_refs=(role_set == {'style'}),
                                ref_roles=ref_roles)
        seed = ctx.get('seed')

        # Trust mechanism (Doug's reassurance ask): make prompt + ref usage visible.
        print(f"🎨 Forge image — type={content_type} job={job_type} "
              f"refs={len(roled_refs)} roles={ref_roles} "
              f"(spirit:{len(avatar_refs)} + ctx:{len(ctx_refs)}) seed={seed}")
        if extracted_facts:
            print(f"   freeform facts filled: {extracted_facts}")
        print(f"   prompt: {image_prompt[:240]}")

        try:
            image_bytes, provider, model = generate_for_job(
                job_type, image_prompt, image_refs=image_refs,
                width=w, height=h, seed=seed,
            )
        except Exception as v2_err:
            print(f"⚠️  v2 router failed ({v2_err}); falling back to legacy generate_image")
            image_bytes, provider, model = generate_image(image_prompt, w, h)

        image_url = save_image(image_bytes, content_type, user_id=uid)

        return jsonify({
            'image_url': image_url,
            'image_prompt': image_prompt,
            'provider': provider,
            'model': model,
            'job_type': job_type,
            'refs_used': len(roled_refs),
            'ref_roles': ref_roles,
            'extracted_facts': extracted_facts or {},
            'direction': ctx.get('direction', ''),
            'mood': ctx.get('mood', ''),
            'dimensions': {'width': w, 'height': h},
            'credits_balance': balance,
        })
    except Exception as e:
        _refund(uid, 'image', f'refund:image:{content_type}')
        return jsonify({'error': str(e)}), 500


# ── Auth helpers (Phase B) ────────────────────────────────
def _resolve_user_id():
    """Return the authed user_id from the request JWT, or None if missing/invalid.

    Endpoints calling this must 401 when None is returned.
    """
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:].strip()
    try:
        res = _stash_client().auth.get_user(token)
        if res and res.user:
            return res.user.id
    except Exception as e:
        print('JWT validation failed:', e)
    return None


def _require_user():
    """Decorator-less helper: returns (user_id, None) or (None, 401-response)."""
    uid = _resolve_user_id()
    if uid is None:
        return None, (jsonify({'error': 'unauthenticated'}), 401)
    return uid, None


# ── Public client config ──────────────────────────────────
# Lets the frontend pick up SUPABASE_URL + anon key without baking them into
# committed source. Anon key is safe to expose (RLS is the security layer).
@app.route('/api/config', methods=['GET'])
def public_config():
    return jsonify({
        'supabase_url': os.environ['SUPABASE_URL'],
        'supabase_anon_key': os.environ['SUPABASE_ANON_KEY'],
    })


# ── Stash (Supabase-backed) ───────────────────────────────
# Service-role proxy. Every route below scopes by the JWT-resolved user_id
# (see _require_user); RLS is bypassed by the service key, so the .eq('user_id')
# filters are the access-control boundary.
_stash_sb = None
def _stash_client():
    global _stash_sb
    if _stash_sb is None:
        from supabase import create_client
        _stash_sb = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_KEY'],
        )
    return _stash_sb

STASH_KIND_BY_TYPE = {
    'social_post':'text','social_carousel':'text',
    'event_promo':'text','event_poster':'text',
    'artist_bio':'text',
}

@app.route('/api/me', methods=['GET'])
def me():
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return jsonify({'error': 'unauthenticated'}), 401
    token = auth[7:].strip()
    try:
        res = _stash_client().auth.get_user(token)
        if not res or not res.user:
            return jsonify({'error': 'invalid token'}), 401
        user_id = res.user.id
        email = res.user.email
    except Exception as e:
        return jsonify({'error': f'token error: {e}'}), 401
    sb = _stash_client()
    profile = sb.table('users').select('tier,credits_balance').eq('id', user_id).execute()
    p = (profile.data or [{}])[0]
    return jsonify({
        'id': user_id,
        'email': email,
        'tier': p.get('tier'),
        'credits_balance': p.get('credits_balance'),
    })


@app.route('/api/stash', methods=['GET'])
def stash_list():
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    res = sb.table('stash_items').select('*').eq('user_id', uid).order('created_at', desc=True).execute()
    return jsonify({'items': res.data})

@app.route('/api/stash', methods=['POST'])
def stash_insert():
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    content_type = body.get('type', '')
    row = {
        'user_id': uid,
        'kind': STASH_KIND_BY_TYPE.get(content_type, 'text'),
        'content': body.get('content'),
        'media_url': body.get('imageUrl') or None,
        'prompt': body.get('prompt'),
        'metadata': {
            'type': content_type,
            'label': body.get('label'),
            'icon': body.get('icon'),
            'context': body.get('context') or {},
            'status': body.get('status', 'draft'),
        },
    }
    sb = _stash_client()
    res = sb.table('stash_items').insert(row).execute()
    return jsonify({'item': res.data[0] if res.data else None}), 201

@app.route('/api/stash/<item_id>', methods=['DELETE'])
def stash_delete(item_id):
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    sb.table('stash_items').delete().eq('id', item_id).eq('user_id', uid).execute()
    return jsonify({'ok': True})

@app.route('/api/stash/<item_id>', methods=['PATCH'])
def stash_update(item_id):
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    patch = {}
    if 'content' in body: patch['content'] = body['content']
    if 'imageUrl' in body: patch['media_url'] = body['imageUrl']
    if 'metadata' in body: patch['metadata'] = body['metadata']
    sb = _stash_client()
    res = sb.table('stash_items').update(patch).eq('id', item_id).eq('user_id', uid).execute()
    return jsonify({'item': res.data[0] if res.data else None})


# ── Brand Kits (Brand Overlay Compositor — Phase 1) ──────
# Multi-brand per user. Each kit holds the logo + fonts + palette + default
# layout knobs used by the browser compositor.
# Spec: wiki/spec/brand_overlay_compositor.md
BRAND_ASSETS_BUCKET = 'brand_assets'
BRAND_ASSET_MAX_BYTES = 5 * 1024 * 1024  # 5MB per file
BRAND_ASSET_ALLOWED_MIMES = {
    'image/png', 'image/svg+xml', 'image/jpeg', 'image/webp',
    'font/woff2', 'font/woff', 'font/ttf', 'font/otf',
    'application/font-woff2', 'application/font-woff',
    'application/x-font-ttf', 'application/x-font-otf',
    'application/octet-stream',  # browsers sometimes send fonts as this
}

BRAND_KIT_FIELDS = ('name', 'logo_url', 'display_font_url', 'body_font_url', 'palette', 'defaults', 'templates')

@app.route('/api/brand_kits', methods=['GET'])
def brand_kits_list():
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    res = sb.table('brand_kits').select('*').eq('user_id', uid).order('created_at', desc=True).execute()
    return jsonify({'kits': res.data})

@app.route('/api/brand_kits', methods=['POST'])
def brand_kits_insert():
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    name = (body.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    row = {'user_id': uid, 'name': name}
    for f in ('logo_url', 'display_font_url', 'body_font_url'):
        if f in body: row[f] = body[f]
    if 'palette' in body and isinstance(body['palette'], dict): row['palette'] = body['palette']
    if 'defaults' in body and isinstance(body['defaults'], dict): row['defaults'] = body['defaults']
    sb = _stash_client()
    res = sb.table('brand_kits').insert(row).execute()
    return jsonify({'kit': res.data[0] if res.data else None}), 201

@app.route('/api/brand_kits/<kit_id>', methods=['PATCH'])
def brand_kits_update(kit_id):
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    patch = {}
    for f in BRAND_KIT_FIELDS:
        if f in body:
            patch[f] = body[f]
    if not patch:
        return jsonify({'error': 'no fields to update'}), 400
    sb = _stash_client()
    res = sb.table('brand_kits').update(patch).eq('id', kit_id).eq('user_id', uid).execute()
    return jsonify({'kit': res.data[0] if res.data else None})

@app.route('/api/brand_kits/<kit_id>', methods=['DELETE'])
def brand_kits_delete(kit_id):
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    sb.table('brand_kits').delete().eq('id', kit_id).eq('user_id', uid).execute()
    return jsonify({'ok': True})

@app.route('/api/brand_assets/upload', methods=['POST'])
def brand_assets_upload():
    """Multipart upload to the brand_assets bucket. Returns the public URL.

    Body: multipart/form-data with field 'file' and optional 'kind' (logo|display_font|body_font).
    """
    uid, err = _require_user()
    if err: return err
    f = request.files.get('file')
    if f is None:
        return jsonify({'error': 'file field required'}), 400
    mime = (f.mimetype or '').lower()
    if mime not in BRAND_ASSET_ALLOWED_MIMES:
        return jsonify({'error': f'unsupported type: {mime}'}), 400
    data = f.read()
    if len(data) > BRAND_ASSET_MAX_BYTES:
        return jsonify({'error': f'file exceeds {BRAND_ASSET_MAX_BYTES // (1024*1024)}MB'}), 400
    kind = (request.form.get('kind') or 'asset').strip().lower()
    safe_kind = ''.join(c for c in kind if c.isalnum() or c == '_')[:32] or 'asset'
    original = (f.filename or '').lower()
    ext = ''
    if '.' in original:
        ext = '.' + original.rsplit('.', 1)[1][:6]
    ts = int(time.time())
    object_path = f"{uid}/{safe_kind}_{ts}_{os.urandom(3).hex()}{ext}"
    sb = _stash_client()
    sb.storage.from_(BRAND_ASSETS_BUCKET).upload(
        path=object_path,
        file=data,
        file_options={'content-type': mime, 'upsert': 'true'},
    )
    public_url = sb.storage.from_(BRAND_ASSETS_BUCKET).get_public_url(object_path)
    return jsonify({'url': public_url, 'path': object_path})


# ── Billing (Phase D — Stripe) ────────────────────────────
import stripe

STRIPE_KEY            = os.getenv('STRIPE_SECRET_KEY')
STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET')
APP_BASE_URL          = os.getenv('APP_BASE_URL', 'http://localhost:5500')

if STRIPE_KEY:
    stripe.api_key = STRIPE_KEY


def _billing_unavailable():
    return jsonify({'error': 'billing_not_configured', 'detail': 'STRIPE_SECRET_KEY not set on server'}), 503


def _ensure_stripe_customer(uid, email):
    """Get-or-create the Stripe customer for this user. Caches id on public.users."""
    sb = _stash_client()
    row = sb.table('users').select('stripe_customer_id').eq('id', uid).execute()
    cid = (row.data or [{}])[0].get('stripe_customer_id')
    if cid:
        return cid
    customer = stripe.Customer.create(email=email, metadata={'sound_cave_user_id': uid})
    sb.table('users').update({'stripe_customer_id': customer.id}).eq('id', uid).execute()
    return customer.id


@app.route('/api/billing/plans', methods=['GET'])
def billing_plans():
    """Static plan list — used by the pricing modal. Public (no auth required)."""
    return jsonify({
        'plans': [
            {'lookup_key': 'tier_solo_monthly',   'tier': 'solo',   'name': 'Solo',   'price_pence': 2900,  'credits': 500,  'highlighted': False},
            {'lookup_key': 'tier_label_monthly',  'tier': 'label',  'name': 'Label',  'price_pence': 7900,  'credits': 2000, 'highlighted': True},
            {'lookup_key': 'tier_agency_monthly', 'tier': 'agency', 'name': 'Agency', 'price_pence': 19900, 'credits': 6000, 'highlighted': False},
        ],
        'pack': {'lookup_key': 'credit_pack_200', 'name': '200 Credit Pack', 'price_pence': 1000, 'credits': 200},
        'currency': 'gbp',
        'configured': bool(STRIPE_KEY),
    })


@app.route('/api/billing/checkout', methods=['POST'])
def billing_checkout():
    if not STRIPE_KEY:
        return _billing_unavailable()
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    lookup_key = body.get('lookup_key')
    if not lookup_key:
        return jsonify({'error': 'lookup_key required'}), 400

    prices = stripe.Price.list(lookup_keys=[lookup_key], active=True, limit=1)
    if not prices.data:
        return jsonify({'error': f'unknown lookup_key: {lookup_key} — run scripts/stripe_bootstrap.py'}), 400
    price = prices.data[0]

    auth_token = request.headers.get('Authorization', '')[7:].strip()
    user_res = _stash_client().auth.get_user(auth_token)
    customer_id = _ensure_stripe_customer(uid, user_res.user.email)

    is_subscription = bool(price.recurring)
    session = stripe.checkout.Session.create(
        customer=customer_id,
        line_items=[{'price': price.id, 'quantity': 1}],
        mode='subscription' if is_subscription else 'payment',
        success_url=f'{APP_BASE_URL}/?billing=success',
        cancel_url=f'{APP_BASE_URL}/?billing=cancelled',
        metadata={'sound_cave_user_id': uid, 'lookup_key': lookup_key},
        subscription_data={'metadata': {'sound_cave_user_id': uid, 'lookup_key': lookup_key}} if is_subscription else None,
    )
    return jsonify({'url': session.url})


@app.route('/api/billing/portal', methods=['POST'])
def billing_portal():
    if not STRIPE_KEY:
        return _billing_unavailable()
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    row = sb.table('users').select('stripe_customer_id').eq('id', uid).execute()
    cid = (row.data or [{}])[0].get('stripe_customer_id')
    if not cid:
        return jsonify({'error': 'no_customer', 'detail': 'subscribe to a plan first'}), 400
    portal = stripe.billing_portal.Session.create(customer=cid, return_url=f'{APP_BASE_URL}/')
    return jsonify({'url': portal.url})


@app.route('/api/billing/webhook', methods=['POST'])
def billing_webhook():
    if not STRIPE_KEY or not STRIPE_WEBHOOK_SECRET:
        return _billing_unavailable()
    payload = request.data
    sig = request.headers.get('Stripe-Signature', '')
    try:
        event = stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        print('webhook signature verification failed:', e)
        return jsonify({'error': 'invalid signature'}), 400

    sb = _stash_client()
    etype = event['type']
    # Stripe SDK 15.x StripeObject.get() raises AttributeError; parse raw JSON instead.
    obj = json.loads(payload)['data']['object']
    print(f'[billing webhook] {etype}')

    if etype == 'checkout.session.completed':
        if obj.get('mode') == 'payment':
            uid = (obj.get('metadata') or {}).get('sound_cave_user_id')
            lookup_key = (obj.get('metadata') or {}).get('lookup_key')
            if uid and lookup_key == 'credit_pack_200':
                sb.rpc('grant_credits', {
                    'p_user_id': uid, 'p_amount': 200,
                    'p_reason': f"pack:{obj.get('id')}",
                }).execute()
                print(f'  granted 200 credits to {uid}')
        # Subscription checkouts also fire here; provisioning happens in subscription.created.

    elif etype in ('customer.subscription.created', 'customer.subscription.updated'):
        uid = (obj.get('metadata') or {}).get('sound_cave_user_id')
        if not uid:
            cust = obj.get('customer')
            row = sb.table('users').select('id').eq('stripe_customer_id', cust).execute()
            uid = (row.data or [{}])[0].get('id')

        items = (obj.get('items') or {}).get('data') or []
        if not items:
            return jsonify({'received': True})
        first_item = items[0]
        price_id = (first_item.get('price') or {}).get('id')
        price = stripe.Price.retrieve(price_id)
        price_meta = dict(price.metadata or {})
        tier = price_meta.get('tier') or 'solo'

        # Stripe API 2024-12+ moved current_period_end onto each item.
        period_end = obj.get('current_period_end') or first_item.get('current_period_end')
        sb.table('subscriptions').upsert({
            'user_id': uid,
            'stripe_subscription_id': obj.get('id'),
            'stripe_price_id': price_id,
            'tier': tier,
            'status': obj.get('status'),
            'current_period_end': datetime.fromtimestamp(period_end, tz=timezone.utc).isoformat() if period_end else None,
            'cancel_at_period_end': obj.get('cancel_at_period_end', False),
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }, on_conflict='stripe_subscription_id').execute()

        if obj.get('status') in ('active', 'trialing'):
            sb.table('users').update({'tier': tier}).eq('id', uid).execute()
            if etype == 'customer.subscription.created':
                credits = int(price_meta.get('credits', '0'))
                if credits > 0 and uid:
                    sb.rpc('grant_credits', {
                        'p_user_id': uid, 'p_amount': credits,
                        'p_reason': f"sub_initial:{obj.get('id')}",
                    }).execute()
                    print(f'  granted {credits} initial credits to {uid}')

    elif etype == 'customer.subscription.deleted':
        sb.table('subscriptions').update({
            'status': 'canceled',
            'updated_at': datetime.now(timezone.utc).isoformat(),
        }).eq('stripe_subscription_id', obj.get('id')).execute()

    elif etype == 'invoice.payment_succeeded':
        sub_id = obj.get('subscription')
        if not sub_id or obj.get('billing_reason') != 'subscription_cycle':
            return jsonify({'received': True})
        sub = stripe.Subscription.retrieve(sub_id)
        sub_dict = sub.to_dict() if hasattr(sub, 'to_dict') else dict(sub)
        uid = (sub_dict.get('metadata') or {}).get('sound_cave_user_id')
        if not uid:
            cust = obj.get('customer')
            row = sb.table('users').select('id').eq('stripe_customer_id', cust).execute()
            uid = (row.data or [{}])[0].get('id')
        if uid:
            price_id = sub_dict['items']['data'][0]['price']['id']
            price = stripe.Price.retrieve(price_id)
            price_meta = dict(price.metadata or {})
            credits = int(price_meta.get('credits', '0'))
            if credits > 0:
                sb.rpc('grant_credits', {
                    'p_user_id': uid, 'p_amount': credits,
                    'p_reason': f"renewal:{sub_id}",
                }).execute()
                print(f'  renewed {credits} credits for {uid}')

    return jsonify({'received': True})


# ── SoundCloud search (reuses scout.py patterns) ──────────

SC_CLIENT_ID = os.getenv('SOUNDCLOUD_CLIENT_ID')
SC_CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')
SC_TOKEN = None

def get_sc_token():
    global SC_TOKEN
    if SC_TOKEN:
        return SC_TOKEN
    stored = os.getenv('SOUNDCLOUD_OAUTH_TOKEN')
    if stored:
        SC_TOKEN = stored
        return SC_TOKEN
    if not SC_CLIENT_ID or not SC_CLIENT_SECRET:
        return None
    try:
        r = http_requests.post('https://api.soundcloud.com/oauth2/token', data={
            'grant_type': 'client_credentials',
            'client_id': SC_CLIENT_ID,
            'client_secret': SC_CLIENT_SECRET,
        }, timeout=10)
        if r.status_code == 200:
            SC_TOKEN = r.json().get('access_token', '')
            return SC_TOKEN
    except Exception:
        pass
    return None


def sc_fetch_tracks(genre, limit=50):
    token = get_sc_token()
    if not token:
        return []
    headers = {'Authorization': f'OAuth {token}'}
    params = {'genres': genre, 'limit': limit, 'order': 'hotness', 'filter': 'streamable'}
    try:
        r = http_requests.get('https://api.soundcloud.com/tracks', params=params, headers=headers, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception:
        return []


def sc_fetch_followers(user_id):
    token = get_sc_token()
    if not token:
        return 0
    try:
        r = http_requests.get(f'https://api.soundcloud.com/users/{user_id}',
                              headers={'Authorization': f'OAuth {token}'}, timeout=10)
        if r.status_code == 200:
            return r.json().get('followers_count', 0) or 0
    except Exception:
        pass
    return 0


def sc_resolve_user(username_or_url):
    """Resolve a SoundCloud username/permalink to the full user profile."""
    token = get_sc_token()
    if not token:
        return None
    url = username_or_url if username_or_url.startswith('http') else f'https://soundcloud.com/{username_or_url}'
    try:
        r = http_requests.get('https://api.soundcloud.com/resolve',
                              params={'url': url},
                              headers={'Authorization': f'OAuth {token}'}, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def sc_fetch_user_profile(user_id):
    token = get_sc_token()
    if not token:
        return None
    try:
        r = http_requests.get(f'https://api.soundcloud.com/users/{user_id}',
                              headers={'Authorization': f'OAuth {token}'}, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def sc_fetch_user_tracks(user_id, limit=5):
    token = get_sc_token()
    if not token:
        return []
    try:
        r = http_requests.get(f'https://api.soundcloud.com/users/{user_id}/tracks',
                              params={'limit': limit},
                              headers={'Authorization': f'OAuth {token}'}, timeout=10)
        if r.status_code == 200:
            return r.json() or []
    except Exception:
        pass
    return []


def sc_fetch_all_user_tracks(user_id, max_tracks=500, max_pages=10):
    """Fetch ALL of an artist's OWN uploaded tracks (reposts excluded by the
    /tracks endpoint), paginating via linked_partitioning. Bounded for safety.
    Used for accurate play/like totals on the live artist panel."""
    token = get_sc_token()
    if not token:
        return []
    tracks = []
    url = f'https://api.soundcloud.com/users/{user_id}/tracks'
    params = {'limit': 200, 'linked_partitioning': 'true'}
    pages = 0
    while url and pages < max_pages and len(tracks) < max_tracks:
        try:
            r = http_requests.get(url, params=params,
                                  headers={'Authorization': f'OAuth {token}'}, timeout=15)
            if r.status_code != 200:
                break
            data = r.json()
        except Exception:
            break
        if isinstance(data, list):
            tracks.extend(data)
            break
        tracks.extend(data.get('collection', []))
        url = data.get('next_href')
        params = None
        pages += 1
    return tracks[:max_tracks]


def sc_score_track(track):
    likes = track.get('likes_count') or track.get('favoritings_count') or 0
    reposts = track.get('reposts_count') or 0
    comments = track.get('comment_count') or 0
    followers = (track.get('user') or {}).get('followers_count') or 1
    engagement = (likes + reposts * 2 + comments * 3) / max(followers, 1)
    # Recency bonus
    created = track.get('created_at', '')
    bonus = 1.0
    if created:
        try:
            dt = datetime.strptime(created[:10], '%Y/%m/%d').replace(tzinfo=timezone.utc)
            days_old = (datetime.now(timezone.utc) - dt).days
            if days_old <= 14: bonus = 3.0
            elif days_old <= 30: bonus = 2.0
            elif days_old <= 60: bonus = 1.5
        except Exception:
            pass
    return round(engagement * bonus, 6)


def sc_build_record(track, rank):
    user = track.get('user') or {}
    created_raw = track.get('created_at', '')
    uploaded = created_raw[:10].replace('/', '-') if created_raw else ''
    return {
        'rank': rank,
        'track_id': track.get('id'),
        'title': track.get('title', ''),
        'artist': user.get('username', ''),
        'artist_username': user.get('username', ''),
        'artist_url': user.get('permalink_url', ''),
        'avatar_url': user.get('avatar_url', ''),
        'artwork_url': track.get('artwork_url', ''),
        'genre': track.get('genre', ''),
        'followers': user.get('followers_count', 0),
        'plays': track.get('playback_count', 0),
        'likes': track.get('likes_count') or track.get('favoritings_count') or 0,
        'reposts': track.get('reposts_count', 0),
        'comments': track.get('comment_count', 0),
        'score': track.get('_score', 0),
        'url': track.get('permalink_url', ''),
        'uploaded': uploaded,
    }


SCOUT_GENRES = [
    'house', 'deep house', 'tech house', 'afro house', 'uk garage', 'garage',
    'bassline', 'drum and bass', 'jungle', 'techno', 'minimal techno',
    'breaks', 'breakbeat', 'electronic', 'lo-fi', '140',
]


ARTIST_TTL_SECONDS = 600  # 10 minutes


@app.route('/api/artist/<username>', methods=['GET'])
def artist_stats(username):
    """Fresh per-artist stats with Supabase-backed TTL cache.

    Cache hit (< TTL): no SoundCloud call.
    Cache miss: 2 SC calls (resolve + recent tracks), upserts row, returns fresh.
    """
    username = (username or '').strip()
    if not username:
        return jsonify({'error': 'username required'}), 400

    force = request.args.get('force') == '1'
    sb = _stash_client()

    cached = sb.table('artists').select('*').eq('username', username).limit(1).execute()
    row = (cached.data or [None])[0]

    if row and not force:
        try:
            updated = datetime.fromisoformat(row['updated_at'].replace('Z', '+00:00'))
            age = (datetime.now(timezone.utc) - updated).total_seconds()
            if age < ARTIST_TTL_SECONDS:
                return jsonify({**row, 'cached': True, 'age_seconds': int(age)})
        except Exception:
            pass

    profile = sc_resolve_user(username)
    if not profile or not profile.get('id'):
        if row:
            return jsonify({**row, 'cached': True, 'stale': True, 'error': 'soundcloud unreachable'})
        return jsonify({'error': 'artist not found'}), 404

    user_id = profile['id']
    tracks = sc_fetch_all_user_tracks(user_id)   # all own tracks → accurate totals
    total_plays = sum((t.get('playback_count') or 0) for t in tracks)
    total_likes = sum((t.get('likes_count') or t.get('favoritings_count') or 0) for t in tracks)

    # Top 5 own tracks by plays — returned in the response only, never upserted
    # (the artists table has no column for it; recomputed fresh each cache miss).
    top_tracks = [{
        'title': t.get('title') or '',
        'url': t.get('permalink_url') or '',
        'plays': t.get('playback_count') or 0,
        'likes': t.get('likes_count') or t.get('favoritings_count') or 0,
        'date': (t.get('created_at') or '')[:10],
    } for t in sorted(tracks, key=lambda t: t.get('playback_count') or 0, reverse=True)[:5]]

    record = {
        'soundcloud_id': str(user_id),
        'username': username,
        'display_name': profile.get('username') or username,
        'name': profile.get('full_name') or profile.get('username') or username,
        'follower_count': profile.get('followers_count') or 0,
        'play_count': total_plays,
        'like_count': total_likes,
        'track_count': profile.get('track_count') or 0,
        'avatar_url': profile.get('avatar_url') or '',
        'updated_at': datetime.now(timezone.utc).isoformat(),
    }
    try:
        sb.table('artists').upsert(record, on_conflict='soundcloud_id').execute()
    except Exception as e:
        record['warning'] = f'cache write failed: {e}'

    return jsonify({**record, 'top_tracks': top_tracks, 'cached': False, 'age_seconds': 0})


# ── Scheduled searches store (committed JSON the weekly Action runs) ──────
SCHEDULED_SEARCHES_PATH = os.path.join(os.path.dirname(__file__), 'data', 'scheduled_searches.json')

# The `id` becomes a filename in scheduled_scout.py (data/searches/<id>.json),
# so it MUST be a strict slug — no path separators / traversal. This endpoint
# is the write boundary; we sanitise here so nothing dangerous ever reaches disk.
_SEARCH_ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


def _sanitise_search(item):
    """Return a clean search dict, or None if it's invalid (rejects the POST)."""
    if not isinstance(item, dict):
        return None
    sid = item.get('id', '')
    if not isinstance(sid, str) or not _SEARCH_ID_RE.match(sid):
        return None

    def _str(v, n):
        return (v if isinstance(v, str) else '')[:n]

    def _int(v):
        try:
            return max(0, int(v))
        except (TypeError, ValueError):
            return 0

    return {
        'id':            sid,
        'name':          _str(item.get('name', ''), 120) or sid,
        'genre':         _str(item.get('genre', ''), 80),
        'keyword':       _str(item.get('keyword', ''), 80),
        'min_followers': _int(item.get('min_followers')),
        'max_followers': _int(item.get('max_followers')),
        'frequency':     _str(item.get('frequency', 'weekly'), 20) or 'weekly',
        'limit':         max(1, min(200, _int(item.get('limit')) or 50)),
        'created':       _str(item.get('created', ''), 20),
        'last_run':      _str(item.get('last_run', '') or '', 20) or None,
        'active':        bool(item.get('active')),
    }


def _read_scheduled_searches():
    try:
        with open(SCHEDULED_SEARCHES_PATH) as f:
            data = json.load(f)
        return data if isinstance(data, list) else []
    except FileNotFoundError:
        return []
    except Exception:
        return []


@app.route('/api/scheduled-searches', methods=['GET'])
def get_scheduled_searches():
    return jsonify(_read_scheduled_searches())


@app.route('/api/scheduled-searches', methods=['POST'])
def save_scheduled_searches():
    """Overwrite the committed list with the posted full list (the frontend
    sends the whole array on every create/edit/delete/toggle). Every item is
    sanitised; any invalid item rejects the whole request with 400."""
    body = request.get_json(silent=True)
    if not isinstance(body, list):
        return jsonify({'error': 'expected a JSON array of searches'}), 400
    cleaned = []
    for item in body:
        c = _sanitise_search(item)
        if c is None:
            return jsonify({'error': 'invalid search — id must match [A-Za-z0-9_-]{1,64}'}), 400
        cleaned.append(c)
    os.makedirs(os.path.dirname(SCHEDULED_SEARCHES_PATH), exist_ok=True)
    with open(SCHEDULED_SEARCHES_PATH, 'w') as f:
        json.dump(cleaned, f, indent=2)
    return jsonify({'ok': True, 'count': len(cleaned)})


@app.route('/api/search', methods=['GET'])
def search():
    genre = request.args.get('genre', '')
    min_followers = int(request.args.get('min_followers', 0))
    max_followers = int(request.args.get('max_followers', 5000))
    keyword = request.args.get('keyword', '').strip()
    limit = min(int(request.args.get('limit', 20)), 100)

    token = get_sc_token()
    if not token:
        return jsonify({'error': 'SoundCloud credentials not configured. Set SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET in .env'}), 500

    # Determine which genres to search
    genres_to_search = [genre] if genre else SCOUT_GENRES
    all_tracks = []
    seen_ids = set()

    for g in genres_to_search:
        tracks = sc_fetch_tracks(g, limit=50)
        for track in tracks:
            track_id = track.get('id')
            if not track_id or track_id in seen_ids:
                continue
            seen_ids.add(track_id)

            user = track.get('user') or {}
            followers = user.get('followers_count') or 0
            user_id = user.get('id')

            # Verify suspicious follower counts
            if (followers == 0 or (followers < 500 and (track.get('playback_count') or 0) > 5000)) and user_id:
                followers = sc_fetch_followers(user_id)
                user['followers_count'] = followers

            # Apply filters
            if followers < min_followers or followers > max_followers:
                continue
            plays = track.get('playback_count') or 0
            if plays < 100:
                continue
            if keyword and keyword.lower() not in (track.get('title', '') + ' ' + user.get('username', '')).lower():
                continue

            track['_score'] = sc_score_track(track)
            all_tracks.append(track)

    # Deduplicate by artist, keep highest scoring
    seen_artists = {}
    for track in sorted(all_tracks, key=lambda t: t['_score'], reverse=True):
        username = (track.get('user') or {}).get('username', '')
        if username and username not in seen_artists:
            seen_artists[username] = track

    top = list(seen_artists.values())[:limit]
    results = [sc_build_record(t, i + 1) for i, t in enumerate(top)]

    return jsonify({'tracks': results, 'total_scanned': len(seen_ids), 'returned': len(results)})


# ── Ayrshare publishing (Phase G) ─────────────────────────
# Single-account model — Doug's free dev tier. Multi-tenant deferred to deploy.
# See wiki/spec/ayrshare_publishing.md.

AYRSHARE_API_KEY = os.getenv('AYRSHARE_API_KEY')
AYRSHARE_BASE = 'https://api.ayrshare.com/api'
PLATFORM_MAP = {
    'ig': 'instagram',
    'facebook': 'facebook',
    'tiktok': 'tiktok',
    'reddit': 'reddit',
}
# Platforms that REQUIRE at least one media URL (image or video).
# Reddit allows text-only posts, so it's not in this set.
PLATFORMS_REQUIRE_MEDIA = {'ig', 'facebook', 'tiktok'}


def _ayr_headers():
    if not AYRSHARE_API_KEY:
        return None
    return {'Authorization': f'Bearer {AYRSHARE_API_KEY}', 'Content-Type': 'application/json'}


@app.route('/api/ayrshare/connect-url', methods=['GET'])
def ayrshare_connect_url():
    _, err = _require_user()
    if err: return err
    return jsonify({'url': 'https://app.ayrshare.com/social-accounts'})


@app.route('/api/ayrshare/profiles', methods=['GET'])
def ayrshare_profiles():
    _, err = _require_user()
    if err: return err
    if not AYRSHARE_API_KEY:
        return jsonify({'platforms': [], 'configured': False})
    try:
        r = http_requests.get(f'{AYRSHARE_BASE}/user', headers=_ayr_headers(), timeout=10)
        r.raise_for_status()
        data = r.json()
        return jsonify({
            'platforms': data.get('activeSocialAccounts') or data.get('socialAccounts') or [],
            'configured': True,
        })
    except Exception as e:
        print('ayrshare /user failed:', e)
        return jsonify({'platforms': [], 'configured': True, 'error': str(e)})


@app.route('/api/scheduled_posts', methods=['GET'])
def scheduled_posts_list():
    uid, err = _require_user()
    if err: return err
    sb = _stash_client()
    res = sb.table('scheduled_posts').select('*').eq('user_id', uid).order('scheduled_for', desc=False).execute()
    return jsonify({'posts': res.data})


@app.route('/api/scheduled_posts', methods=['POST'])
def scheduled_posts_create():
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    stash_item_id = body.get('stash_item_id')
    scheduled_for = body.get('scheduled_for')
    platforms = body.get('platforms') or ['ig']
    if not stash_item_id or not scheduled_for:
        return jsonify({'error': 'stash_item_id and scheduled_for required'}), 400

    sb = _stash_client()
    item = sb.table('stash_items').select('content,media_url,audio_track_id').eq('id', stash_item_id).eq('user_id', uid).execute()
    if not item.data:
        return jsonify({'error': 'stash item not found'}), 404
    snap = item.data[0]
    media_urls = [snap['media_url']] if snap.get('media_url') else []

    # Beat rights gate (scheduling step — the hard block). A post carrying audio
    # can only be scheduled if its track is a postable category with proof on
    # file; blocked/unclassified audio is refused so the campaign can't be
    # muted/struck retroactively. See wiki/features/firepit_beat.md.
    if snap.get('audio_track_id'):
        at = sb.table('audio_tracks').select(
            'rights_category,rights_proof_url,license_notes'
        ).eq('id', snap['audio_track_id']).eq('user_id', uid).execute()
        at_row = at.data[0] if at.data else {}
        ok, reason = _audio_rights_ok(
            at_row.get('rights_category'), at_row.get('rights_proof_url'), at_row.get('license_notes')
        )
        if not ok:
            return jsonify({
                'error': 'audio_rights_blocked',
                'detail': reason,
                'rights_category': at_row.get('rights_category'),
            }), 403

    # Validate: platforms requiring media reject if stash item is text-only.
    needs_media = [p for p in platforms if p in PLATFORMS_REQUIRE_MEDIA]
    if needs_media and not media_urls:
        return jsonify({
            'error': 'media_required',
            'detail': f'These platforms require an image or video: {", ".join(needs_media)}. Add media to the Stash item or pick a different platform.',
            'platforms': needs_media,
        }), 400

    row = {
        'user_id': uid,
        'stash_item_id': stash_item_id,
        'platforms': platforms,
        'scheduled_for': scheduled_for,
        'post_text': snap.get('content') or '',
        'media_urls': media_urls,
        'status': 'scheduled',
    }
    res = sb.table('scheduled_posts').insert(row).execute()
    return jsonify({'post': res.data[0] if res.data else None}), 201


@app.route('/api/scheduled_posts/<post_id>', methods=['PATCH'])
def scheduled_posts_update(post_id):
    uid, err = _require_user()
    if err: return err
    body = request.get_json() or {}
    patch = {}
    if 'scheduled_for' in body: patch['scheduled_for'] = body['scheduled_for']
    if 'platforms' in body: patch['platforms'] = body['platforms']
    if not patch:
        return jsonify({'error': 'nothing to update'}), 400

    sb = _stash_client()
    # If platforms changed, validate media requirements against existing row.
    if 'platforms' in patch:
        existing = sb.table('scheduled_posts').select('media_urls').eq('id', post_id).eq('user_id', uid).execute()
        if not existing.data:
            return jsonify({'error': 'not found'}), 404
        media_urls = existing.data[0].get('media_urls') or []
        needs_media = [p for p in patch['platforms'] if p in PLATFORMS_REQUIRE_MEDIA]
        if needs_media and not media_urls:
            return jsonify({
                'error': 'media_required',
                'detail': f'These platforms require an image or video: {", ".join(needs_media)}. Add media to the Stash item or pick a different platform.',
                'platforms': needs_media,
            }), 400

    res = sb.table('scheduled_posts').update(patch).eq('id', post_id).eq('user_id', uid).eq('status', 'scheduled').execute()
    return jsonify({'post': res.data[0] if res.data else None})


@app.route('/api/scheduled_posts/<post_id>', methods=['DELETE'])
def scheduled_posts_delete(post_id):
    uid, err = _require_user()
    if err: return err
    # Allow delete at any status so users can clear failed posts.
    # Posted ones can also be hidden from the calendar — Stripe-style "this
    # already happened, here's a record" is fine. The Ayrshare post stays
    # live regardless; we're only removing our scheduling record.
    sb = _stash_client()
    sb.table('scheduled_posts').delete().eq('id', post_id).eq('user_id', uid).execute()
    return jsonify({'ok': True})


def _ayr_rehost(media_url):
    """Download a media URL and re-upload to Ayrshare's CDN.
    Required for Instagram — Meta's fetchers can't reliably pull from
    Cloudflare-fronted Supabase Storage (error 440)."""
    img = http_requests.get(media_url, timeout=20)
    img.raise_for_status()
    fn = media_url.rsplit('/', 1)[-1] or 'media.jpg'
    mime = img.headers.get('content-type', 'image/jpeg').split(';')[0]
    r = http_requests.post(
        f'{AYRSHARE_BASE}/upload',
        headers={'Authorization': f'Bearer {AYRSHARE_API_KEY}'},
        files={'file': (fn, img.content, mime)},
        timeout=60,
    )
    r.raise_for_status()
    return r.json()['url']


_REDDIT_SUBREDDIT_CACHE = {'value': None, 'fetched': 0}

def _ayr_default_reddit_subreddit():
    """Pick a default subreddit = user's own profile (u_<username>).
    Cached for 1h to avoid extra /user calls on every post."""
    cache = _REDDIT_SUBREDDIT_CACHE
    if cache['value'] and (time.time() - cache['fetched']) < 3600:
        return cache['value']
    try:
        r = http_requests.get(f'{AYRSHARE_BASE}/user', headers=_ayr_headers(), timeout=10)
        for acc in r.json().get('displayNames') or []:
            if acc.get('platform') == 'reddit' and acc.get('username'):
                sub = f"u_{acc['username']}"
                cache.update(value=sub, fetched=time.time())
                return sub
    except Exception as e:
        print('[executor] could not resolve reddit username:', e)
    return None


def _ayr_extract_error(data, http_status):
    """Pull a human-readable error string from Ayrshare's response shape.
    Real per-platform errors live in data['errors'][]; the top-level
    error/message fields are often misleading."""
    errs = data.get('errors') or []
    if errs:
        return '; '.join(
            f"{e.get('platform','?')}: {e.get('message') or e.get('code') or '?'}"
            for e in errs
        )
    return data.get('error') or data.get('message') or f'http {http_status}'


def _fire_due_posts():
    """Find scheduled posts whose time has passed and fire them via Ayrshare.
    Run every 60s by APScheduler. Idempotent per row via status filter."""
    if not AYRSHARE_API_KEY:
        return
    sb = _stash_client()
    now_iso = datetime.now(timezone.utc).isoformat()
    res = sb.table('scheduled_posts').select('*').eq('status', 'scheduled').lte('scheduled_for', now_iso).limit(20).execute()
    due = res.data or []
    if not due:
        return
    print(f'[executor] {len(due)} due post(s)')
    for row in due:
        rid = row['id']
        try:
            ayr_platforms = [PLATFORM_MAP.get(p, p) for p in (row.get('platforms') or [])]
            media_urls = row.get('media_urls') or []
            post_text = row.get('post_text') or ''

            # Instagram needs media re-hosted on Ayrshare's CDN (Meta-reachable).
            if 'instagram' in ayr_platforms and media_urls:
                media_urls = [_ayr_rehost(u) for u in media_urls]

            payload = {
                'post': post_text,
                'platforms': ayr_platforms,
                'mediaUrls': media_urls,
                'idempotencyKey': rid,
            }

            # Reddit needs title + subreddit. Default subreddit = user profile.
            if 'reddit' in ayr_platforms:
                title = (post_text.strip().split('\n', 1)[0] or 'Sound Cave post')[:299]
                sub = _ayr_default_reddit_subreddit()
                if sub:
                    payload['redditOptions'] = {'title': title, 'subreddit': sub}

            r = http_requests.post(f'{AYRSHARE_BASE}/post', headers=_ayr_headers(), json=payload, timeout=60)
            data = r.json() if r.headers.get('content-type','').startswith('application/json') else {}
            ok = r.status_code == 200 and data.get('status') in ('success', 'scheduled') and not data.get('errors')
            if ok:
                ayr_id = data.get('id') or (data.get('postIds') or [{}])[0].get('postId')
                sb.table('scheduled_posts').update({
                    'status': 'posted',
                    'posted_at': datetime.now(timezone.utc).isoformat(),
                    'ayrshare_post_id': ayr_id,
                    'attempts': (row.get('attempts', 0) or 0) + 1,
                }).eq('id', rid).execute()
                print(f'  ✓ posted {rid} → ayr {ayr_id}')
            else:
                err_msg = _ayr_extract_error(data, r.status_code)
                sb.table('scheduled_posts').update({
                    'status': 'failed',
                    'error': str(err_msg)[:500],
                    'attempts': (row.get('attempts', 0) or 0) + 1,
                }).eq('id', rid).execute()
                print(f'  ✗ failed {rid}: {err_msg}')
        except Exception as e:
            sb.table('scheduled_posts').update({
                'status': 'failed',
                'error': str(e)[:500],
                'attempts': (row.get('attempts', 0) or 0) + 1,
            }).eq('id', rid).execute()
            print(f'  ✗ exception {rid}: {e}')


_executor_started = False


def _start_executor():
    """Start APScheduler once. Guarded against Flask debug-mode double-start and
    against being called twice (local __main__ + prod wsgi import)."""
    global _executor_started
    if _executor_started:
        return
    if app.debug and os.environ.get('WERKZEUG_RUN_MAIN') != 'true':
        return  # parent of debug reloader; child will start it
    from apscheduler.schedulers.background import BackgroundScheduler
    sched = BackgroundScheduler(daemon=True)
    sched.add_job(_fire_due_posts, 'interval', seconds=60, id='fire_due_posts',
                  max_instances=1, coalesce=True)
    sched.start()
    _executor_started = True
    print('[executor] APScheduler tick=60s started')


if __name__ == '__main__':
    port = int(os.getenv('CONTENT_API_PORT', 8000))
    print(f"🔥 Sound Cave API running on http://localhost:{port}")
    print(f"   Anthropic key: {'✅' if os.getenv('ANTHROPIC_API_KEY') else '❌'}")
    print(f"   SoundCloud:    {'✅' if SC_CLIENT_ID else '❌'}")
    img = provider_status()
    print(f"   Fal AI:        {'✅' if img['fal_ai'] else '❌'}")
    print(f"   Replicate:     {'✅' if img['replicate'] else '❌'}")
    print(f"   Stripe:        {'✅' if STRIPE_KEY else '❌ (set STRIPE_SECRET_KEY in .env)'}")
    print(f"   Ayrshare:      {'✅' if AYRSHARE_API_KEY else '❌ (set AYRSHARE_API_KEY in .env)'}")
    _start_executor()
    app.run(host='0.0.0.0', port=port, debug=True)
