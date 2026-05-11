"""
One-shot backfill: re-fetch real SoundCloud stats for every artist in every
existing weekly report and rewrite the JSON with corrected `followers`.

Why: scout.py used to trust the embedded user.followers_count from track search
results, which SoundCloud often returns wrong (e.g. Carlos Manaça stored as 7
followers when reality is ~21k). Now that scout.py always re-fetches, new
reports will be accurate — this script fixes the existing ones in place.

Usage:
    python scripts/refresh_clan_stats.py            # rewrite all data/20*.json
    python scripts/refresh_clan_stats.py --dry      # show diff only, no writes
    python scripts/refresh_clan_stats.py 2026-03-25 # single file
"""

import os
import sys
import json
import glob
import time
import requests
from dotenv import load_dotenv

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(PROJECT_ROOT, '..', '..', '.env'))

CLIENT_ID = os.getenv('SOUNDCLOUD_CLIENT_ID')
CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET not in .env")
    sys.exit(1)


def get_token():
    stored = os.getenv('SOUNDCLOUD_OAUTH_TOKEN')
    if stored:
        return stored
    r = requests.post('https://api.soundcloud.com/oauth2/token', data={
        'grant_type': 'client_credentials',
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
    }, timeout=10)
    r.raise_for_status()
    return r.json()['access_token']


TOKEN = get_token()
HEADERS = {'Authorization': f'OAuth {TOKEN}'}


def resolve_user(url):
    try:
        r = requests.get('https://api.soundcloud.com/resolve',
                         params={'url': url}, headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json()
    except Exception as e:
        print(f"  resolve failed for {url}: {e}")
    return None


def real_followers(user_id):
    try:
        r = requests.get(f'https://api.soundcloud.com/users/{user_id}',
                         headers=HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json().get('followers_count', 0) or 0
    except Exception as e:
        print(f"  user fetch failed for {user_id}: {e}")
    return None


def process_file(path, dry=False):
    with open(path) as f:
        report = json.load(f)

    changes = []
    for track in report.get('tracks', []):
        url = (track.get('artist_url') or '').split('?')[0]
        if not url:
            continue
        profile = resolve_user(url)
        if not profile or not profile.get('id'):
            print(f"  ⚠ could not resolve {track.get('artist')}")
            continue
        fresh = profile.get('followers_count') or 0
        stored = track.get('followers') or 0
        if fresh != stored:
            changes.append((track.get('artist'), stored, fresh))
            track['followers'] = fresh
        time.sleep(0.1)  # gentle pacing

    if not changes:
        print(f"  ✓ {os.path.basename(path)} — no changes")
        return

    print(f"  📝 {os.path.basename(path)} — {len(changes)} changes:")
    for name, old, new in changes:
        flag = '🚨' if new >= 5000 else '  '
        print(f"     {flag} {name}: {old} → {new}")

    if not dry:
        with open(path, 'w') as f:
            json.dump(report, f, indent=2, ensure_ascii=False)


def main():
    args = sys.argv[1:]
    dry = '--dry' in args
    args = [a for a in args if a != '--dry']

    data_dir = os.path.join(PROJECT_ROOT, 'data')
    if args:
        paths = [os.path.join(data_dir, f'{a}.json') for a in args]
    else:
        paths = sorted(glob.glob(os.path.join(data_dir, '20*.json')))

    print(f"Processing {len(paths)} file(s){' (DRY RUN)' if dry else ''}")
    for p in paths:
        if not os.path.exists(p):
            print(f"  ✗ missing: {p}")
            continue
        process_file(p, dry=dry)


if __name__ == '__main__':
    main()
