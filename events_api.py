"""
The Sound Cave — Events API
Phase 2 endpoints for the Event entity and its lineup.

Spec: projects/thesoundcave/wiki/spec/phase_2_3_pivot.md
Source brief: ~/Downloads/Soundcave Phase 2.3 Mission.md
"""
import base64
import json
import os
import time

import anthropic
from flask import Blueprint, jsonify, request

from sb_helpers import maybe_one, require_user, supabase

events_bp = Blueprint('events', __name__, url_prefix='/api/events')

FLYER_BUCKET = 'event_flyers'
FLYER_ALLOWED_MIMES = {'image/png', 'image/jpeg', 'image/jpg', 'image/webp'}
FLYER_MAX_BYTES = 10 * 1024 * 1024  # 10 MB
EXTRACT_MODEL = 'claude-sonnet-4-6'

_anthropic = None
def _ai():
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    return _anthropic

ALLOWED_STATUS = {'draft', 'announced', 'sold_out', 'past'}
ALLOWED_VOICE = {'underground', 'professional', 'high_energy', 'intimate'}

EVENT_COLS = (
    'id, owner_id, name, event_date, venue_name, venue_city, ticketing_url, '
    'flyer_image_url, hero_track_url, status, voice_preset, '
    'brand_color_primary, brand_color_secondary, created_at, updated_at'
)


def _serialise_event(row, slots=None):
    out = dict(row)
    if slots is not None:
        out['lineup'] = slots
    return out


@events_bp.route('', methods=['GET'])
def list_events():
    uid, err = require_user()
    if err:
        return err
    res = (
        supabase()
        .table('events')
        .select(EVENT_COLS)
        .eq('owner_id', uid)
        .order('event_date', desc=False)
        .execute()
    )
    return jsonify({'events': res.data or []})


@events_bp.route('', methods=['POST'])
def create_event():
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}

    name = (body.get('name') or '').strip()
    event_date = body.get('event_date')
    if not name:
        return jsonify({'error': 'name is required'}), 400
    if not event_date:
        return jsonify({'error': 'event_date is required (ISO 8601)'}), 400

    status = body.get('status') or 'draft'
    if status not in ALLOWED_STATUS:
        return jsonify({'error': f'invalid status: {status}'}), 400
    voice = body.get('voice_preset') or 'professional'
    if voice not in ALLOWED_VOICE:
        return jsonify({'error': f'invalid voice_preset: {voice}'}), 400

    payload = {
        'owner_id': uid,
        'name': name,
        'event_date': event_date,
        'venue_name': body.get('venue_name'),
        'venue_city': body.get('venue_city'),
        'ticketing_url': body.get('ticketing_url'),
        'flyer_image_url': body.get('flyer_image_url'),
        'hero_track_url': body.get('hero_track_url'),
        'status': status,
        'voice_preset': voice,
        'brand_color_primary': body.get('brand_color_primary'),
        'brand_color_secondary': body.get('brand_color_secondary'),
    }
    res = supabase().table('events').insert(payload).execute()
    if not res.data:
        return jsonify({'error': 'insert failed'}), 500
    event = res.data[0]

    # Optional inline lineup: [{artist_profile_id, billing_position?, billing_order?, set_time?, set_notes?}]
    lineup = body.get('lineup') or []
    if isinstance(lineup, list) and lineup:
        slots = []
        for i, slot in enumerate(lineup):
            apid = slot.get('artist_profile_id')
            if not apid:
                continue
            slots.append({
                'event_id': event['id'],
                'artist_profile_id': apid,
                'billing_position': slot.get('billing_position', 'support'),
                'billing_order': slot.get('billing_order', i),
                'set_time': slot.get('set_time'),
                'set_notes': slot.get('set_notes'),
            })
        if slots:
            supabase().table('lineup_slots').insert(slots).execute()

    return jsonify({'event': event}), 201


