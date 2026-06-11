"""
Clan Data Tracking v2 — daily snapshot collector.

Spec: wiki/spec/clan_data_tracking_v2.md (approved 2026-06-11).
Replaces clan_tracker.py's broken pipeline: identity is the stable numeric
SoundCloud user id (resolved once from artist_url, never from display names),
every request retries with backoff, and a failed fetch stores NULL metrics
with fetch_status='failed' — NEVER zeros.

Runs inside content_api's APScheduler (see _start_executor) on Railway:
a daily cron plus an hourly catch-up that no-ops once today's run completed.
Per-artist upserts keyed on (artist_id, snapshot_date, platform, source)
make interrupted runs resumable.
"""
from datetime import datetime, timezone

from sb_helpers import supabase
from soundcloud_helpers import (
    fetch_user_by_id, handle_from_url, request_with_retry, resolve_user,
)

MAX_TRACKS = 500
MAX_PAGES = 10
PLATFORM = 'soundcloud'
SOURCE = 'api'

# Status quality ranking: never overwrite a better row with a worse one
# (e.g. a catch-up retry that fails must not blank an earlier partial fetch).
_RANK = {'ok': 2, 'partial': 1, 'failed': 0}


def _today():
    return datetime.now(timezone.utc).date().isoformat()


# ---------------------------------------------------------------- registry

def sync_registry(sb):
    """Union all users' Clan (roster, status=active) + Watching into
    tracked_artists; resolve pending rows to a numeric SoundCloud user id.
    Returns a summary dict (counts + per-artist resolve errors)."""
    summary = {'union': 0, 'resolved': 0, 'resolve_failed': [], 'deactivated': 0}

    rows = (
        sb.table('roster')
        .select('artist_username, display_name, genre, avatar_url, artist_url')
        .eq('status', 'active').execute()
    ).data or []
    union = {}
    for r in rows:
        key = (r.get('artist_username') or '').strip()
        if key and key not in union:
            union[key] = r

    prefs = sb.table('roster_prefs').select('watching').execute().data or []
    for p in prefs:
        for key in (p.get('watching') or []):
            key = (key or '').strip()
            if key and key not in union:
                union[key] = {'artist_username': key}

    summary['union'] = len(union)
    if not union:
        return summary

    existing = {
        t['artist_key']: t for t in (
            sb.table('tracked_artists').select('*').execute().data or []
        )
    }

    for key, src in union.items():
        cur = existing.get(key)
        if not cur:
            sb.table('tracked_artists').upsert({
                'artist_key': key,
                'display_name': src.get('display_name') or key,
                'genre': src.get('genre'),
                'avatar_url': src.get('avatar_url'),
                'permalink_url': src.get('artist_url'),
                'active': True,
            }, on_conflict='artist_key').execute()
        else:
            updates = {}
            if not cur.get('active'):
                updates['active'] = True
            # A roster row gaining an artist_url can unblock a failed resolve.
            if src.get('artist_url') and not cur.get('permalink_url'):
                updates['permalink_url'] = src['artist_url']
                if cur.get('resolve_status') == 'failed':
                    updates['resolve_status'] = 'pending'
            if updates:
                sb.table('tracked_artists').update(updates).eq('id', cur['id']).execute()

    # Stop tracking artists that left Clan + Watching (history rows stay).
    for key, cur in existing.items():
        if key not in union and cur.get('active'):
            sb.table('tracked_artists').update({'active': False}).eq('id', cur['id']).execute()
            summary['deactivated'] += 1

    # Resolve pending identities: artist_url → /resolve → numeric user id.
    pending = (
        sb.table('tracked_artists').select('*')
        .eq('active', True).neq('resolve_status', 'ok').execute()
    ).data or []
    for t in pending:
        url = t.get('permalink_url')
        # Without a URL, a bare key only works when it IS the permalink
        # (no spaces) — display names with spaces/unicode are what broke v1.
        target = url or (t['artist_key'] if ' ' not in t['artist_key'] else None)
        if not target:
            sb.table('tracked_artists').update({
                'resolve_status': 'failed',
                'resolve_error': 'no artist_url and key is not a permalink',
            }).eq('id', t['id']).execute()
            summary['resolve_failed'].append(t['artist_key'])
            continue
        user = resolve_user(target)
        if user and user.get('id'):
            sb.table('tracked_artists').update({
                'soundcloud_user_id': user['id'],
                'permalink': user.get('permalink') or handle_from_url(user.get('permalink_url') or ''),
                'permalink_url': user.get('permalink_url') or url,
                'display_name': user.get('username') or t.get('display_name'),
                'avatar_url': user.get('avatar_url') or t.get('avatar_url'),
                'resolve_status': 'ok',
                'resolve_error': None,
            }).eq('id', t['id']).execute()
            summary['resolved'] += 1
        else:
            sb.table('tracked_artists').update({
                'resolve_status': 'failed',
                'resolve_error': f'resolve failed for {target}',
            }).eq('id', t['id']).execute()
            summary['resolve_failed'].append(t['artist_key'])
    return summary


# ---------------------------------------------------------------- fetching

