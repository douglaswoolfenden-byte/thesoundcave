"""
The Sound Cave — Events API
Phase 2 endpoints for the Event entity and its lineup.

Spec: projects/thesoundcave/wiki/spec/phase_2_3_pivot.md
Source brief: ~/Downloads/Soundcave Phase 2.3 Mission.md
"""
from flask import Blueprint, jsonify, request

from sb_helpers import require_user, supabase

events_bp = Blueprint('events', __name__, url_prefix='/api/events')

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


@events_bp.route('/<event_id>', methods=['GET'])
def get_event(event_id):
    uid, err = require_user()
    if err:
        return err

    ev = (
        supabase()
        .table('events')
        .select(EVENT_COLS)
        .eq('id', event_id)
        .eq('owner_id', uid)
        .maybe_single()
        .execute()
    )
    if not ev.data:
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
    return jsonify({'event': _serialise_event(ev.data, slots.data or [])})


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
