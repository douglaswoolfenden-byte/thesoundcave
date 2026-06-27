"""
Show the invite-code ledger: who has a code, and who's redeemed.

    python scripts/list_invites.py

Reads the invite_codes table (service-role) and resolves each redeemed_by id to
its email via the Supabase admin API. Spec: wiki/spec/invite_codes_per_friend.md.
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')

URL = os.environ['SUPABASE_URL'].rstrip('/')
SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
_HEADERS = {'Authorization': f'Bearer {SERVICE_KEY}', 'apikey': SERVICE_KEY}

_email_cache: dict[str, str] = {}


def _email_for(uid: str) -> str:
    if not uid:
        return ''
    if uid not in _email_cache:
        r = requests.get(f'{URL}/auth/v1/admin/users/{uid}', headers=_HEADERS, timeout=20)
        _email_cache[uid] = (r.json().get('email') or uid) if r.ok else uid
    return _email_cache[uid]


def main() -> int:
    r = requests.get(
        f'{URL}/rest/v1/invite_codes'
        '?select=code,label,credits,redeemed_by,redeemed_at,created_at'
        '&order=created_at.asc',
        headers=_HEADERS, timeout=20,
    )
    r.raise_for_status()
    rows = r.json()
    if not rows:
        print('No invite codes minted yet. Make one: '
              'python scripts/mint_invite.py "name-or-email"')
        return 0

    open_n = sum(1 for x in rows if not x.get('redeemed_by'))
    print(f"{len(rows)} code(s) · {open_n} open · {len(rows) - open_n} redeemed\n")
    print(f"{'CODE':<14} {'CR':>3}  {'STATUS':<9} {'FOR / REDEEMED BY':<34} WHEN")
    print('-' * 84)
    for x in rows:
        redeemed = bool(x.get('redeemed_by'))
        status = 'redeemed' if redeemed else 'open'
        who = _email_for(x['redeemed_by']) if redeemed else (x.get('label') or '')
        when = (x.get('redeemed_at') or '')[:19].replace('T', ' ')
        print(f"{x['code']:<14} {x.get('credits', ''):>3}  {status:<9} {who:<34} {when}")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