def fetch_artist_stats(sc_user_id):
    """Fetch profile + full own-track catalogue for one artist.
    Returns (metrics_or_none, status, error_or_none); status is ok|partial|failed.
    failed ⇒ metrics is None. partial ⇒ pagination truncated (flagged)."""
    profile, err = fetch_user_by_id(sc_user_id)
    if not profile:
        return None, 'failed', err or 'profile fetch failed'

    tracks, pages, truncated = [], 0, False
    url = f'https://api.soundcloud.com/users/{sc_user_id}/tracks'
    params = {'limit': 200, 'linked_partitioning': 'true'}
    while url and pages < MAX_PAGES and len(tracks) < MAX_TRACKS:
        data, page_err = request_with_retry(url, params=params)
        if data is None:
            truncated = True
            break
        pages += 1
        batch = data.get('collection', data if isinstance(data, list) else [])
        tracks.extend(batch or [])
        url = data.get('next_href') if isinstance(data, dict) else None
        params = None  # next_href already carries the cursor

    def _likes(t):
        return t.get('likes_count') or t.get('favoritings_count') or 0

    ranked = sorted(tracks, key=lambda t: t.get('playback_count') or 0, reverse=True)
    top_tracks = [{
        'id': t.get('id'),
        'title': t.get('title'),
        'plays': t.get('playback_count') or 0,
        'likes': _likes(t),
        'reposts': t.get('reposts_count') or 0,
        'permalink_url': t.get('permalink_url'),
    } for t in ranked[:10]]

    latest = max(tracks, key=lambda t: t.get('created_at') or '', default=None)
    metrics = {
        'followers': profile.get('followers_count') or 0,
        'following': profile.get('followings_count') or 0,
        'track_count': profile.get('track_count') or 0,
        'total_plays': sum(t.get('playback_count') or 0 for t in tracks),
        'total_likes': sum(_likes(t) for t in tracks),
        'total_reposts': sum(t.get('reposts_count') or 0 for t in tracks),
        'total_comments': sum(t.get('comment_count') or 0 for t in tracks),
        'tracks_fetched': len(tracks),
        'pages_fetched': pages,
        'latest_track': {
            'title': latest.get('title'),
            'plays': latest.get('playback_count') or 0,
            'likes': _likes(latest),
            'created_at': (latest.get('created_at') or '')[:10],
        } if latest else None,
        'top_tracks': top_tracks,
    }
    # Profile said the artist has tracks but we got none → that's a failed
    # catalogue fetch, not a quiet artist. Don't store fake zeros.
    if truncated and not tracks and metrics['track_count'] > 0:
        return None, 'failed', 'track catalogue fetch failed entirely'
    if truncated:
        metrics['raw_note'] = 'pagination truncated; totals undercount'
        return metrics, 'partial', None
    return metrics, 'ok', None


# ---------------------------------------------------------------- run

def run_daily_snapshot(trigger='scheduled'):
    """One full collection pass. Resume-safe; never raises. Returns run id."""
    sb = supabase()
    today = _today()
    run = sb.table('snapshot_runs').insert({
        'run_date': today, 'trigger': trigger,
    }).execute().data[0]
    run_id = run['id']
    tallies = {'ok': 0, 'partial': 0, 'failed': 0}
    errors = []

    try:
        reg = sync_registry(sb)
        if reg['resolve_failed']:
            errors.append({'resolve_failed': reg['resolve_failed']})

        artists = (
            sb.table('tracked_artists').select('id, artist_key, soundcloud_user_id')
            .eq('active', True).eq('resolve_status', 'ok').execute()
        ).data or []

        existing = {
            r['artist_id']: r['fetch_status'] for r in (
                sb.table('artist_snapshots')
                .select('artist_id, fetch_status')
                .eq('snapshot_date', today).eq('platform', PLATFORM).eq('source', SOURCE)
                .execute().data or []
            )
        }

        for a in artists:
            prev = existing.get(a['id'])
            if prev == 'ok':
                continue  # already captured today
            metrics, status, err = fetch_artist_stats(a['soundcloud_user_id'])
            if prev and _RANK[status] < _RANK.get(prev, 0):
                continue  # never replace better data with worse
            row = {
                'artist_id': a['id'],
                'snapshot_date': today,
                'platform': PLATFORM,
                'source': SOURCE,
                'fetch_status': status,
                'run_id': run_id,
                'raw': {},
            }
            if metrics:
                note = metrics.pop('raw_note', None)
                row.update(metrics)
                if note:
                    row['raw'] = {'note': note}
            if err:
                row['raw'] = {**row['raw'], 'error': err}
                errors.append({'artist': a['artist_key'], 'error': err})
            sb.table('artist_snapshots').upsert(
                row, on_conflict='artist_id,snapshot_date,platform,source'
            ).execute()
            tallies[status] += 1

        sb.table('snapshot_runs').update({
            'status': 'completed',
            'finished_at': datetime.now(timezone.utc).isoformat(),
            'artists_total': len(artists),
            'artists_ok': tallies['ok'],
            'artists_partial': tallies['partial'],
            'artists_failed': tallies['failed'],
            'errors': errors[:50],
        }).eq('id', run_id).execute()
        print(f'[tracking] run {run_id[:8]} completed: {tallies} of {len(artists)}')
    except Exception as e:
        try:
            sb.table('snapshot_runs').update({
                'status': 'failed',
                'finished_at': datetime.now(timezone.utc).isoformat(),
                'errors': errors + [{'fatal': str(e)[:500]}],
            }).eq('id', run_id).execute()
        except Exception:
            pass
        print(f'[tracking] run {run_id[:8]} FAILED: {e}')
    return run_id


def today_run_completed(sb=None):
    sb = sb or supabase()
    rows = (
        sb.table('snapshot_runs').select('id')
        .eq('run_date', _today()).eq('status', 'completed')
        .limit(1).execute()
    ).data or []
    return bool(rows)


def catchup_daily_snapshot():
    """Hourly job: re-run only if today's snapshot hasn't completed
    (missed cron, redeploy mid-run). Skips already-ok artists, so cheap."""
    try:
        if not today_run_completed():
            run_daily_snapshot(trigger='catchup')
    except Exception as e:
        print(f'[tracking] catchup check failed: {e}')


if __name__ == '__main__':
    import os
    from dotenv import load_dotenv
    load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))
    run_daily_snapshot(trigger='manual')
