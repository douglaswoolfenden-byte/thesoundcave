"""
One-off: create the generated_assets Supabase Storage bucket (public read).
Spec: wiki/spec/image_gen_v2.md (Phase 2 — /api/generate output storage).
Idempotent — safe to re-run.

Run from project root with venv active:
    python scripts/create_generated_assets_bucket.py
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parent.parent
load_dotenv(PROJECT_ROOT.parent.parent / '.env')

URL = os.environ['SUPABASE_URL'].rstrip('/')
SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
BUCKET = 'generated_assets'


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


if __name__ == '__main__':
    main()
