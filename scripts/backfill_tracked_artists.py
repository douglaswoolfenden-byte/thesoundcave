"""
One-off: seed the tracked_artists registry (Clan Data Tracking v2).
Spec: wiki/spec/clan_data_tracking_v2.md. Idempotent — safe to re-run.

Sources, in priority order:
  1. Supabase roster rows (status=active) — have artist_url
  2. roster_prefs.watching usernames — artist_url mined from local weekly
     reports (data/20*.json; scout saves the correct permalink per track)
Then resolves every pending row to a stable numeric SoundCloud user id and
prints a resolve report. Run from project root with venv active:
    python scripts/backfill_tracked_artists.py
"""
import glob
import json
import sys
from pathlib import Path

from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')
sys.path.insert(0, str(PROJECT_ROOT))

from sb_helpers import supabase            # noqa: E402
from tracking_collector import sync_registry  # noqa: E402


def mine_artist_urls():
    """username → permalink_url from every local weekly report."""
    urls = {}
    for f in sorted(glob.glob(str(PROJECT_ROOT / 'data' / '20*.json'))):
        try:
            report = json.load(open(f))
        except Exception as e:
            print(f'  ⚠ unreadable report {f}: {e}')
            continue
        for t in report.get('tracks', []):
            name = (t.get('artist_username') or '').strip()
            url = t.get('artist_url')
            if name and url and name not in urls:
                urls[name] = url
    return urls


def main():
    sb = supabase()
    print('Step 1 — registry sync from roster + watching…')
    summary = sync_registry(sb)
    print(f"  union={summary['union']} resolved={summary['resolved']} "
          f"deactivated={summary['deactivated']}")

    failed = summary['resolve_failed']
    if failed:
        print(f'\nStep 2 — {len(failed)} unresolved; mining weekly reports for URLs…')
        urls = mine_artist_urls()
        fixed = 0
        for key in failed:
            url = urls.get(key)
            if not url:
                continue
            sb.table('tracked_artists').update({
                'permalink_url': url, 'resolve_status': 'pending',
            }).eq('artist_key', key).execute()
            fixed += 1
        print(f'  found URLs for {fixed}/{len(failed)}; re-resolving…')
        summary = sync_registry(sb)

    rows = sb.table('tracked_artists').select(
        'artist_key, resolve_status, resolve_error, soundcloud_user_id, active'
    ).execute().data or []
    print('\n=== Registry report ===')
    for r in sorted(rows, key=lambda x: (x['resolve_status'], x['artist_key'])):
        mark = '✓' if r['resolve_status'] == 'ok' else '✗'
        extra = f"id={r['soundcloud_user_id']}" if r['resolve_status'] == 'ok' \
                else (r.get('resolve_error') or '')
        print(f"  {mark} {r['artist_key']}  [{ 'active' if r['active'] else 'inactive' }]  {extra}")
    ok = sum(1 for r in rows if r['resolve_status'] == 'ok')
    print(f'\n{ok}/{len(rows)} resolved. Unresolved artists need an artist_url '
          f'(re-add to Clan from search, or add the URL to the roster row).')


if __name__ == '__main__':
    main()
