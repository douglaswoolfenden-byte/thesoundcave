"""
The Sound Cave — Daily Clan Tracker
Fetches current stats for all discovered artists and saves a daily snapshot.
Runs daily via GitHub Actions to build up datapoints for Footprints charts.
"""

import os
import sys
import json
import glob
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load master .env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

CLIENT_ID     = os.getenv('SOUNDCLOUD_CLIENT_ID')
CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET not found in .env")
    sys.exit(1)

DATA_DIR      = os.path.join(os.path.dirname(__file__), 'data')
SNAPSHOTS_DIR = os.path.join(DATA_DIR, 'snapshots')


# ── OAuth ──────────────────────────────────────────────────
def get_oauth_token() -> str:
    stored = os.getenv('SOUNDCLOUD_OAUTH_TOKEN')
    if stored:
        return stored
    print("  Fetching OAuth token...")
    r = requests.post('https://api.soundcloud.com/oauth2/token', data={
        'grant_type':    'client_credentials',
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
    }, timeout=10)
    if r.status_code == 200:
        print("  OAuth token obtained ✅")
        return r.json().get('access_token', '')
    print(f"  OAuth failed: {r.status_code} — {r.text}")
    return ''


TOKEN = get_oauth_token()
if not TOKEN:
    print("ERROR: Could not get OAuth token.")
    sys.exit(1)


# ── Collect artist usernames from all reports ──────────────
def collect_artist_usernames() -> dict:
    """
    Scan all weekly reports and return a dict of {username: {display_name, genre, user_id}}.
    This tracks every artist ever discovered, so we build data for all of them.
    """
    artists = {}
    pattern = os.path.join(DATA_DIR, '20*.json')
    for filepath in sorted(glob.glob(pattern)):
        try:
            with open(filepath) as f:
                report = json.load(f)
            for track in report.get('tracks', []):
                username = track.get('artist_username', '')
                if username and username not in artists:
                    artists[username] = {
                        'display_name': track.get('artist', username),
                        'genre':        track.get('genre', ''),
                        'artist_url':   track.get('artist_url', ''),
                    }
        except Exception:
            pass

    # Also load any manually added artists from clan_artists.json
    manual_path = os.path.join(DATA_DIR, 'clan_artists.json')
    if os.path.exists(manual_path):
        try:
            with open(manual_path) as f:
                manual = json.load(f)
            for entry in manual:
                username = entry.get('username', '')
                if username and username not in artists:
                    artists[username] = {
                        'display_name': entry.get('display_name', username),
                        'genre':        entry.get('genre', ''),
                        'artist_url':   entry.get('artist_url', ''),
                    }
        except Exception:
            pass

    return artists


# ── Fetch artist profile ───────────────────────────────────
def fetch_user_by_username(username: str) -> dict | None:
    """Resolve a SoundCloud username to their full profile."""
    headers = {'Authorization': f'OAuth {TOKEN}'}
    try:
        r = requests.get(
            f'https://api.soundcloud.com/resolve',
            params={'url': f'https://soundcloud.com/{username}'},
            headers=headers,
            timeout=10
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def fetch_user_tracks(user_id: int, limit: int = 5) -> list:
    """Fetch an artist's most recent tracks."""
    headers = {'Authorization': f'OAuth {TOKEN}'}
    try:
        r = requests.get(
            f'https://api.soundcloud.com/users/{user_id}/tracks',
            params={'limit': limit, 'order': 'created_at'},
            headers=headers,
            timeout=10
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return []


# ── Build snapshot ─────────────────────────────────────────
def build_snapshot(artists: dict) -> dict:
    """Fetch current stats for each artist and return a snapshot."""
    today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    snapshot = {
        'date': today,
        'artist_count': 0,
        'artists': {},
    }

    total = len(artists)
    for i, (username, meta) in enumerate(artists.items(), 1):
        print(f"  [{i}/{total}] {username}...", end=' ')

        profile = fetch_user_by_username(username)
        if not profile:
            print("⚠ not found")
            continue

        user_id = profile.get('id')
        tracks  = fetch_user_tracks(user_id) if user_id else []

        # Aggregate track stats from recent tracks
        total_plays  = sum(t.get('playback_count', 0) or 0 for t in tracks)
        total_likes  = sum((t.get('likes_count') or t.get('favoritings_count') or 0) for t in tracks)
        total_reposts = sum(t.get('reposts_count', 0) or 0 for t in tracks)

        latest_track = None
        if tracks:
            latest_track = {
                'title': tracks[0].get('title', ''),
                'plays': tracks[0].get('playback_count', 0) or 0,
                'likes': tracks[0].get('likes_count') or tracks[0].get('favoritings_count') or 0,
                'created_at': (tracks[0].get('created_at', '') or '')[:10].replace('/', '-'),
            }

        snapshot['artists'][username] = {
            'display_name':   profile.get('username', username),
            'genre':          meta.get('genre', ''),
            'followers':      profile.get('followers_count', 0) or 0,
            'following':      profile.get('followings_count', 0) or 0,
            'track_count':    profile.get('track_count', 0) or 0,
            'total_plays':    total_plays,
            'total_likes':    total_likes,
            'total_reposts':  total_reposts,
            'avatar_url':     profile.get('avatar_url', ''),
            'latest_track':   latest_track,
        }
        print(f"✅ {profile.get('followers_count', 0)} followers")

    snapshot['artist_count'] = len(snapshot['artists'])
    return snapshot


# ── Save ───────────────────────────────────────────────────
def save_snapshot(snapshot: dict) -> str:
    os.makedirs(SNAPSHOTS_DIR, exist_ok=True)
    date = snapshot['date']
    out_path = os.path.join(SNAPSHOTS_DIR, f'{date}.json')
    with open(out_path, 'w') as f:
        json.dump(snapshot, f, indent=2)
    print(f"\n  Snapshot saved → data/snapshots/{date}.json")
    return out_path


def update_manifest():
    """Update manifest.json to include snapshot files."""
    # Weekly reports
    week_files = sorted(glob.glob(os.path.join(DATA_DIR, '20*.json')))
    weeks = [os.path.basename(f) for f in week_files]

    # Daily snapshots
    snap_files = sorted(glob.glob(os.path.join(SNAPSHOTS_DIR, '20*.json')))
    snapshots = [os.path.basename(f) for f in snap_files]

    manifest = {
        'weeks': weeks,
        'snapshots': snapshots,
    }

    out = os.path.join(DATA_DIR, 'manifest.json')
    with open(out, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"  Manifest updated — {len(weeks)} week(s), {len(snapshots)} snapshot(s)")


# ── Entry Point ────────────────────────────────────────────
if __name__ == '__main__':
    print("\n🔥 The Sound Cave — Daily Clan Tracker\n")

    artists = collect_artist_usernames()
    if not artists:
        print("  No artists to track. Run scout.py first to discover artists.")
        sys.exit(0)

    print(f"  Tracking {len(artists)} artist(s)...\n")

    snapshot = build_snapshot(artists)
    save_snapshot(snapshot)
    update_manifest()

    print(f"\n✅ Done — {snapshot['artist_count']} artists tracked today.")
