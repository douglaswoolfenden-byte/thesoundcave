"""
One-off: import legacy data/snapshots/*.json into artist_snapshots
(Clan Data Tracking v2). Spec: wiki/spec/clan_data_tracking_v2.md.
Idempotent — upserts on (artist_id, snapshot_date, platform, source).

Honesty flags for known-bad legacy data:
  - WRONG_USER keys (Lucki/BELFORT/TREMUR): the display-name /resolve landed
    on an unrelated account → imported as fetch_status='failed', NULL metrics.
  - 2026-05-12 play/like/repost totals predate the pagination fix (5-track
    cap) → 'partial', undercount noted in raw.

Run from project root with venv active (git pull first — the newest snapshot
file is committed daily by CI):
    python scripts/migrate_snapshots_to_supabase.py
"""
import glob
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')
sys.path.insert(0, str(PROJECT_ROOT))

from sb_helpers import supabase  # noqa: E402

WRONG_USER_KEYS = {'Lucki', 'BELFORT', 'TREMUR'}
UNDERCOUNT_DATES = {'2026-05-12'}


def main():
    sb = supabase()
    tracked = {
        t['artist_key']: t['id']
        for t in (sb.table('tracked_artists').select('id, artist_key').execute().data or [])
    }
    if not tracked:
        print('tracked_artists is empty — run scripts/backfill_tracked_artists.py first.')
        return

    run = sb.table('snapshot_runs').insert({
        'run_date': datetime.now(timezone.utc).date().isoformat(),
        'trigger': 'backfill',
    }).execute().data[0]
    counts = {'ok': 0, 'partial': 0, 'failed': 0, 'skipped_unknown': 0}

    for f in sorted(glob.glob(str(PROJECT_ROOT / 'data' / 'snapshots' / '*.json'))):
        snap = json.load(open(f))
        date = snap['date']
        for key, d in (snap.get('artists') or {}).items():
            artist_id = tracked.get(key)
            if not artist_id:
                counts['skipped_unknown'] += 1
                continue
            row = {
                'artist_id': artist_id,
                'snapshot_date': date,
                'platform': 'soundcloud',
                'source': 'api',
                'run_id': run['id'],
            }
            if key in WRONG_USER_KEYS:
                row['fetch_status'] = 'failed'
                row['raw'] = {'migrated': True,
                              'reason': 'wrong-user resolution (display-name resolve)'}
                counts['failed'] += 1
            else:
                row.update({
                    'followers': d.get('followers'),
                    'following': d.get('following'),
                    'track_count': d.get('track_count'),
                    'total_plays': d.get('total_plays'),
                    'total_likes': d.get('total_likes'),
                    'total_reposts': d.get('total_reposts'),
                    'latest_track': d.get('latest_track'),
                })
                if date in UNDERCOUNT_DATES:
                    row['fetch_status'] = 'partial'
                    row['raw'] = {'migrated': True,
                                  'undercounted': 'pre-pagination-fix (5-track cap)'}
                    counts['partial'] += 1
                else:
                    row['fetch_status'] = 'ok'
                    row['raw'] = {'migrated': True}
                    counts['ok'] += 1
            sb.table('artist_snapshots').upsert(
                row, on_conflict='artist_id,snapshot_date,platform,source'
            ).execute()
        print(f'  imported {date}')

    sb.table('snapshot_runs').update({
        'status': 'completed',
        'finished_at': datetime.now(timezone.utc).isoformat(),
        'artists_ok': counts['ok'],
        'artists_partial': counts['partial'],
        'artists_failed': counts['failed'],
    }).eq('id', run['id']).execute()
    print(f'\nDone: {counts}')
    if counts['skipped_unknown']:
        print('skipped_unknown = legacy keys not in the registry '
              '(not in Clan/Watching — by design, v2 tracks only those).')


if __name__ == '__main__':
    main()
