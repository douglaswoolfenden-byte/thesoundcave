"""
Rebuilds data/manifest.json from all weekly JSON files.
Run after scout.py to keep the website in sync.
"""

import os
import json
import glob

DATA_DIR = os.path.join(os.path.dirname(__file__), 'data')

def update_manifest():
    files   = sorted(glob.glob(os.path.join(DATA_DIR, '20*.json')))
    weeks   = [os.path.basename(f) for f in files]
    manifest = {'weeks': weeks}

    out = os.path.join(DATA_DIR, 'manifest.json')
    with open(out, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest updated — {len(weeks)} week(s) indexed.")

if __name__ == '__main__':
    update_manifest()
