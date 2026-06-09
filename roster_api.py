"""
Roster API — account-backed Clan/Roster persistence.

Moves the Roster off browser localStorage and onto the user's Supabase
account so it follows the login across browsers/devices. The frontend keeps
localStorage as a write-through cache; this is the source of truth.

Spec: wiki/spec/roster_account_persistence.md (approved 2026-06-08).

Owner-scoped via Supabase RLS (same pattern as avatars_api). Apply
db/0017_roster.sql before use, or these endpoints 500.
"""
from flask import Blueprint, jsonify, request

from sb_helpers import maybe_one, require_user, supabase

roster_bp = Blueprint('roster', __name__, url_prefix='/api/roster')

# Columns the client may set on a roster row. `artist_username` is the
# sc_favs key (sent as `username`); everything else mirrors the sc_favs entry.
_ARTIST_FIELDS = {
    'display_name', 'genre', 'avatar_url', 'artist_url', 'status', 'notes',
    'platforms', 'playlist_adds', 'preferred_tracks', 'snapshots',
    'tracks_seen', 'added_date',
}


def _row_from_entry(uid, entry):
    """Build a roster row dict from an sc_favs entry. Returns None if no username."""
    username = (entry.get('username') or entry.get('artist_username') or '').strip()
    if not username:
        return None
    row = {'user_id': uid, 'artist_username': username}
    for k in _ARTIST_FIELDS:
        if k in entry and entry[k] is not None:
            row[k] = entry[k]
    return row


def _entry_from_row(row):
    """Shape a DB row back into the sc_favs entry the frontend expects."""
    return {
        'username':         row.get('artist_username'),
        'display_name':     row.get('display_name') or row.get('artist_username'),
        'genre':            row.get('genre') or '',
        'avatar_url':       row.get('avatar_url') or '',
        'artist_url':       row.get('artist_url') or '',
        'added_date':       row.get('added_date'),
        'status':           row.get('status') or 'active',
        'notes':            row.get('notes') or '',
        'platforms':        row.get('platforms') or {},
        'playlist_adds':    row.get('playlist_adds'),
        'preferred_tracks': row.get('preferred_tracks') or [],
        'snapshots':        row.get('snapshots') or [],
        'tracks_seen':      row.get('tracks_seen') or [],
    }


@roster_bp.route('', methods=['GET'])
def get_roster():
    """Full roster + foraging curation state for the authed user."""
    uid, err = require_user()
    if err:
        return err
    rows = (
        supabase().table('roster').select('*')
        .eq('user_id', uid).order('created_at', desc=True).execute()
    ).data or []
    prefs = maybe_one(
        supabase().table('roster_prefs').select('*').eq('user_id', uid)
    ) or {}
    return jsonify({
        'roster':    [_entry_from_row(r) for r in rows],
        'watching':  prefs.get('watching') or [],
        'dismissed': prefs.get('dismissed') or [],
    })


@roster_bp.route('', methods=['POST'])
def upsert_artist():
    """Upsert a single artist (add to Clan, status change, notes/platform edit).
    Body = one sc_favs entry."""
    uid, err = require_user()
    if err:
        return err
    entry = request.get_json(silent=True) or {}
    row = _row_from_entry(uid, entry)
    if not row:
        return jsonify({'error': 'username required'}), 400
    res = supabase().table('roster').upsert(
        row, on_conflict='user_id,artist_username'
    ).execute()
    saved = res.data[0] if res.data else None
    return jsonify({'artist': _entry_from_row(saved) if saved else None}), 200


@roster_bp.route('/<username>', methods=['DELETE'])
def delete_artist(username):
    uid, err = require_user()
    if err:
        return err
    supabase().table('roster').delete().eq('user_id', uid).eq('artist_username', username).execute()
    return jsonify({'ok': True})


@roster_bp.route('/prefs', methods=['PUT'])
def put_prefs():
    """Upsert the foraging watching/dismissed arrays."""
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    row = {
        'user_id':   uid,
        'watching':  body.get('watching') or [],
        'dismissed': body.get('dismissed') or [],
    }
    supabase().table('roster_prefs').upsert(row, on_conflict='user_id').execute()
    return jsonify({'ok': True})


@roster_bp.route('/import', methods=['POST'])
def import_roster():
    """One-time migration: bulk upsert a localStorage roster into the account.
    Body = { favs: { username: entry, ... }, watching: [...], dismissed: [...] }.
    Idempotent via the (user_id, artist_username) unique constraint."""
    uid, err = require_user()
    if err:
        return err
    body = request.get_json(silent=True) or {}
    favs = body.get('favs') or {}

    rows = [r for r in (_row_from_entry(uid, e) for e in favs.values()) if r]
    if rows:
        supabase().table('roster').upsert(
            rows, on_conflict='user_id,artist_username'
        ).execute()

    supabase().table('roster_prefs').upsert({
        'user_id':   uid,
        'watching':  body.get('watching') or [],
        'dismissed': body.get('dismissed') or [],
    }, on_conflict='user_id').execute()

    return jsonify({'imported': len(rows)}), 200
