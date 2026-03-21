"""
The Sound Cave — Artist Scout Engine
Discovers unsigned/emerging artists in European underground dance music.
Runs weekly via GitHub Actions, saves JSON report to data/ folder.
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


# --- Config ---

GENRES = [
    'house',
    'deep house',
    'tech house',
    'afro house',
    'uk garage',
    'garage',
    'bassline',
    'drum and bass',
    'jungle',
    'techno',
    'minimal techno',
    'breaks',
    'breakbeat',
    'electronic',
    'lo-fi',
    '140',
]

MAX_FOLLOWERS    = 5000
MIN_PLAYS        = 200
TRACKS_PER_GENRE = 50
TOP_N            = 20
RECENCY_DAYS     = 90
BASE_URL         = 'https://api.soundcloud.com/tracks'
DATA_DIR         = os.path.join(os.path.dirname(__file__), 'data')


# --- OAuth ---

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


# --- API ---

def fetch_tracks(genre: str, limit: int = 50) -> list:
    headers = {'Authorization': f'OAuth {TOKEN}'}
    params  = {'genres': genre, 'limit': limit, 'order': 'hotness', 'filter': 'streamable'}
    try:
        r = requests.get(BASE_URL, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  Warning: could not fetch '{genre}' — {e}")
        return []


# --- Scoring ---

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


# --- Filters ---

def is_eligible(track: dict) -> bool:
    followers = (track.get('user') or {}).get('followers_count') or 0
    plays     = track.get('playback_count') or 0
    if followers >= MAX_FOLLOWERS or plays < MIN_PLAYS:
        return False
    created_at = track.get('created_at', '')
    if created_at:
        try:
            created = datetime.strptime(created_at[:10], '%Y/%m/%d').replace(tzinfo=timezone.utc)
            if (now_utc() - created).days > RECENCY_DAYS:
                return False
        except Exception:
            pass
    return True


# --- Repeat Artist Detection ---

def load_previous_artist_ids() -> dict:
    """
    Returns dict of {artist_username: [list of dates they appeared]}.
    Built from all existing weekly JSON files.
    """
    history = {}
    pattern = os.path.join(DATA_DIR, '20*.json')
    for filepath in sorted(glob.glob(pattern)):
        try:
            with open(filepath) as f:
                report = json.load(f)
            week_date = report.get('date', '')
            for track in report.get('tracks', []):
                username = track.get('artist_username', '')
                if username:
                    if username not in history:
                        history[username] = []
                    history[username].append(week_date)
        except Exception:
            pass
    return history


# --- Build Track Record ---

def build_track_record(track: dict, rank: int) -> dict:
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
        'weeks_seen':      1,       # updated after history check
        'first_seen':      '',      # updated after history check
        'is_repeat':       False,   # updated after history check
    }


# --- Save Report ---

def save_report(tracks: list, total_analysed: int, history: dict) -> str:
    today      = now_utc().strftime('%Y-%m-%d')
    week_files = sorted(glob.glob(os.path.join(DATA_DIR, '20*.json')))
    week_num   = len(week_files) + 1

    records = []
    for i, track in enumerate(tracks, 1):
        rec      = build_track_record(track, i)
        username = rec['artist_username']
        past     = history.get(username, [])
        if past:
            rec['is_repeat']  = True
            rec['first_seen'] = past[0]
            rec['weeks_seen'] = len(past) + 1
        else:
            rec['first_seen'] = today
            rec['weeks_seen'] = 1
        records.append(rec)

    report = {
        'date':           today,
        'week':           week_num,
        'genres_scouted': len(GENRES),
        'total_analysed': total_analysed,
        'tracks':         records,
    }

    out_path = os.path.join(DATA_DIR, f'{today}.json')
    with open(out_path, 'w') as f:
        json.dump(report, f, indent=2)

    print(f"\n  Report saved → data/{today}.json (Week {week_num})")
    return out_path


# --- Scout ---

def scout() -> tuple:
    all_tracks     = []
    seen_ids       = set()
    total_analysed = 0

    for genre in GENRES:
        print(f"  Scouting: {genre}...")
        tracks = fetch_tracks(genre, TRACKS_PER_GENRE)
        total_analysed += len(tracks)

        for track in tracks:
            track_id = track.get('id')
            if not track_id or track_id in seen_ids:
                continue
            seen_ids.add(track_id)
            if not is_eligible(track):
                continue
            track['_score'] = score_track(track)
            all_tracks.append(track)

    top = sorted(all_tracks, key=lambda t: t['_score'], reverse=True)[:TOP_N]
    return top, total_analysed


# --- Print Report ---

def print_report(records: list, week_num: int, date: str):
    print()
    print("=" * 60)
    print(f"  THE SOUND CAVE — Week {week_num} Scout Report ({date})")
    print(f"  Top {len(records)} Rising Artists")
    print("=" * 60)

    for rec in records:
        repeat_flag = " 📈 REPEAT ARTIST" if rec['is_repeat'] else ""
        print(f"\n{rec['rank']:02d}. {rec['artist']} — {rec['title']}{repeat_flag}")
        print(f"    Genre: {rec['genre']} | Uploaded: {rec['uploaded']}")
        print(f"    Followers: {rec['followers']:,} | Plays: {rec['plays']:,} | Likes: {rec['likes']:,} | Reposts: {rec['reposts']:,}")
        print(f"    Score: {rec['score']:.4f} | Weeks seen: {rec['weeks_seen']}")
        print(f"    {rec['url']}")

    print()
    print("=" * 60)
    print(f"  Next run: 7 days")
    print("=" * 60)


# --- Entry Point ---

if __name__ == '__main__':
    print("\n🎵 The Sound Cave — Artist Scout")
    print(f"   {len(GENRES)} genres | Max followers: {MAX_FOLLOWERS:,} | Window: {RECENCY_DAYS} days\n")

    history             = load_previous_artist_ids()
    tracks, total       = scout()

    if not tracks:
        print("\n⚠️  No tracks found. Check credentials or try again.")
        sys.exit(1)

    out_path = save_report(tracks, total, history)

    # Load saved report for printing
    with open(out_path) as f:
        report = json.load(f)

    print_report(report['tracks'], report['week'], report['date'])
    print(f"\n✅ Done — {len(tracks)} rising artists discovered.")
