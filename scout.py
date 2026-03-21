"""
The Sound Cave — Artist Scout Engine
Discovers unsigned/emerging artists in European underground dance music.
Runs weekly, returns top 20 tracks scored by engagement rate.
"""

import os
import sys
import requests
from datetime import datetime, timedelta
from dotenv import load_dotenv

# Load master .env
load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

CLIENT_ID     = os.getenv('SOUNDCLOUD_CLIENT_ID')
CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')

if not CLIENT_ID or not CLIENT_SECRET:
    print("ERROR: SOUNDCLOUD_CLIENT_ID / SOUNDCLOUD_CLIENT_SECRET not found in .env")
    sys.exit(1)


def get_oauth_token() -> str:
    """Exchange client credentials for an OAuth access token."""
    # Check if one is already stored in .env
    stored = os.getenv('SOUNDCLOUD_OAUTH_TOKEN')
    if stored:
        return stored

    print("  Fetching OAuth token via client credentials...")
    r = requests.post('https://api.soundcloud.com/oauth2/token', data={
        'grant_type':    'client_credentials',
        'client_id':     CLIENT_ID,
        'client_secret': CLIENT_SECRET,
    }, timeout=10)

    if r.status_code == 200:
        token = r.json().get('access_token', '')
        print(f"  OAuth token obtained ✅")
        return token
    else:
        print(f"  OAuth token failed: {r.status_code} — {r.text}")
        return ''


TOKEN = get_oauth_token()

if not TOKEN:
    print("ERROR: Could not get OAuth token. Check your Client ID and Secret.")
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

MAX_FOLLOWERS   = 5000   # unsigned/small artist ceiling
MIN_PLAYS       = 200    # ignore brand new tracks with zero traction
TRACKS_PER_GENRE = 50    # how many tracks to pull per genre
TOP_N           = 20     # tracks in final report
RECENCY_DAYS    = 90     # only consider tracks uploaded in last 90 days

BASE_URL = 'https://api.soundcloud.com/tracks'


# --- API ---

def fetch_tracks(genre: str, limit: int = 50) -> list:
    """Pull tracks from SoundCloud for a given genre, ordered by hotness."""
    params = {
        'genres': genre,
        'limit':  limit,
        'order':  'hotness',
        'filter': 'streamable',
    }
    headers = {'Authorization': f'OAuth {TOKEN}'}
    try:
        r = requests.get(BASE_URL, params=params, headers=headers, timeout=10)
        r.raise_for_status()
        return r.json()
    except Exception as e:
        print(f"  Warning: could not fetch '{genre}' — {e}")
        return []


# --- Scoring ---

def recency_bonus(created_at_str: str) -> float:
    """Newer tracks get a score multiplier."""
    if not created_at_str:
        return 1.0
    try:
        # SoundCloud format: "2024/01/15 12:00:00 +0000"
        created = datetime.strptime(created_at_str[:10], '%Y/%m/%d')
        days_old = (datetime.utcnow() - created).days
        if days_old <= 14:
            return 3.0
        elif days_old <= 30:
            return 2.0
        elif days_old <= 60:
            return 1.5
        return 1.0
    except Exception:
        return 1.0


def score_track(track: dict) -> float:
    """
    Score = (likes + reposts×2 + comments×3) / followers × recency_bonus
    Rewards high engagement relative to small audience size.
    """
    likes     = track.get('likes_count') or track.get('favoritings_count') or 0
    reposts   = track.get('reposts_count') or 0
    comments  = track.get('comment_count') or 0
    followers = (track.get('user') or {}).get('followers_count') or 1

    engagement = (likes + reposts * 2 + comments * 3) / max(followers, 1)
    return round(engagement * recency_bonus(track.get('created_at', '')), 6)


# --- Filters ---

def is_eligible(track: dict) -> bool:
    """Only keep small/unsigned artists with some traction."""
    followers = (track.get('user') or {}).get('followers_count') or 0
    plays     = track.get('playback_count') or 0

    if followers >= MAX_FOLLOWERS:
        return False
    if plays < MIN_PLAYS:
        return False

    # Recency check
    created_at = track.get('created_at', '')
    if created_at:
        try:
            created = datetime.strptime(created_at[:10], '%Y/%m/%d')
            if (datetime.utcnow() - created).days > RECENCY_DAYS:
                return False
        except Exception:
            pass

    return True


# --- Main Scout ---

def scout() -> list:
    """
    Pull tracks across all genres, filter for unsigned artists,
    score by engagement, return top N.
    """
    all_tracks = []
    seen_ids   = set()

    for genre in GENRES:
        print(f"  Scouting: {genre}...")
        tracks = fetch_tracks(genre, TRACKS_PER_GENRE)

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
    return top


# --- Report ---

def print_report(tracks: list):
    """Print a clean weekly report to the terminal."""
    week = datetime.utcnow().strftime('%Y-%m-%d')
    print()
    print("=" * 60)
    print(f"  THE SOUND CAVE — Weekly Scout Report ({week})")
    print(f"  Top {len(tracks)} Rising Artists")
    print("=" * 60)

    for i, track in enumerate(tracks, 1):
        user      = track.get('user') or {}
        artist    = user.get('username', 'Unknown')
        title     = track.get('title', 'Unknown')
        genre     = track.get('genre', 'Unknown')
        followers = user.get('followers_count', 0)
        plays     = track.get('playback_count', 0)
        likes     = track.get('likes_count') or track.get('favoritings_count') or 0
        reposts   = track.get('reposts_count', 0)
        score     = track.get('_score', 0)
        url       = track.get('permalink_url', '')
        uploaded  = (track.get('created_at') or '')[:10].replace('/', '-')

        print(f"\n{i:02d}. {artist} — {title}")
        print(f"    Genre: {genre} | Uploaded: {uploaded}")
        print(f"    Followers: {followers:,} | Plays: {plays:,} | Likes: {likes:,} | Reposts: {reposts:,}")
        print(f"    Engagement Score: {score:.4f}")
        print(f"    {url}")

    print()
    print("=" * 60)
    print(f"  Genres scouted: {len(GENRES)} | Tracks analysed before filter: varies")
    print("  Next run: 7 days")
    print("=" * 60)


# --- Entry Point ---

if __name__ == '__main__':
    print("\n🎵 The Sound Cave — Artist Scout starting...")
    print(f"   Genres: {len(GENRES)} | Max followers: {MAX_FOLLOWERS:,} | Recency window: {RECENCY_DAYS} days\n")

    tracks = scout()

    if not tracks:
        print("\n⚠️  No tracks found. Check your CLIENT_ID or try again shortly.")
        sys.exit(1)

    print_report(tracks)
    print(f"\n✅ Done — {len(tracks)} rising artists discovered.")
