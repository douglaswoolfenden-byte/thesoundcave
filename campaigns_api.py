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
from image_composer import compose_post_image, store_post_image
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
    'announcement': (
        "Reveal post. The first public moment. EVERY artist on the lineup MUST be named — "
        "headliner and all support acts. This is non-negotiable; the whole point of an "
        "announcement is the lineup reveal. Order the names by billing where natural. "
        "Tone: confident reveal."
    ),
    'headliner_spotlight': (
        "Spotlight on the headliner. Pick ONE compelling angle and write to it. "
        "Use their bio, genre tags, location, and any pinned tracks to ground the claim. "
        "Do NOT recite their whole career. Do NOT print follower numbers. "
        "If you have very little real data on them, write briefly and concretely "
        "rather than padding with vague hype."
    ),
    'support_spotlight': (
        "Spotlight on a support act. Same logic as headliner but lighter weight. "
        "One concrete reason to be excited, drawn from the data provided. "
        "If data is thin, one tight sentence is better than a paragraph of filler."
    ),
    'mid_campaign_push': "Two weeks out. Tickets still moving. Re-state the lineup, add some urgency without panic.",
    'countdown_7d': "One week to go. Tone: anticipation. What to look forward to. Avoid hype about the venue or scene at large.",
    'countdown_3d': "Three days out. Final push. Tickets going.",
    'countdown_1d': "Tomorrow night. Practical (door times, ID, what to bring) — but ONLY mention door times if the event data provides them.",
    'countdown_day_of': "Tonight. Short, urgent, last-call energy.",
    'day_of_doors': (
        "Doors open soon. Mention door open time ONLY if provided in the event data above. "
        "Do not invent set times, opening DJs, or who's playing first — that data isn't provided."
    ),
    'recap': "24 hours after. Gratitude + a moment from the night. Tone: warm reflection. Open the door to the next event without naming it.",
    'throwback': "Looking back at a moment. Use sparingly.",
    'ticket_push': "Tickets-only push. Direct.",
    'custom': "Custom post — purpose set by the operator.",
}


def _platform_targets_for(post_type):
    """v0: every post targets the same set. Refined post-MVP."""
    return ['instagram_grid', 'instagram_story', 'twitter']


def _selected_copy_text(post):
    """Pick the text that should appear in Stash for this post."""
    variants = post.get('copy_variants') or []
    sid = post.get('selected_copy_variant_id')
    for v in variants:
        if v.get('id') == sid:
            return v.get('text', '')
    return variants[0].get('text', '') if variants else ''


def _upsert_post_into_stash(uid, event, post, campaign_id):
    """Create or refresh a stash_items row for a campaign post.

    Stash items are how the existing Trail Map / scheduler discovers content.
    Bridge for Phase 3 -> publishing. One stash item per post; idempotent
    via metadata->>post_id lookup.
    """
    media_url = post.get('selected_image_url') or (post.get('image_asset_urls') or [None])[0]
    content = _selected_copy_text(post)
    metadata = {
        'source': 'campaign_post',
        'post_id': post['id'],
        'campaign_id': campaign_id,
        'event_id': event.get('id'),
        'event_name': event.get('name'),
        'post_type': post.get('post_type'),
        'scheduled_for': post.get('scheduled_for'),
    }

    sb = supabase()
    # Lookup existing stash row for this post (metadata->>post_id match)
    existing = sb.table('stash_items').select('id') \
        .eq('user_id', uid).eq('kind', 'image') \
        .contains('metadata', {'post_id': post['id']}) \
        .limit(1).execute()
    existing_id = (existing.data or [None])[0]

    row = {
        'user_id': uid,
        'kind': 'image',
        'content': content or None,
        'media_url': media_url,
        'prompt': f"campaign · {post.get('post_type', '').replace('_', ' ')}",
        'metadata': metadata,
    }
    if existing_id:
        sb.table('stash_items').update(row).eq('id', existing_id['id']).execute()
        return existing_id['id']
    inserted = sb.table('stash_items').insert(row).execute().data
    return inserted[0]['id'] if inserted else None


