"""
Shared Supabase + auth helpers for the Flask API modules.

Extracted 2026-05-13 so events_api, artist_profiles_api, campaigns_api,
posts_api can share auth + service-role client without circular imports
back into content_api.
"""
import os

from flask import jsonify, request

_sb_client = None


def supabase():
    """Service-role Supabase client. Bypasses RLS; we apply owner scoping in code."""
    global _sb_client
    if _sb_client is None:
        from supabase import create_client
        _sb_client = create_client(
            os.environ['SUPABASE_URL'],
            os.environ['SUPABASE_SERVICE_KEY'],
        )
    return _sb_client


def resolve_user_id():
    """Return the authed user_id from the request JWT, or None if missing/invalid."""
    auth = request.headers.get('Authorization', '')
    if not auth.startswith('Bearer '):
        return None
    token = auth[7:].strip()
    try:
        res = supabase().auth.get_user(token)
        if res and res.user:
            return res.user.id
    except Exception as e:
        print('JWT validation failed:', e)
    return None


def require_user():
    """Returns (user_id, None) or (None, 401-response tuple)."""
    uid = resolve_user_id()
    if uid is None:
        return None, (jsonify({'error': 'unauthenticated'}), 401)
    return uid, None


def maybe_one(builder):
    """Run a supabase-py query and return the first row or None.

    supabase-py's `.maybe_single().execute()` returns None (not a response
    object) when there are zero matching rows, which breaks `.data` access.
    Use `.limit(1).execute()` + this helper instead.
    """
    res = builder.limit(1).execute()
    rows = getattr(res, 'data', None) or []
    return rows[0] if rows else None
