"""
One-off: create the event_flyers Supabase Storage bucket (public read).
Idempotent — safe to re-run.

Run from project root with venv active:
    python scripts/create_event_flyers_bucket.py
"""
import os
import urllib.parse
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')

URL = os.environ['SUPABASE_URL'].rstrip('/')
SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
BUCKET = 'event_flyers'


def main():
    headers = {
        'Authorization': f'Bearer {SERVICE_KEY}',
        'apikey': SERVICE_KEY,
        'Content-Type': 'application/json',
    }
    r = requests.post(
        f'{URL}/storage/v1/bucket',
        headers=headers,
        json={'id': BUCKET, 'name': BUCKET, 'public': True},
        timeout=10,
    )
    if r.status_code == 200:
        print(f'created bucket {BUCKET}')
    elif r.status_code == 409 or 'already exists' in r.text.lower():
        print(f'bucket {BUCKET} already exists — nothing to do')
    else:
        print(f'create_bucket failed: {r.status_code} {r.text}')
        r.raise_for_status()


if __name__ == '__main__':
    main()
