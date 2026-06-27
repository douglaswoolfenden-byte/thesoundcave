"""
Mint a single-use invite code for one friend and store it in Supabase.

A code grants the free-trial credits exactly ONCE, to the first account that
redeems it (enforced server-side in /api/redeem-invite). Run this per friend,
then send them the printed code. Spec: wiki/spec/invite_codes_per_friend.md.

Run from the project root (no venv needed beyond requests + python-dotenv):

    python scripts/mint_invite.py "friend@example.com"                  # random CAVE-XXXXXX code
    python scripts/mint_invite.py "friend@example.com" --code THEIRCODE
    python scripts/mint_invite.py "friend@example.com" --code THEIRCODE --credits 50

The code is printed to THIS terminal only — it is a credential, so don't paste it
into chat. Re-running with the same --code is a no-op (the row already exists).
"""
import argparse
import os
import secrets
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')   # workspace-root .env

URL = os.environ['SUPABASE_URL'].rstrip('/')
SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
DEFAULT_CREDITS = int(os.getenv('FREE_TRIAL_CREDITS', '50'))

# Unambiguous base32 (no 0/O/1/I/L) so codes are easy to read aloud / retype.
_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'


def _random_code() -> str:
    return 'CAVE-' + ''.join(secrets.choice(_ALPHABET) for _ in range(6))


def main() -> int:
    ap = argparse.ArgumentParser(description='Mint a single-use invite code.')
    ap.add_argument('label', help="who it's for — an email or name (for your records)")
    ap.add_argument('--code', help='explicit code (default: random CAVE-XXXXXX)')
    ap.add_argument('--credits', type=int, default=DEFAULT_CREDITS,
                    help=f'grant size (default {DEFAULT_CREDITS})')
    args = ap.parse_args()

    code = (args.code or _random_code()).strip().upper()   # stored UPPER; match is case-insensitive

    headers = {
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation',
    }
    r = requests.post(
        f'{URL}/rest/v1/invite_codes',
        headers=headers,
        json={'code': code, 'label': args.label, 'credits': args.credits},
        timeout=20,
    )
    if r.status_code == 409:
        print(f"⚠️  Code {code} already exists — not changed. "
              f"Run scripts/list_invites.py to see it.")
        return 0
    if not r.ok:
        print(f"❌ Failed ({r.status_code}): {r.text}", file=sys.stderr)
        return 1

    print("✅ Minted single-use invite code")
    print(f"   for     : {args.label}")
    print(f"   credits : {args.credits}")
    print(f"   CODE    : {code}")
    print("\n   Send that code to them. It works once, on the first account that redeems it.")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