def _build_user_prompt(event, voice, post, profile, lineup_profiles=None):
    """Construct the user message for one post's copy generation.

    `lineup_profiles` is the full ordered list of artist_profiles dicts for
    this event's lineup (headliner first). Available to every post type so
    multi-artist posts (announcement, countdowns, recap) can name them.
    `profile` is the single artist for spotlight posts.
    """
    lines = [
        f"EVENT: {event.get('name')}",
        f"DATE: {event.get('event_date')}",
    ]
    if event.get('venue_name'):
        lines.append(f"VENUE: {event['venue_name']}" + (f", {event['venue_city']}" if event.get('venue_city') else ''))
    if event.get('ticketing_url'):
        lines.append("TICKETS: link in bio (do NOT print the URL itself in your output)")
    lines.append('')

    # Always include the full lineup. The model needs it for the announcement
    # and any multi-artist post type; spotlight posts get an extra focused block below.
    if lineup_profiles:
        lines.append('LINEUP (in billing order — headliner first):')
        for i, p in enumerate(lineup_profiles):
            tag = 'HEADLINER' if i == 0 else 'SUPPORT'
            line = f"  [{tag}] {p.get('display_name') or 'unknown'}"
            extras = []
            if p.get('genre_tags'):
                extras.append(', '.join(p['genre_tags']))
            if p.get('location'):
                extras.append(p['location'])
            if extras:
                line += f"  ({' · '.join(extras)})"
            lines.append(line)
        lines.append('')

    lines.append(f"POST TYPE: {post['post_type']}")
    lines.append(f"BRIEF: {POST_TYPE_BRIEFS.get(post['post_type'], '')}")
    lines.append(f"SCHEDULED: {post['scheduled_for']}")
    lines.append('')

    if profile:
        lines.append(f"SPOTLIGHT FOCUS — write THIS post primarily about: {profile.get('display_name')}")
        if profile.get('genre_tags'):
            lines.append(f"  Genres: {', '.join(profile['genre_tags'])}")
        if profile.get('location'):
            lines.append(f"  Based in: {profile['location']}")
        if profile.get('bio_short'):
            lines.append(f"  Bio: {profile['bio_short']}")
        if profile.get('soundcloud_url'):
            lines.append(f"  SoundCloud: {profile['soundcloud_url']}")
        # follower_count is intentionally omitted from the prompt — global rule
        # 3 forbids printing it in copy, and giving it to the model invites
        # leaks. The bio + genres + location are sufficient framing.
    lines.append('')

    lines.append(
        "Output format — STRICT:\n"
        "Return ONLY a JSON object matching this exact shape. No prose before. No prose after. "
        "No code fences. No commentary. No 'flagging' or 'noting' anything to the operator. "
        "If the data provided is insufficient for one of the variants, do your best with what's "
        "there and write a shorter variant — do NOT explain that to me in the output.\n"
        "{\n"
        '  "variants": [\n'
        '    {"id": "v1", "text": "<caption for Instagram, ≤600 chars>"},\n'
        '    {"id": "v2", "text": "<alternative angle, same constraints>"},\n'
        '    {"id": "v3", "text": "<third angle, same constraints>"}\n'
        '  ]\n'
        "}\n"
        "Three distinct angles — not three rewrites of the same line."
    )
    return '\n'.join(lines)


def _extract_first_json_object(s):
    """Pull the first balanced {...} block out of arbitrary text.

    Robust to: ```json fences, trailing prose ("FLAGGING SOMETHING…"),
    leading commentary, mixed quoting. Returns the substring or None.
    """
    if not s:
        return None
    start = s.find('{')
    if start < 0:
        return None
    depth = 0
    in_str = False
    esc = False
    for i in range(start, len(s)):
        c = s[i]
        if in_str:
            if esc:
                esc = False
            elif c == '\\':
                esc = True
            elif c == '"':
                in_str = False
            continue
        if c == '"':
            in_str = True
        elif c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return s[start:i + 1]
    return None


def _parse_variants_json(raw):
    """Best-effort parse of the model's variants JSON. Always returns a list."""
    if not raw or not raw.strip():
        return []

    block = _extract_first_json_object(raw)
    if block:
        try:
            parsed = json.loads(block)
            variants = parsed.get('variants') or parsed.get('VARIANTS') or []
            out = []
            for i, v in enumerate(variants):
                text = (v.get('text') or v.get('TEXT') or '').strip()
                if not text:
                    continue
                vid = v.get('id') or v.get('ID') or f'v{i + 1}'
                out.append({'id': vid, 'text': text})
            if out:
                return out
        except Exception:
            pass

    # Fallback: model returned something we can't parse. Don't dump
    # JSON-with-prose into the UI — return one clean text variant.
    return [{'id': 'v1', 'text': raw.strip()[:600]}]


