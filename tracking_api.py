"""
Tracking API — Clan Data Tracking v2 endpoints.

Spec: wiki/spec/clan_data_tracking_v2.md (approved 2026-06-11).
Serves the Supabase artist_snapshots time-series to the frontend.
GET /snapshots deliberately mirrors the old static data/snapshots/*.json
shape ({date, artists: {key: {...}}}) so every chart consumer cuts over
without changes. Auth pattern mirrors roster_api.py. Apply
db/0019_artist_tracking.sql before use, or these endpoints 500.
"""
import threading
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request

from sb_helpers import require_user, supabase
from soundcloud_helpers import handle_from_url, resolve_user
from tracking_collector import run_daily_snapshot

tracking_bp = Blueprint('tracking', __name__, url_prefix='/api/tracking')


def _user_artist_keys(sb, uid):
    """The caller's Clan (active) ∪ Watching artist keys."""
    keys = set()
    rows = (
        sb.table('roster').select('artist_username')
        .eq('user_id', uid).eq('status', 'active').execute()
    ).data or []
    keys.update((r.get('artist_username') or '').strip() for r in rows)
    prefs = (
        sb.table('roster_prefs').select('watching').eq('user_id', uid).execute()
    ).data or []
    for p in prefs:
        keys.update((k or '').strip() for k in (p.get('watching') or []))
    keys.discard('')
    return keys


@tracking_bp.route('/artists', methods=['POST'])
def register_artist():
    """Register an artist for tracking at add-to-Clan/watch time.
    Body: {username, artist_url?, display_name?, genre?, avatar_url?}.
    Resolves the stable numeric SoundCloud id synchronously (1 API call)."""
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    key = (body.get('username') or '').strip()
    if not key:
        return jsonify({'error': 'username required'}), 400

    sb = supabase()
    sb.table('tracked_artists').upsert({
        'artist_key': key,
        'display_name': body.get('display_name') or key,
        'genre': body.get('genre'),
        'avatar_url': body.get('avatar_url'),
        'permalink_url': body.get('artist_url'),
        'active': True,
    }, on_conflict='artist_key').execute()

    row = (
        sb.table('tracked_artists').select('*').eq('artist_key', key).execute()
    ).data[0]
    if row.get('resolve_status') != 'ok':
        target = row.get('permalink_url') or (key if ' ' not in key else None)
        user = resolve_user(target) if target else None
        if user and user.get('id'):
            updates = {
                'soundcloud_user_id': user['id'],
                'permalink': user.get('permalink') or handle_from_url(user.get('permalink_url') or ''),
                'permalink_url': user.get('permalink_url') or row.get('permalink_url'),
                'display_name': user.get('username') or row.get('display_name'),
                'resolve_status': 'ok',
                'resolve_error': None,
            }
        else:
            updates = {
                'resolve_status': 'failed',
                'resolve_error': f'resolve failed for {target}' if target
                                 else 'no artist_url and key is not a permalink',
            }
        sb.table('tracked_artists').update(updates).eq('id', row['id']).execute()
        row.update(updates)
    return jsonify({
        'artist_key': key,
        'resolve_status': row.get('resolve_status'),
        'soundcloud_user_id': row.get('soundcloud_user_id'),
    }), 200


@tracking_bp.route('/snapshots', methods=['GET'])
def get_snapshots():
    """Time-series for the caller's Clan ∪ Watching, in the legacy static-file
    shape: {snapshots: [{date, artists: {key: {...metrics}}}, ...]} ascending.
    failed rows are omitted (the frontend's `|| 0` would turn NULLs into fake
    zero-dips); api rows win over screenshot rows for the same day."""
    uid, err = require_user()
    if err:
        return err
    days = min(int(request.args.get('days', 120) or 120), 730)
    sb = supabase()

    keys = _user_artist_keys(sb, uid)
    if not keys:
        return jsonify({'snapshots': []})

    tracked = (
        sb.table('tracked_artists')
        .select('id, artist_key, display_name, genre, avatar_url')
        .in_('artist_key', sorted(keys)).execute()
    ).data or []
    by_id = {t['id']: t for t in tracked}
    if not by_id:
        return jsonify({'snapshots': []})

    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    rows = (
        sb.table('artist_snapshots').select('*')
        .in_('artist_id', list(by_id.keys()))
        .eq('platform', 'soundcloud')
        .neq('fetch_status', 'failed')
        .gte('snapshot_date', cutoff)
        .order('snapshot_date').execute()
    ).data or []

    by_date = {}
    for r in rows:
        t = by_id[r['artist_id']]
        day = by_date.setdefault(r['snapshot_date'], {})
        if t['artist_key'] in day and r['source'] != 'api':
            continue  # api beats screenshot for the same day
        day[t['artist_key']] = {
            'display_name': t.get('display_name') or t['artist_key'],
            'genre': t.get('genre') or '',
            'followers': r.get('followers') or 0,
            'following': r.get('following') or 0,
            'track_count': r.get('track_count') or 0,
            'total_plays': r.get('total_plays') or 0,
            'total_likes': r.get('total_likes') or 0,
            'total_reposts': r.get('total_reposts') or 0,
            'avatar_url': t.get('avatar_url') or '',
            'latest_track': r.get('latest_track'),
            'fetch_status': r.get('fetch_status'),
            'source': r.get('source'),
        }
    snapshots = [
        {'date': d, 'artist_count': len(a), 'artists': a}
        for d, a in sorted(by_date.items())
    ]
    return jsonify({'snapshots': snapshots})


