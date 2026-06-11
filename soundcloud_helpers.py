"""
SoundCloud API helpers extracted for cross-module reuse.

Phase 2 needs name-based search + resolve + recent tracks for the lineup
matching pipeline. Existing functions in content_api.py and scout.py
duplicate this logic; we don't refactor those yet.
"""
import os
import re
import time
import urllib.parse

import requests as http_requests

CLIENT_ID = os.getenv('SOUNDCLOUD_CLIENT_ID')
CLIENT_SECRET = os.getenv('SOUNDCLOUD_CLIENT_SECRET')

_token = None
_HANDLE_RE = re.compile(r"soundcloud\.com/([^/?#]+)")


def get_token():
    global _token
    if _token:
        return _token
    stored = os.getenv('SOUNDCLOUD_OAUTH_TOKEN')
    if stored:
        _token = stored
        return _token
    if not CLIENT_ID or not CLIENT_SECRET:
        return None
    try:
        r = http_requests.post(
            'https://api.soundcloud.com/oauth2/token',
            data={'grant_type': 'client_credentials', 'client_id': CLIENT_ID, 'client_secret': CLIENT_SECRET},
            timeout=10,
        )
        if r.status_code == 200:
            _token = r.json().get('access_token', '')
            return _token
    except Exception:
        pass
    return None


def _headers():
    t = get_token()
    return {'Authorization': f'OAuth {t}'} if t else {}


def search_users(q, limit=5):
    if not q:
        return []
    try:
        r = http_requests.get(
            'https://api.soundcloud.com/users',
            params={'q': q, 'limit': limit},
            headers=_headers(),
            timeout=10,
        )
        if r.status_code == 200:
            return r.json() or []
    except Exception:
        pass
    return []


def resolve_user(username_or_url):
    url = username_or_url
    if not url.startswith('http'):
        url = f'https://soundcloud.com/{username_or_url}'
    try:
        r = http_requests.get(
            'https://api.soundcloud.com/resolve',
            params={'url': url},
            headers=_headers(),
            timeout=10,
        )
        if r.status_code == 200:
            return r.json()
    except Exception:
        pass
    return None


def fetch_user_tracks(user_id, limit=3):
    try:
        r = http_requests.get(
            f'https://api.soundcloud.com/users/{user_id}/tracks',
            params={'limit': limit},
            headers=_headers(),
            timeout=10,
        )
        if r.status_code == 200:
            return r.json() or []
    except Exception:
        pass
    return []


def request_with_retry(url, params=None, attempts=3, backoff=(1, 2, 4), timeout=15):
    """GET with retries. Returns (json_or_none, error_str_or_none).

    A 404 is returned immediately (retrying won't change it); 429/5xx and
    network errors are retried with backoff. Never raises.
    """
    last_err = None
    for i in range(attempts):
        try:
            r = http_requests.get(url, params=params, headers=_headers(), timeout=timeout)
            if r.status_code == 200:
                return r.json(), None
            if r.status_code == 404:
                return None, 'HTTP 404'
            last_err = f'HTTP {r.status_code}'
        except Exception as e:
            last_err = f'{type(e).__name__}: {e}'
        if i < attempts - 1:
            time.sleep(backoff[min(i, len(backoff) - 1)])
    return None, last_err


def fetch_user_by_id(user_id):
    """Fetch a user profile by stable numeric id. Returns (profile_or_none, error).
    Once an id is known, daily fetches never go through /resolve again."""
    return request_with_retry(f'https://api.soundcloud.com/users/{user_id}')


def handle_from_url(url):
    if not url:
        return None
    m = _HANDLE_RE.search(url)
    if not m:
        return None
    return urllib.parse.unquote(m.group(1)).strip().lower() or None


def user_to_profile_payload(user):
    """Map a SoundCloud /users payload to an artist_profiles insert payload."""
    permalink_url = user.get('permalink_url') or ''
    handle = handle_from_url(permalink_url) or (user.get('permalink') or '').lower() or None
    return {
        'display_name': user.get('username') or handle or 'Unknown',
        'soundcloud_handle': handle,
        'soundcloud_url': permalink_url,
        'hero_image_url': user.get('avatar_url'),
        'follower_count_soundcloud': user.get('followers_count'),
        'bio_long': user.get('description'),
        'location': user.get('city') or user.get('country'),
    }


def candidate_summary(user, top_track=None):
    """Compact card payload for the matching review UI."""
    return {
        'soundcloud_id': user.get('id'),
        'username': user.get('username'),
        'handle': handle_from_url(user.get('permalink_url') or '') or user.get('permalink'),
        'permalink_url': user.get('permalink_url'),
        'avatar_url': user.get('avatar_url'),
        'followers_count': user.get('followers_count') or 0,
        'city': user.get('city'),
        'country': user.get('country'),
        'top_track': top_track,
    }
