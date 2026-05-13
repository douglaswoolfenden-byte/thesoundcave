"""
The Sound Cave — Campaigns API (Phase 3 v0)

v0 SCOPE — copy generation only, synchronous, no images:
- POST /api/events/<id>/generate-campaign
    runs the template engine, calls Claude for each post sequentially,
    inserts campaigns + posts rows, returns the full nested payload.
    Takes ~15-30s for a 10-post campaign. Acceptable for v0.
- GET  /api/campaigns/<id>           — nested posts ordered by scheduled_for
- GET  /api/events/<id>/campaign     — convenience: campaign for this event
- POST /api/posts/<id>/regenerate-copy — re-run copy gen for one post

Spec: wiki/spec/phase_2_3_pivot.md
Brief: ~/Downloads/Soundcave Phase 2.3 Mission.md
"""
import json
import os
from datetime import datetime, timezone

import anthropic
from flask import Blueprint, jsonify, request

from campaign_template import build_campaign
from config.voice_presets import VOICE_PRESETS, system_prompt_for
from sb_helpers import maybe_one, require_user, supabase

campaigns_bp = Blueprint('campaigns', __name__)

HAIKU_MODEL = 'claude-haiku-4-5-20251001'
SONNET_MODEL = 'claude-sonnet-4-6'
HERO_POST_TYPES = {'announcement', 'headliner_spotlight', 'recap'}

_anthropic = None
def _ai():
    global _anthropic
    if _anthropic is None:
        _anthropic = anthropic.Anthropic(api_key=os.environ['ANTHROPIC_API_KEY'])
    return _anthropic


# ── Per-post-type briefing ─────────────────────────────────
POST_TYPE_BRIEFS = {
    'announcement': "Reveal post. The first public moment. Tone: confident reveal of the lineup and date. Lead with the headliner if striking; otherwise lead with the event itself.",
    'headliner_spotlight': "Spotlight on the headliner. Tell us why they're worth showing up for, using their bio + recent releases. Don't summarise their whole career — pick the most compelling angle.",
    'support_spotlight': "Spotlight on a support act. Same logic as headliner but with less weight. One specific reason to be excited.",
    'mid_campaign_push': "Two weeks out. Tickets still moving. Re-state the lineup, add some urgency without panic.",
    'countdown_7d': "One week to go. Tone: anticipation. What to look forward to.",
    'countdown_3d': "Three days out. Final push. Tickets going.",
    'countdown_1d': "Tomorrow night. Practical (door times, ID, what to bring).",
    'countdown_day_of': "Tonight. Short, urgent, last-call energy.",
    'day_of_doors': "Doors open soon — what's first up. Set times if known.",
    'recap': "24 hours after. Gratitude + a moment from the night. Tone: warm reflection. Open the door to the next event without naming it.",
    'throwback': "Looking back at a moment. Use sparingly.",
    'ticket_push': "Tickets-only push. Direct.",
    'custom': "Custom post — purpose set by the operator.",
}


def _platform_targets_for(post_type):
    """v0: every post targets the same set. Refined post-MVP."""
    return ['instagram_grid', 'instagram_story', 'twitter']


def _build_user_prompt(event, voice, post, profile):
    """Construct the user message for one post's copy generation."""
    lines = [
        f"EVENT: {event.get('name')}",
        f"DATE: {event.get('event_date')}",
    ]
    if event.get('venue_name'):
        lines.append(f"VENUE: {event['venue_name']}" + (f", {event['venue_city']}" if event.get('venue_city') else ''))
    if event.get('ticketing_url'):
        lines.append(f"TICKETS: {event['ticketing_url']}")
    lines.append('')
    lines.append(f"POST TYPE: {post['post_type']}")
    lines.append(f"BRIEF: {POST_TYPE_BRIEFS.get(post['post_type'], '')}")
    lines.append(f"SCHEDULED: {post['scheduled_for']}")
    lines.append('')

    if profile:
        lines.append(f"SPOTLIGHT ARTIST: {profile.get('display_name')}")
        if profile.get('genre_tags'):
            lines.append(f"  Genres: {', '.join(profile['genre_tags'])}")
        if profile.get('location'):
            lines.append(f"  Based in: {profile['location']}")
        if profile.get('bio_short'):
            lines.append(f"  Bio: {profile['bio_short']}")
        if profile.get('soundcloud_url'):
            lines.append(f"  SoundCloud: {profile['soundcloud_url']}")
        if profile.get('follower_count_soundcloud'):
            lines.append(f"  SoundCloud followers: {profile['follower_count_soundcloud']}")
    lines.append('')

    lines.append(
        "Return ONLY a JSON object — no prose, no markdown — with this shape:\n"
        "{\n"
        '  "variants": [\n'
        '    {"id": "v1", "text": "<caption for Instagram, ≤2200 chars>"},\n'
        '    {"id": "v2", "text": "<alternative angle, same constraints>"},\n'
        '    {"id": "v3", "text": "<third angle, same constraints>"}\n'
        '  ]\n'
        "}\n"
        "Three distinct angles — not three rewrites of the same line. "
        "Default target: Instagram caption. Keep each variant under 600 characters."
    )
    return '\n'.join(lines)