@tracking_bp.route('/artist/<key>/series', methods=['GET'])
def get_artist_series(key):
    """All snapshot rows for one artist (every platform/source/status) —
    powers per-artist charts incl. screenshot-sourced points and gap display."""
    uid, err = require_user()
    if err:
        return err
    sb = supabase()
    if key not in _user_artist_keys(sb, uid):
        return jsonify({'error': 'artist not in your Clan or Watching'}), 404
    tracked = (
        sb.table('tracked_artists').select('*').eq('artist_key', key).execute()
    ).data or []
    if not tracked:
        return jsonify({'artist': None, 'series': []})
    t = tracked[0]
    days = min(int(request.args.get('days', 365) or 365), 1095)
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    rows = (
        sb.table('artist_snapshots').select('*')
        .eq('artist_id', t['id']).gte('snapshot_date', cutoff)
        .order('snapshot_date').execute()
    ).data or []
    return jsonify({
        'artist': {
            'artist_key': t['artist_key'],
            'display_name': t.get('display_name'),
            'permalink_url': t.get('permalink_url'),
            'soundcloud_user_id': t.get('soundcloud_user_id'),
            'resolve_status': t.get('resolve_status'),
        },
        'series': rows,
    })


@tracking_bp.route('/artist/<key>/live', methods=['GET'])
def get_artist_live(key):
    """Live current stats for one artist, fetched by the STABLE numeric id
    (never the display-name resolve). Powers the Footprints headline so it
    matches soundcloud.com exactly; the chart underneath stays daily history."""
    uid, err = require_user()
    if err:
        return err
    sb = supabase()
    if key not in _user_artist_keys(sb, uid):
        return jsonify({'error': 'artist not in your Clan or Watching'}), 404
    rows = (
        sb.table('tracked_artists').select('soundcloud_user_id, resolve_status')
        .eq('artist_key', key).execute()
    ).data or []
    if not rows or not rows[0].get('soundcloud_user_id'):
        return jsonify({'error': 'artist not resolved'}), 404
    from tracking_collector import fetch_artist_stats
    metrics, status, ferr = fetch_artist_stats(rows[0]['soundcloud_user_id'])
    if not metrics:
        return jsonify({'error': ferr or 'fetch failed', 'fetch_status': status}), 502
    return jsonify({
        'followers':   metrics['followers'],
        'plays':       metrics['total_plays'],
        'likes':       metrics['total_likes'],
        'reposts':     metrics['total_reposts'],
        'track_count': metrics['track_count'],
        'fetch_status': status,
    })


@tracking_bp.route('/run', methods=['POST'])
def trigger_run():
    """Manual collection run (background thread; check /runs for the result)."""
    uid, err = require_user()
    if err:
        return err
    threading.Thread(
        target=run_daily_snapshot, kwargs={'trigger': 'manual'}, daemon=True,
    ).start()
    return jsonify({'started': True}), 202


@tracking_bp.route('/runs', methods=['GET'])
def list_runs():
    uid, err = require_user()
    if err:
        return err
    limit = min(int(request.args.get('limit', 10) or 10), 50)
    rows = (
        supabase().table('snapshot_runs').select('*')
        .order('started_at', desc=True).limit(limit).execute()
    ).data or []
    return jsonify({'runs': rows})
