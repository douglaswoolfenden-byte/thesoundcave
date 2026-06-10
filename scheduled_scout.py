"""
The Sound Cave — Scheduled Search Runner

Runs the user-defined searches in data/scheduled_searches.json (managed via the
Scheduled tab / content_api). For each active search it queries SoundCloud with
that search's own filters, tags every result with the search, and writes
data/searches/<id>.json + data/searches/index.json. Runs weekly via GitHub
Actions (.github/workflows/scheduled_searches.yml).

Standalone (own OAuth) to avoid scout.py's import-time side effects; the small
shared scoring/record logic is mirrored from scout.py on purpose.
"""

import os
import re
import sys
import json
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '.env'))

CLIENT_ID     = os.getenv('SOUNDCLOUD_CLIENT_ID')
CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET not found in .env")
    sys.exit(1)

DATA_DIR      = os.path.join(os.path.dirname(__file__), 'data')
SEARCHES_PATH = os.path.join(DATA_DIR, 'scheduled_searches.json')
RESULTS_DIR   = os.path.join(DATA_DIR, 'searches')
BASE_URL      = 'https://api.soundcloud.com/tracks'

RECENCY_DAYS  = 365   # scheduled searches cast a wider net than the weekly scout

# `id` is used as a filename (data/searches/<id>.json) — enforce a strict slug
# so a hand-edited/poisoned JSON can't write outside the results dir.
_SEARCH_ID_RE = re.compile(r'^[A-Za-z0-9_-]{1,64}$')


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

_HEADERS = {'Authorization': f'OAuth {TOKEN}'}


# ── Scoring (mirrors scout.py) ─────────────────────────────
def now_utc():
    return datetime.now(timezone.utc)


def recency_bonus(created_at_str: str) -> float:
    if not created_at_str:
        return 1.0
    try:
        created = datetime.strptime(created_at_str[:10], '%Y/%m/%d').replace(tzinfo=timezone.utc)
        days_old = (now_utc() - created).days
        if days_old <= 14:  return 3.0
        if days_old <= 30:  return 2.0
        if days_old <= 60:  return 1.5
        return 1.0
    except Exception:
        return 1.0


def score_track(track: dict) -> float:
    likes     = track.get('likes_count') or track.get('favoritings_count') or 0
    reposts   = track.get('reposts_count') or 0
    comments  = track.get('comment_count') or 0
    followers = (track.get('user') or {}).get('followers_count') or 1
    engagement = (likes + reposts * 2 + comments * 3) / max(followers, 1)
    return round(engagement * recency_bonus(track.get('created_at', '')), 6)


def fetch_real_followers(user_id: int) -> int:
    try:
        r = requests.get(f'https://api.soundcloud.com/users/{user_id}', headers=_HEADERS, timeout=10)
        if r.status_code == 200:
            return r.json().get('followers_count', 0) or 0
    except Exception:
        pass
    return 0


# ── Query + filter ─────────────────────────────────────────
def fetch_tracks_for_search(search: dict) -> list:
    """Query /tracks with the search's genre and/or keyword."""
    limit = int(search.get('limit') or 50)
    fetch_n = min(200, max(limit * 3, 50))   # over-fetch so filtering still yields enough
    params = {'limit': fetch_n, 'order': 'hotness', 'filter': 'streamable'}
    if search.get('genre'):
        params['genres'] = search['genre']
    if search.get('keyword'):
        params['q'] = search['keyword']
    try:
        r = requests.get(BASE_URL, params=params, headers=_HEADERS, timeout=15)
        r.raise_for_status()
        return r.json() or []
    except Exception as e:
        print(f"    Warning: query failed — {e}")
        return []


def passes_filters(track: dict, search: dict) -> bool:
    # Recency
    created_at = track.get('created_at', '')
    if created_at:
        try:
            created = datetime.strptime(created_at[:10], '%Y/%m/%d').replace(tzinfo=timezone.utc)
            if (now_utc() - created).days > RECENCY_DAYS:
                return False
        except Exception:
            pass

    user    = track.get('user') or {}
    user_id = user.get('id')
    followers = user.get('followers_count') or 0
    # SoundCloud's embedded follower count is often 0/stale — re-fetch when it
    # looks wrong (bounded: only the suspicious ones).
    if followers == 0 and user_id:
        followers = fetch_real_followers(user_id)
    user['followers_count'] = followers

    min_f = int(search.get('min_followers') or 0)
    max_f = int(search.get('max_followers') or 0)   # 0 = no ceiling
    if followers < min_f:
        return False
    if max_f and followers > max_f:
        return False
    return True