def _parse_variants_json(raw):
    s = raw.strip()
    if s.startswith('```'):
        s = s.strip('`')
        if s.lower().startswith('json'):
            s = s[4:].lstrip()
    try:
        parsed = json.loads(s)
        variants = parsed.get('variants') or []
        out = []
        for i, v in enumerate(variants):
            text = (v.get('text') or '').strip()
            if not text:
                continue
            out.append({'id': v.get('id') or f'v{i+1}', 'text': text})
        return out
    except Exception:
        return [{'id': 'v1', 'text': raw.strip()[:600]}] if raw.strip() else []


def _generate_copy_for_post(event, voice, post, profile):
    """Call Claude for one post. Returns list of {id, text}. Raises on hard failure."""
    model = SONNET_MODEL if post['post_type'] in HERO_POST_TYPES else HAIKU_MODEL
    msg = _ai().messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt_for(voice),
        messages=[{'role': 'user', 'content': _build_user_prompt(event, voice, post, profile)}],
    )
    raw = msg.content[0].text if msg.content else ''
    return _parse_variants_json(raw)


def _fetch_event_with_lineup(event_id, owner_id):
    ev = maybe_one(
        supabase().table('events')
        .select('*')
        .eq('id', event_id).eq('owner_id', owner_id)
    )
    if not ev:
        return None, None, None
    slots = (
        supabase().table('lineup_slots')
        .select('artist_profile_id, billing_position, billing_order, '
                'artist_profiles(id, display_name, soundcloud_url, soundcloud_handle, bio_short, '
                'genre_tags, location, follower_count_soundcloud, hero_image_url)')
        .eq('event_id', event_id).order('billing_order').execute()
    ).data or []
    profiles_by_id = {s['artist_profiles']['id']: s['artist_profiles'] for s in slots if s.get('artist_profiles')}
    return ev, slots, profiles_by_id


# ── Routes ────────────────────────────────────────────────

@campaigns_bp.route('/api/events/<event_id>/generate-campaign', methods=['POST'])
def generate_campaign(event_id):
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    regenerate = bool(body.get('regenerate'))

    event, slots, profiles_by_id = _fetch_event_with_lineup(event_id, uid)
    if not event:
        return jsonify({'error': 'event not found'}), 404

    # Check existing campaign — one-per-event in v0
    existing = maybe_one(
        supabase().table('campaigns').select('*').eq('event_id', event_id)
    )
    if existing and not regenerate:
        return jsonify({'error': 'campaign already exists; pass regenerate=true to rebuild', 'campaign_id': existing['id']}), 409
    if existing and regenerate:
        # Delete old campaign (cascades posts)
        supabase().table('campaigns').delete().eq('id', existing['id']).execute()

    # Plan posts
    event_dt = datetime.fromisoformat(event['event_date'].replace('Z', '+00:00'))
    plan = build_campaign(event_dt, slots)
    if not plan:
        return jsonify({'error': 'no posts to generate — event is in the past or lineup empty'}), 422

    voice = event.get('voice_preset') or 'professional'

    # Create campaign row
    started = datetime.now(timezone.utc).isoformat()
    camp = (
        supabase().table('campaigns').insert({
            'event_id': event_id,
            'status': 'generating',
            'voice_preset': voice,
            'generation_started_at': started,
        }).execute()
    ).data[0]

    # Generate each post sequentially. Insert as we go so the UI can poll
    # for progress in a future iteration.
    posts_created = []
    errors = []
    for plan_post in plan:
        profile = profiles_by_id.get(plan_post.get('linked_artist_profile_id')) if plan_post.get('linked_artist_profile_id') else None
        try:
            variants = _generate_copy_for_post(event, voice, plan_post, profile)
        except Exception as e:
            variants = []
            errors.append({'post_type': plan_post['post_type'], 'error': str(e)})

        row = {
            'campaign_id': camp['id'],
            'post_type': plan_post['post_type'],
            'scheduled_for': plan_post['scheduled_for'].isoformat(),
            'target_platforms': _platform_targets_for(plan_post['post_type']),
            'linked_artist_profile_id': plan_post.get('linked_artist_profile_id'),
            'copy_variants': variants,
            'selected_copy_variant_id': variants[0]['id'] if variants else None,
            'publish_status': 'draft',
            'generation_error': errors[-1]['error'] if errors and errors[-1]['post_type'] == plan_post['post_type'] else None,
        }
        inserted = supabase().table('posts').insert(row).execute().data
        if inserted:
            posts_created.append(inserted[0])

    # Finalise campaign
    completed = datetime.now(timezone.utc).isoformat()
    final_status = 'ready' if posts_created and not errors else ('ready' if posts_created else 'archived')
    supabase().table('campaigns').update({
        'status': final_status,
        'generation_completed_at': completed,
        'generation_error': '; '.join(e['error'] for e in errors[:3]) if errors else None,
    }).eq('id', camp['id']).execute()

    return jsonify({
        'campaign': {**camp, 'status': final_status, 'generation_completed_at': completed},
        'posts': posts_created,
        'errors': errors,
    })


