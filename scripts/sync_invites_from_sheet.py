"""
Sync invite codes from the "Sound Cave — Invite Codes & Promos Tracker" Google
Sheet into the Supabase `invite_codes` table. The sheet is the single source of
truth for minting: add a row, run this, the code goes live.

This is the one-way (sheet → Supabase) half of the sheet-driven invite system
(option A). It is INSERT-ONLY and idempotent: new codes are minted, codes that
already exist are left completely untouched (a redeemed code is never clobbered).
Redemption status is NOT written back to the sheet — check it with
scripts/list_invites.py. Spec: wiki/spec/invite_sheet_sync.md.

Typical use is in-session: Claude reads the sheet via the connected Google Drive
and pipes it in. You can also run it by hand with a saved export.

    # in-session (Claude pipes the sheet content it read from Drive):
    python scripts/sync_invites_from_sheet.py < sheet.md

    # preview without touching Supabase (no creds needed):
    python scripts/sync_invites_from_sheet.py --dry-run < sheet.md

    # from a CSV export of the sheet:
    python scripts/sync_invites_from_sheet.py --csv invites.csv

Input may be a Markdown pipe-table (what the Google Drive integration returns)
OR CSV — the format is auto-detected. Required column: `Code`. Optional columns
used: `Email`, `Recipient` (→ label/attribution), `Value` (e.g. "50 credits"
→ credit grant). Header matching is case-insensitive.

Needs SUPABASE_URL + SUPABASE_SERVICE_KEY (workspace .env, or set directly in the
environment) — except under --dry-run, which never calls the network.
"""
import argparse
import csv
import io
import os
import re
import sys
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')   # workspace-root .env (no override of real env)

DEFAULT_CREDITS = int(os.getenv('FREE_TRIAL_CREDITS', '50'))

# Header label (lower-cased) -> internal field. Several spellings map to the same field.
_FIELD_ALIASES = {
    'code': 'code',
    'email': 'email',
    'recipient': 'recipient',
    'name': 'recipient',
    'value': 'value',
    'credits': 'value',
}
_SEPARATOR_CELL = re.compile(r'^:?-+:?$')   # markdown table rule row, e.g. ":-:" or "---"


def _looks_like_markdown(text: str) -> bool:
    for line in text.splitlines():
        if line.strip():
            return line.lstrip().startswith('|') or line.count('|') >= 2
    return False


def _rows_from_markdown(text: str) -> list[list[str]]:
    rows = []
    for line in text.splitlines():
        line = line.strip()
        if not line or '|' not in line:
            continue
        cells = [c.strip() for c in line.strip('|').split('|')]
        if all(_SEPARATOR_CELL.match(c) for c in cells if c):   # skip the ":-:" rule row
            continue
        rows.append(cells)
    return rows


def _rows_from_csv(text: str) -> list[list[str]]:
    return [r for r in csv.reader(io.StringIO(text)) if any(c.strip() for c in r)]


def _parse_credits(value: str) -> int:
    m = re.search(r'\d+', value or '')
    return int(m.group()) if m else DEFAULT_CREDITS


def parse_sheet(text: str) -> list[dict]:
    """Parse pasted sheet text into [{code, label, credits}], skipping blank/code-less rows."""
    grid = _rows_from_markdown(text) if _looks_like_markdown(text) else _rows_from_csv(text)
    if not grid:
        return []

    header = [_FIELD_ALIASES.get(c.strip().lower()) for c in grid[0]]
    if 'code' not in header:
        raise SystemExit("❌ No 'Code' column found in the input. "
                         "Expected a header row with at least a Code column.")

    out, seen = [], set()
    for cells in grid[1:]:
        row = {}
        for field, val in zip(header, cells):
            if field:
                row[field] = val.strip()
        code = (row.get('code') or '').strip().upper()
        if not code:
            continue
        if code in seen:                       # sheet typo guard: first row wins
            continue
        seen.add(code)
        label = row.get('email') or row.get('recipient') or ''
        out.append({'code': code, 'label': label, 'credits': _parse_credits(row.get('value'))})
    return out


def _credentials() -> tuple[str, str]:
    try:
        return os.environ['SUPABASE_URL'].rstrip('/'), os.environ['SUPABASE_SERVICE_KEY']
    except KeyError as e:
        raise SystemExit(f"❌ Missing {e.args[0]}. Set SUPABASE_URL + SUPABASE_SERVICE_KEY "
                         "(workspace .env or the environment) — or use --dry-run.")


def sync(rows: list[dict]) -> list[str]:
    """Insert-only upsert. Returns the codes that were newly minted (existing ones skipped)."""
    url, key = _credentials()
    headers = {
        'Authorization': f'Bearer {key}',
        'apikey': key,
        'Content-Type': 'application/json',
        # ignore-duplicates => existing rows are left untouched; representation lists only the inserts.
        'Prefer': 'resolution=ignore-duplicates,return=representation',
    }
    r = requests.post(f'{url}/rest/v1/invite_codes', headers=headers, json=rows, timeout=30)
    if not r.ok:
        raise SystemExit(f"❌ Supabase rejected the sync ({r.status_code}): {r.text}")
    return [row['code'] for row in r.json()]


def main() -> int:
    ap = argparse.ArgumentParser(description='Sync invite codes from the tracker sheet to Supabase.')
    ap.add_argument('--csv', help='read sheet from this file instead of stdin')
    ap.add_argument('--dry-run', action='store_true',
                    help='parse and show what would be minted, without calling Supabase')
    args = ap.parse_args()

    text = Path(args.csv).read_text() if args.csv else sys.stdin.read()
    rows = parse_sheet(text)
    if not rows:
        print('No codes found in the input. Nothing to do.')
        return 0

    print(f"Parsed {len(rows)} code(s) from the sheet:")
    for row in rows:
        print(f"  {row['code']:<14} {row['credits']:>3}cr  {row['label']}")

    if args.dry_run:
        print("\n(dry run — nothing written to Supabase)")
        return 0

    minted = set(sync(rows))
    print()
    for row in rows:
        print(f"  {'✅ minted ' if row['code'] in minted else '· exists  '} {row['code']}")
    print(f"\n{len(minted)} new code(s) minted · {len(rows) - len(minted)} already existed.")
    print("Check redemptions any time with: python scripts/list_invites.py")
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