def _generate_copy_for_post(event, voice, post, profile, lineup_profiles=None):
    """Call Claude for one post. Returns list of {id, text}. Raises on hard failure."""
    model = SONNET_MODEL if post['post_type'] in HERO_POST_TYPES else HAIKU_MODEL
    msg = _ai().messages.create(
        model=model,
        max_tokens=1024,
        system=system_prompt_for(voice),
        messages=[{'role': 'user', 'content': _build_user_prompt(event, voice, post, profile, lineup_profiles)}],
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
    # Ordered lineup of profile dicts (headliner first) — passed to every
    # post so the model can name artists even in non-spotlight posts.
    lineup_profiles = [s['artist_profiles'] for s in slots if s.get('artist_profiles')]

    # Resolve the brand kit for image gen — explicit on event, else primary
    brand_kit = None
    if event.get('brand_kit_id'):
        brand_kit = maybe_one(
            supabase().table('brand_kits').select('*').eq('id', event['brand_kit_id']).eq('user_id', uid)
        )
    if not brand_kit:
        brand_kit = maybe_one(
            supabase().table('brand_kits').select('*').eq('user_id', uid).eq('is_primary', True)
        )

    posts_created = []
    errors = []
    for plan_post in plan:
        profile = profiles_by_id.get(plan_post.get('linked_artist_profile_id')) if plan_post.get('linked_artist_profile_id') else None
        copy_err = None
        try:
            variants = _generate_copy_for_post(event, voice, plan_post, profile, lineup_profiles)
        except Exception as e:
            variants = []
            copy_err = str(e)
            errors.append({'post_type': plan_post['post_type'], 'error': copy_err})

        row = {
            'campaign_id': camp['id'],
            'post_type': plan_post['post_type'],
            'scheduled_for': plan_post['scheduled_for'].isoformat(),
            'target_platforms': _platform_targets_for(plan_post['post_type']),
            'linked_artist_profile_id': plan_post.get('linked_artist_profile_id'),
            'copy_variants': variants,
            'selected_copy_variant_id': variants[0]['id'] if variants else None,
            'publish_status': 'draft',
            'generation_error': copy_err,
        }
        inserted = supabase().table('posts').insert(row).execute().data
        if not inserted:
            continue
        post_row = inserted[0]

        # Image composition — brand-aware if references exist, else Pillow fallback.
        # Feed the post's selected copy into the image prompt so the canvas reflects it.
        copy_text = variants[0].get('text', '') if variants else ''
        try:
            png = compose_post_image(event, profile, plan_post['post_type'], brand_kit=brand_kit, campaign_id=camp['id'], generated_text=copy_text)
            image_url = store_post_image(uid, post_row['id'], png)
            supabase().table('posts').update({
                'image_asset_urls': [image_url],
                'selected_image_url': image_url,
            }).eq('id', post_row['id']).execute()
            post_row['image_asset_urls'] = [image_url]
            post_row['selected_image_url'] = image_url
        except Exception as e:
            errors.append({'post_type': plan_post['post_type'], 'error': f'image: {e}'})

        # Bridge to Stash so Trail Map can schedule the post
        try:
            _upsert_post_into_stash(uid, event, post_row, camp['id'])
        except Exception as e:
            print(f'[stash bridge] failed for post {post_row.get("id")}: {e}')

        posts_created.append(post_row)

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


@campaigns_bp.route('/api/campaigns/<campaign_id>/push-to-stash', methods=['POST'])
def push_campaign_to_stash(campaign_id):
    """Retroactively push every post in this campaign into stash_items.

    For campaigns generated before the auto-bridge landed. Idempotent —
    re-runs refresh the existing rows instead of duplicating.
    """
    uid, err = require_user()
    if err:
        return err

    camp = maybe_one(
        supabase().table('campaigns')
        .select('id, event_id, events(id, name, owner_id)')
        .eq('id', campaign_id)
    )
    if not camp or not camp.get('events') or camp['events'].get('owner_id') != uid:
        return jsonify({'error': 'not found'}), 404
    event = camp['events']

    posts = (
        supabase().table('posts').select('*').eq('campaign_id', campaign_id).order('scheduled_for').execute()
    ).data or []

    pushed = []
    failed = []
    for post in posts:
        try:
            sid = _upsert_post_into_stash(uid, event, post, campaign_id)
            if sid:
                pushed.append(sid)
        except Exception as e:
            failed.append({'post_id': post['id'], 'error': str(e)})

    return jsonify({'pushed': len(pushed), 'failed': failed, 'stash_item_ids': pushed})


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
    # Fetch the event's full lineup so regen has the same context as generate
    event_id_for_lineup = (post.get('campaigns') or {}).get('event_id') or event.get('id')
    lineup_profiles = []
    if event_id_for_lineup:
        slots = (
            supabase().table('lineup_slots')
            .select('artist_profile_id, billing_order, '
                    'artist_profiles(id, display_name, soundcloud_url, soundcloud_handle, bio_short, '
                    'genre_tags, location, follower_count_soundcloud, hero_image_url)')
            .eq('event_id', event_id_for_lineup).order('billing_order').execute()
        ).data or []
        lineup_profiles = [s['artist_profiles'] for s in slots if s.get('artist_profiles')]

    try:
        variants = _generate_copy_for_post(event, voice, plan_shape, profile, lineup_profiles)
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