@campaigns_bp.route('/api/campaigns/<campaign_id>', methods=['GET'])
def get_campaign(campaign_id):
    uid, err = require_user()
    if err:
        return err
    camp = maybe_one(
        supabase().table('campaigns')
        .select('*, events(id, owner_id, name, event_date, venue_name, venue_city, ticketing_url)')
        .eq('id', campaign_id)
    )
    if not camp:
        return jsonify({'error': 'not found'}), 404
    if not camp.get('events') or camp['events'].get('owner_id') != uid:
        return jsonify({'error': 'not found'}), 404
    posts = (
        supabase().table('posts').select('*').eq('campaign_id', campaign_id).order('scheduled_for').execute()
    ).data or []
    return jsonify({'campaign': camp, 'posts': posts})


@campaigns_bp.route('/api/events/<event_id>/campaign', methods=['GET'])
def get_campaign_for_event(event_id):
    uid, err = require_user()
    if err:
        return err
    # Confirm ownership
    ev = maybe_one(
        supabase().table('events').select('id, owner_id')
        .eq('id', event_id).eq('owner_id', uid)
    )
    if not ev:
        return jsonify({'error': 'event not found'}), 404
    camp = maybe_one(
        supabase().table('campaigns').select('*').eq('event_id', event_id)
    )
    if not camp:
        return jsonify({'campaign': None, 'posts': []})
    posts = (
        supabase().table('posts').select('*').eq('campaign_id', camp['id']).order('scheduled_for').execute()
    ).data or []
    return jsonify({'campaign': camp, 'posts': posts})


@campaigns_bp.route('/api/posts/<post_id>/regenerate-copy', methods=['POST'])
def regenerate_post_copy(post_id):
    uid, err = require_user()
    if err:
        return err
    # Fetch post + walk up to event for ownership check
    post = maybe_one(
        supabase().table('posts')
        .select('*, campaigns(id, event_id, voice_preset, events(id, owner_id, name, event_date, venue_name, venue_city, ticketing_url))')
        .eq('id', post_id)
    )
    if not post:
        return jsonify({'error': 'not found'}), 404
    event = post.get('campaigns', {}).get('events') or {}
    if event.get('owner_id') != uid:
        return jsonify({'error': 'not found'}), 404

    voice = post['campaigns'].get('voice_preset') or 'professional'
    profile = None
    if post.get('linked_artist_profile_id'):
        profile = maybe_one(
            supabase().table('artist_profiles').select('*').eq('id', post['linked_artist_profile_id'])
        )

    plan_shape = {
        'post_type': post['post_type'],
        'scheduled_for': post['scheduled_for'],
        'linked_artist_profile_id': post.get('linked_artist_profile_id'),
    }
    try:
        variants = _generate_copy_for_post(event, voice, plan_shape, profile)
    except Exception as e:
        return jsonify({'error': f'regeneration failed: {e}'}), 502

    updated = (
        supabase().table('posts').update({
            'copy_variants': variants,
            'selected_copy_variant_id': variants[0]['id'] if variants else None,
            'regeneration_count': (post.get('regeneration_count') or 0) + 1,
            'generation_error': None,
        }).eq('id', post_id).execute()
    ).data
    return jsonify({'post': (updated or [None])[0]})


@campaigns_bp.route('/api/posts/<post_id>', methods=['PATCH'])
def patch_post(post_id):
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}

    # Ownership check
    post = maybe_one(
        supabase().table('posts').select('id, campaigns(events(owner_id))').eq('id', post_id)
    )
    if not post or post.get('campaigns', {}).get('events', {}).get('owner_id') != uid:
        return jsonify({'error': 'not found'}), 404

    EDITABLE = {'selected_copy_variant_id', 'scheduled_for', 'target_platforms', 'publish_status', 'copy_variants'}
    update = {k: body[k] for k in body if k in EDITABLE}
    if not update:
        return jsonify({'error': 'no editable fields in body'}), 400
    res = supabase().table('posts').update(update).eq('id', post_id).execute()
    return jsonify({'post': (res.data or [None])[0]})