EXTRACTION_PROMPT = """Extract event details from this flyer image. Return ONLY a JSON object with this exact shape — no prose, no markdown fences:

{
  "name": "<event name as it appears on the flyer; null if unclear>",
  "event_date": "<ISO 8601 datetime in 24h format, e.g. 2026-06-15T22:00:00; null if no date visible>",
  "venue_name": "<venue name; null if not on flyer>",
  "venue_city": "<city; null if not on flyer>",
  "ticketing_url": "<URL to buy tickets; null if not visible>",
  "lineup": ["Artist 1", "Artist 2", ...]
}

Rules:
- For event_date: if only a date is shown, use 22:00:00 as a sensible nightclub default; if you see a year nowhere, omit (return null)
- For lineup: ONE STRING per artist, exactly as printed. Preserve stylisation (caps, special chars, spacing). Do NOT include "live", "DJ set", "b2b", or set times. Skip the venue/promoter name.
- If the image isn't an event flyer or is unreadable, return {"name": null, "event_date": null, "venue_name": null, "venue_city": null, "ticketing_url": null, "lineup": []}
"""


@events_bp.route('/<event_id>/flyer', methods=['POST'])
def attach_flyer(event_id):
    """Upload a flyer to an existing event (no vision extraction).

    Multipart body: field 'file'.
    Returns: { flyer_image_url, event }
    """
    uid, err = require_user()
    if err:
        return err
    f = request.files.get('file')
    if f is None:
        return jsonify({'error': 'file field required'}), 400
    mime = (f.mimetype or '').lower()
    if mime not in FLYER_ALLOWED_MIMES:
        return jsonify({'error': f'unsupported type: {mime}'}), 400
    data = f.read()
    if not data:
        return jsonify({'error': 'empty file'}), 400
    if len(data) > FLYER_MAX_BYTES:
        return jsonify({'error': f'file exceeds {FLYER_MAX_BYTES // (1024*1024)}MB'}), 400

    # Ownership gate: confirm the event is the caller's
    ev = maybe_one(
        supabase().table('events').select('id, owner_id').eq('id', event_id).eq('owner_id', uid)
    )
    if not ev:
        return jsonify({'error': 'event not found'}), 404

    original = (f.filename or '').lower()
    ext = '.' + original.rsplit('.', 1)[1][:6] if '.' in original else '.jpg'
    object_path = f"{uid}/flyer_{int(time.time())}_{os.urandom(3).hex()}{ext}"
    try:
        supabase().storage.from_(FLYER_BUCKET).upload(
            path=object_path, file=data,
            file_options={'content-type': mime, 'upsert': 'true'},
        )
        flyer_image_url = supabase().storage.from_(FLYER_BUCKET).get_public_url(object_path)
    except Exception as e:
        return jsonify({'error': f'storage upload failed: {e}'}), 500

    res = (
        supabase().table('events').update({'flyer_image_url': flyer_image_url})
        .eq('id', event_id).eq('owner_id', uid).execute()
    )
    return jsonify({'flyer_image_url': flyer_image_url, 'event': (res.data or [None])[0]})


