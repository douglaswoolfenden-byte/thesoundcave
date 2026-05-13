"""
The Sound Cave — Artist Profiles API
Phase 2 endpoints for the artist_profiles table.

Spec: projects/thesoundcave/wiki/spec/phase_2_3_pivot.md
"""
from flask import Blueprint, jsonify, request

from sb_helpers import require_user, supabase
import soundcloud_helpers as sc

artist_profiles_bp = Blueprint('artist_profiles', __name__, url_prefix='/api/artist-profiles')

PROFILE_COLS = (
    'id, display_name, soundcloud_handle, soundcloud_url, spotify_url, '
    'instagram_handle, other_socials, bio_short, bio_long, genre_tags, location, '
    'hero_image_url, gallery_image_urls, pinned_track_urls, '
    'follower_count_soundcloud, claimed, claimed_by_user_id, '
    'last_scraped_at, created_at, updated_at'
)


def _scrape_and_upsert(handle):
    """Resolve a SoundCloud handle, upsert artist_profiles by handle. Returns row or None."""
    user = sc.resolve_user(handle)
    if not user or not user.get('id'):
        return None
    payload = sc.user_to_profile_payload(user)
    if not payload.get('soundcloud_handle'):
        return None
    payload['last_scraped_at'] = 'now()'  # supabase-py serialises strings; use ISO instead

    # Use ISO timestamp for last_scraped_at — supabase-py won't interpret 'now()'.
    from datetime import datetime, timezone
    payload['last_scraped_at'] = datetime.now(timezone.utc).isoformat()

    res = (
        supabase()
        .table('artist_profiles')
        .upsert(payload, on_conflict='soundcloud_handle')
        .execute()
    )
    return (res.data or [None])[0]


@artist_profiles_bp.route('', methods=['POST'])
def create_manual_stub():
    """Create a name-only artist_profiles stub for artists with no SoundCloud presence.

    Body: { "display_name": "DJ Anonymous", "genre_tags": ["techno"]?, "location": "..."? }
    """
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    name = (body.get('display_name') or '').strip()
    if not name:
        return jsonify({'error': 'display_name is required'}), 400
    payload = {
        'display_name': name,
        'genre_tags': body.get('genre_tags') or [],
        'location': body.get('location'),
        'claimed': False,
    }
    res = supabase().table('artist_profiles').insert(payload).execute()
    if not res.data:
        return jsonify({'error': 'insert failed'}), 500
    return jsonify({'profile': res.data[0]}), 201


@artist_profiles_bp.route('', methods=['GET'])
def list_profiles():
    uid, err = require_user()
    if err:
        return err
    q = (request.args.get('q') or '').strip().lower()
    limit = min(int(request.args.get('limit', '50') or 50), 200)

    builder = supabase().table('artist_profiles').select(PROFILE_COLS).limit(limit)
    if q:
        builder = builder.ilike('display_name', f'%{q}%')
    res = builder.order('follower_count_soundcloud', desc=True).execute()
    return jsonify({'profiles': res.data or []})


@artist_profiles_bp.route('/<profile_id>', methods=['GET'])
def get_profile(profile_id):
    uid, err = require_user()
    if err:
        return err
    res = (
        supabase()
        .table('artist_profiles')
        .select(PROFILE_COLS)
        .eq('id', profile_id)
        .maybe_single()
        .execute()
    )
    if not res.data:
        return jsonify({'error': 'not found'}), 404
    return jsonify({'profile': res.data})


@artist_profiles_bp.route('/match', methods=['POST'])
def match_artist():
    """Given a name string, return top candidates from local profiles + SoundCloud search.

    Body: { "name": "LØSERWARE", "limit": 3 (optional, default 3) }
    Returns: { "name": ..., "local": [...], "soundcloud": [...] }
    """
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    name = (body.get('name') or '').strip()
    if not name:
        return jsonify({'error': 'name is required'}), 400
    limit = min(int(body.get('limit') or 3), 5)

    # 1. Exact match against existing artist_profiles (case-insensitive)
    local_exact = (
        supabase()
        .table('artist_profiles')
        .select(PROFILE_COLS)
        .ilike('display_name', name)
        .limit(limit)
        .execute()
    ).data or []

    # 2. Fuzzy: substring match (Postgres trigram would be better; LIKE for now)
    local_fuzzy = []
    if not local_exact:
        local_fuzzy = (
            supabase()
            .table('artist_profiles')
            .select(PROFILE_COLS)
            .ilike('display_name', f'%{name}%')
            .limit(limit)
            .execute()
        ).data or []

    local = local_exact or local_fuzzy

    # 3. SoundCloud search for fresh candidates (always run — local profiles
    #    may be stale or missing)
    sc_users = sc.search_users(name, limit=limit)
    candidates = []
    for u in sc_users:
        top = None
        tracks = sc.fetch_user_tracks(u.get('id'), limit=1)
        if tracks:
            t = tracks[0]
            top = {
                'title': t.get('title'),
                'url': t.get('permalink_url'),
                'artwork_url': t.get('artwork_url'),
                'playback_count': t.get('playback_count') or 0,
            }
        candidates.append(sc.candidate_summary(u, top_track=top))

    return jsonify({'name': name, 'local': local, 'soundcloud': candidates})


@artist_profiles_bp.route('/scrape', methods=['POST'])
def scrape_profile():
    """Given a SoundCloud handle or URL, scrape and upsert a stub profile.

    Body: { "handle": "loserwaremusic" }  OR  { "url": "https://soundcloud.com/loserwaremusic" }
    """
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    handle = (body.get('handle') or '').strip()
    if not handle and body.get('url'):
        handle = sc.handle_from_url(body['url']) or ''
    if not handle:
        return jsonify({'error': 'handle or url is required'}), 400

    row = _scrape_and_upsert(handle)
    if not row:
        return jsonify({'error': f'could not resolve handle: {handle}'}), 404
    return jsonify({'profile': row})


@artist_profiles_bp.route('/<profile_id>', methods=['PATCH'])
def patch_profile(profile_id):
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}

    EDITABLE = {
        'display_name', 'spotify_url', 'instagram_handle', 'other_socials',
        'bio_short', 'bio_long', 'genre_tags', 'location',
        'hero_image_url', 'gallery_image_urls', 'pinned_track_urls',
    }
    update = {k: body[k] for k in body if k in EDITABLE}
    if not update:
        return jsonify({'error': 'no editable fields in body'}), 400

    # Phase 2: only the claimer can edit. Service role bypasses RLS so we
    # enforce in code. Until claim flow lands (Phase 4), the only writers
    # should be the scrape endpoint (service-role) and admin tools.
    row = (
        supabase()
        .table('artist_profiles')
        .select('claimed_by_user_id')
        .eq('id', profile_id)
        .maybe_single()
        .execute()
    ).data
    if not row:
        return jsonify({'error': 'not found'}), 404
    if row.get('claimed_by_user_id') and row['claimed_by_user_id'] != uid:
        return jsonify({'error': 'profile claimed by another user'}), 403

    res = (
        supabase()
        .table('artist_profiles')
        .update(update)
        .eq('id', profile_id)
        .execute()
    )
    return jsonify({'profile': (res.data or [None])[0]})
