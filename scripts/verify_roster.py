"""
Verify the account-backed roster end-to-end against the live API.

Creates a throwaway confirmed test user, signs in for a real JWT, then
exercises the full /api/roster surface (upsert, list, prefs, import, delete)
and asserts each round-trip. Saves the session to /tmp so the Playwright UI
test can inject it. Run scripts/verify_roster.py --cleanup to delete the user.

Reads SUPABASE_URL / SUPABASE_SERVICE_KEY from workspace .env. The anon key is
the public client key (also hardcoded in js/lib/supabase.js).
"""
import json
import os
import sys
import uuid

import requests
from dotenv import load_dotenv
from supabase import create_client

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '..', '..', '.env'))

API = 'http://localhost:8000'
SESSION_FILE = '/tmp/roster_verify_session.json'
USER_FILE = '/tmp/roster_verify_user.json'

URL = os.environ['SUPABASE_URL']
SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
ANON_KEY = os.environ['SUPABASE_ANON_KEY']  # public client key; RLS is the security layer

PASSES, FAILS = [], []


def check(label, ok, detail=''):
    (PASSES if ok else FAILS).append(label)
    print(f"  {'✅' if ok else '❌'} {label}{(' — ' + detail) if detail else ''}")


def cleanup():
    if not os.path.exists(USER_FILE):
        print('No test user on record — nothing to clean.')
        return
    uid = json.load(open(USER_FILE))['user_id']
    admin = create_client(URL, SERVICE_KEY)
    admin.auth.admin.delete_user(uid)
    # Roster rows cascade-delete via FK; remove temp files.
    for f in (USER_FILE, SESSION_FILE):
        if os.path.exists(f):
            os.remove(f)
    print(f'🧹 Deleted test user {uid} (roster rows cascade) + temp files.')


def main():
    admin = create_client(URL, SERVICE_KEY)
    email = f'roster-verify-{uuid.uuid4().hex[:8]}@example.com'
    password = uuid.uuid4().hex + 'A1!'

    print(f'Creating throwaway test user {email} …')
    created = admin.auth.admin.create_user({
        'email': email, 'password': password, 'email_confirm': True,
    })
    uid = created.user.id
    json.dump({'user_id': uid, 'email': email}, open(USER_FILE, 'w'))

    # Sign in via the public anon client to get a real session JWT.
    anon = create_client(URL, ANON_KEY)
    res = anon.auth.sign_in_with_password({'email': email, 'password': password})
    token = res.session.access_token
    json.dump({
        'access_token': token,
        'refresh_token': res.session.refresh_token,
        'expires_at': res.session.expires_at,
        'user': {'id': uid, 'email': email},
    }, open(SESSION_FILE, 'w'))
    H = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    print(f'Signed in (user {uid}). Running API round-trip…\n')

    # 1. starts empty
    r = requests.get(f'{API}/api/roster', headers=H)
    check('GET /api/roster returns 200', r.status_code == 200, f'status {r.status_code}')
    data = r.json() if r.ok else {}
    check('new user roster is empty', data.get('roster') == [], str(data.get('roster')))

    # 2. upsert an artist
    entry = {'username': 'verify_probe', 'display_name': 'Verify Probe',
             'genre': 'techno', 'status': 'active', 'notes': 'hi',
             'platforms': {'spotify': 'x'}, 'snapshots': [], 'tracks_seen': []}
    r = requests.post(f'{API}/api/roster', headers=H, json=entry)
    check('POST upsert returns 200', r.status_code == 200, f'status {r.status_code}')

    # 3. it comes back
    r = requests.get(f'{API}/api/roster', headers=H)
    names = [a['username'] for a in r.json().get('roster', [])]
    check('GET reflects the upserted artist', 'verify_probe' in names, str(names))
    got = next((a for a in r.json().get('roster', []) if a['username'] == 'verify_probe'), {})
    check('fields round-trip (genre/notes/platforms)',
          got.get('genre') == 'techno' and got.get('notes') == 'hi'
          and got.get('platforms', {}).get('spotify') == 'x', json.dumps(got))

    # 4. upsert again (idempotent — status flip), same artist
    entry['status'] = 'cut'
    r = requests.post(f'{API}/api/roster', headers=H, json=entry)
    r = requests.get(f'{API}/api/roster', headers=H)
    cut = next((a for a in r.json().get('roster', []) if a['username'] == 'verify_probe'), {})
    rows = [a for a in r.json().get('roster', []) if a['username'] == 'verify_probe']
    check('upsert is idempotent (no duplicate row)', len(rows) == 1, f'{len(rows)} rows')
    check('status update persisted', cut.get('status') == 'cut', cut.get('status'))

    # 5. prefs
    r = requests.put(f'{API}/api/roster/prefs', headers=H,
                     json={'watching': ['w1', 'w2'], 'dismissed': ['d1']})
    check('PUT prefs returns 200', r.status_code == 200, f'status {r.status_code}')
    r = requests.get(f'{API}/api/roster', headers=H)
    check('prefs round-trip', r.json().get('watching') == ['w1', 'w2']
          and r.json().get('dismissed') == ['d1'], json.dumps(r.json()))

    # 6. import (bulk migration shape)
    r = requests.post(f'{API}/api/roster/import', headers=H, json={
        'favs': {'imp_a': {'username': 'imp_a', 'display_name': 'A', 'status': 'active'},
                 'imp_b': {'username': 'imp_b', 'display_name': 'B', 'status': 'active'}},
        'watching': [], 'dismissed': [],
    })
    check('POST import returns 200', r.status_code == 200, f'status {r.status_code}')
    r = requests.get(f'{API}/api/roster', headers=H)
    names = [a['username'] for a in r.json().get('roster', [])]
    check('imported artists present', 'imp_a' in names and 'imp_b' in names, str(names))

    # 7. delete
    r = requests.delete(f'{API}/api/roster/verify_probe', headers=H)
    check('DELETE returns 200', r.status_code == 200, f'status {r.status_code}')
    r = requests.get(f'{API}/api/roster', headers=H)
    names = [a['username'] for a in r.json().get('roster', [])]
    check('deleted artist gone', 'verify_probe' not in names, str(names))

    # 8. RLS isolation — no token = no data
    r = requests.get(f'{API}/api/roster')
    check('unauthenticated request is rejected (401)', r.status_code == 401, f'status {r.status_code}')

    print(f'\n{"="*48}\n{len(PASSES)} passed, {len(FAILS)} failed')
    if FAILS:
        print('FAILED:', ', '.join(FAILS))
        print(f'\nTest user kept for Playwright. Session → {SESSION_FILE}')
        sys.exit(1)
    print(f'\nAll backend checks passed. Session saved → {SESSION_FILE}')
    print('Test user kept for the Playwright UI test; run --cleanup after.')


if __name__ == '__main__':
    if '--cleanup' in sys.argv:
        cleanup()
    else:
        main()