@events_bp.route('/extract-flyer', methods=['POST'])
def extract_flyer():
    """Upload a flyer + extract event details via Claude Sonnet vision.

    Multipart body: field 'file' = the flyer image.
    Returns: { flyer_image_url, extracted: {name, event_date, venue_name, venue_city, ticketing_url, lineup: [...]} }
    Does NOT create an Event row — the client uses the extracted values to prefill the create-event form.
    """
    uid, err = require_user()
    if err:
        return err
    f = request.files.get('file')
    if f is None:
        return jsonify({'error': 'file field required'}), 400
    mime = (f.mimetype or '').lower()
    if mime not in FLYER_ALLOWED_MIMES:
        return jsonify({'error': f'unsupported type: {mime}'}), 400
    data = f.read()
    if not data:
        return jsonify({'error': 'empty file'}), 400
    if len(data) > FLYER_MAX_BYTES:
        return jsonify({'error': f'file exceeds {FLYER_MAX_BYTES // (1024*1024)}MB'}), 400

    # Upload to storage first so we have a URL to attach to the event later.
    original = (f.filename or '').lower()
    ext = '.' + original.rsplit('.', 1)[1][:6] if '.' in original else ''
    object_path = f"{uid}/flyer_{int(time.time())}_{os.urandom(3).hex()}{ext or '.jpg'}"
    try:
        supabase().storage.from_(FLYER_BUCKET).upload(
            path=object_path,
            file=data,
            file_options={'content-type': mime, 'upsert': 'true'},
        )
        flyer_image_url = supabase().storage.from_(FLYER_BUCKET).get_public_url(object_path)
    except Exception as e:
        return jsonify({'error': f'storage upload failed: {e}'}), 500

    # Vision call
    b64 = base64.standard_b64encode(data).decode('ascii')
    media_type = 'image/jpeg' if mime in ('image/jpg', 'image/jpeg') else mime
    try:
        msg = _ai().messages.create(
            model=EXTRACT_MODEL,
            max_tokens=1024,
            messages=[{
                'role': 'user',
                'content': [
                    {'type': 'image', 'source': {'type': 'base64', 'media_type': media_type, 'data': b64}},
                    {'type': 'text', 'text': EXTRACTION_PROMPT},
                ],
            }],
        )
        raw = msg.content[0].text if msg.content else ''
    except anthropic.APIError as e:
        return jsonify({'error': f'extraction failed: {e}', 'flyer_image_url': flyer_image_url}), 502

    # Parse the JSON the model returned. Strip code fences if any.
    s = raw.strip()
    if s.startswith('```'):
        s = s.strip('`')
        if s.lower().startswith('json'):
            s = s[4:].lstrip()
    try:
        extracted = json.loads(s)
    except Exception:
        return jsonify({
            'error': 'model returned non-JSON',
            'flyer_image_url': flyer_image_url,
            'raw': raw[:500],
        }), 502

    # Normalise: ensure lineup is a list of strings
    extracted['lineup'] = [str(x).strip() for x in (extracted.get('lineup') or []) if str(x).strip()]

    return jsonify({'flyer_image_url': flyer_image_url, 'extracted': extracted})


@events_bp.route('/<event_id>', methods=['GET'])
def get_event(event_id):
    uid, err = require_user()
    if err:
        return err

    ev_data = maybe_one(
        supabase()
        .table('events')
        .select(EVENT_COLS)
        .eq('id', event_id)
        .eq('owner_id', uid)
    )
    if not ev_data:
        return jsonify({'error': 'not found'}), 404

    slots = (
        supabase()
        .table('lineup_slots')
        .select(
            'id, artist_profile_id, billing_position, billing_order, set_time, set_notes, '
            'artist_profiles(id, display_name, soundcloud_handle, hero_image_url, follower_count_soundcloud)'
        )
        .eq('event_id', event_id)
        .order('billing_order')
        .execute()
    )
    return jsonify({'event': _serialise_event(ev_data, slots.data or [])})


@events_bp.route('/<event_id>', methods=['PATCH'])
def patch_event(event_id):
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}

    EDITABLE = {
        'name', 'event_date', 'venue_name', 'venue_city', 'ticketing_url',
        'flyer_image_url', 'hero_track_url', 'status', 'voice_preset',
        'brand_color_primary', 'brand_color_secondary',
    }
    update = {k: body[k] for k in body if k in EDITABLE}
    if 'status' in update and update['status'] not in ALLOWED_STATUS:
        return jsonify({'error': f'invalid status: {update["status"]}'}), 400
    if 'voice_preset' in update and update['voice_preset'] not in ALLOWED_VOICE:
        return jsonify({'error': f'invalid voice_preset: {update["voice_preset"]}'}), 400
    if not update:
        return jsonify({'error': 'no editable fields in body'}), 400

    res = (
        supabase()
        .table('events')
        .update(update)
        .eq('id', event_id)
        .eq('owner_id', uid)
        .execute()
    )
    if not res.data:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'event': res.data[0]})


@events_bp.route('/<event_id>', methods=['DELETE'])
def delete_event(event_id):
    uid, err = require_user()
    if err:
        return err
    res = (
        supabase()
        .table('events')
        .delete()
        .eq('id', event_id)
        .eq('owner_id', uid)
        .execute()
    )
    if not res.data:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'deleted': res.data[0]['id']})