def build_record(track: dict, rank: int, search: dict) -> dict:
    user = track.get('user') or {}
    created_raw = track.get('created_at', '')
    uploaded = created_raw[:10].replace('/', '-') if created_raw else ''
    return {
        'rank':            rank,
        'track_id':        track.get('id'),
        'title':           track.get('title', ''),
        'artist':          user.get('username', ''),
        'artist_username': user.get('username', ''),
        'artist_url':      user.get('permalink_url', ''),
        'avatar_url':      user.get('avatar_url', ''),
        'artwork_url':     track.get('artwork_url', ''),
        'genre':           track.get('genre', ''),
        'followers':       user.get('followers_count', 0),
        'plays':           track.get('playback_count', 0),
        'likes':           track.get('likes_count') or track.get('favoritings_count') or 0,
        'reposts':         track.get('reposts_count', 0),
        'comments':        track.get('comment_count', 0),
        'score':           track.get('_score', 0),
        'url':             track.get('permalink_url', ''),
        'uploaded':        uploaded,
        # Search tagging — so the frontend can group + label each result.
        'search_id':       search.get('id', ''),
        'search_name':     search.get('name', ''),
    }


def filters_summary(search: dict) -> str:
    parts = []
    if search.get('genre'):   parts.append(search['genre'])
    if search.get('keyword'): parts.append(f"\"{search['keyword']}\"")
    if search.get('min_followers'): parts.append(f"{search['min_followers']}+ followers")
    if search.get('max_followers'): parts.append(f"≤{search['max_followers']} followers")
    return ' · '.join(parts) or 'All'


def run_search(search: dict) -> dict:
    name = search.get('name', search.get('id', '?'))
    print(f"  ▸ {name} ({filters_summary(search)})")
    limit  = int(search.get('limit') or 50)
    tracks = fetch_tracks_for_search(search)

    eligible = []
    seen_ids = set()
    for t in tracks:
        tid = t.get('id')
        if not tid or tid in seen_ids:
            continue
        seen_ids.add(tid)
        if not passes_filters(t, search):
            continue
        t['_score'] = score_track(t)
        eligible.append(t)

    # Dedupe by artist — keep their highest-scoring track — then take top N.
    by_artist = {}
    for t in sorted(eligible, key=lambda x: x['_score'], reverse=True):
        u = (t.get('user') or {}).get('username', '')
        if u and u not in by_artist:
            by_artist[u] = t
    top = list(by_artist.values())[:limit]
    records = [build_record(t, i, search) for i, t in enumerate(top, 1)]
    print(f"      {len(records)} result(s) from {len(tracks)} fetched")

    return {
        'search_id':   search.get('id', ''),
        'search_name': search.get('name', ''),
        'filters':     filters_summary(search),
        'date':        now_utc().strftime('%Y-%m-%d'),
        'tracks':      records,
    }


def main():
    print("\n🔎 The Sound Cave — Scheduled Search Runner\n")
    try:
        with open(SEARCHES_PATH) as f:
            searches = json.load(f)
    except FileNotFoundError:
        print("  No data/scheduled_searches.json — nothing to run.")
        return
    if not isinstance(searches, list):
        print("  scheduled_searches.json is not a list — aborting.")
        return

    active = [s for s in searches if s.get('active')]
    if not active:
        print("  No active scheduled searches.")
        return

    os.makedirs(RESULTS_DIR, exist_ok=True)
    today = now_utc().strftime('%Y-%m-%d')
    index = []

    for search in active:
        sid = search.get('id')
        if not sid or not _SEARCH_ID_RE.match(str(sid)):
            print(f"  ⚠ skipping search with invalid id: {sid!r}")
            continue
        result = run_search(search)
        out_path = os.path.join(RESULTS_DIR, f'{sid}.json')
        with open(out_path, 'w') as f:
            json.dump(result, f, indent=2)
        search['last_run'] = today
        index.append({
            'id':      sid,
            'name':    search.get('name', ''),
            'filters': result['filters'],
            'date':    today,
            'count':   len(result['tracks']),
        })

    # Persist last_run back to the source list + write the index.
    with open(SEARCHES_PATH, 'w') as f:
        json.dump(searches, f, indent=2)
    with open(os.path.join(RESULTS_DIR, 'index.json'), 'w') as f:
        json.dump(index, f, indent=2)

    print(f"\n✅ Done — {len(index)} search(es) run, results in data/searches/.")


if __name__ == '__main__':
    main()
