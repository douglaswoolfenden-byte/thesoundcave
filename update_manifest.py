"""
Rebuilds data/manifest.json from all weekly JSON files and daily snapshots.
Run after scout.py or clan_tracker.py to keep the website in sync.
"""

import os
import json
import glob

DATA_DIR      = os.path.join(os.path.dirname(__file__), 'data')
SNAPSHOTS_DIR = os.path.join(DATA_DIR, 'snapshots')

def update_manifest():
    # Weekly reports
    week_files = sorted(glob.glob(os.path.join(DATA_DIR, '20*.json')))
    weeks = [os.path.basename(f) for f in week_files]

    # Daily snapshots
    snap_files = sorted(glob.glob(os.path.join(SNAPSHOTS_DIR, '20*.json')))
    snapshots = [os.path.basename(f) for f in snap_files]

    manifest = {
        'weeks': weeks,
        'snapshots': snapshots,
    }

    out = os.path.join(DATA_DIR, 'manifest.json')
    with open(out, 'w') as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest updated — {len(weeks)} week(s), {len(snapshots)} snapshot(s) indexed.")

if __name__ == '__main__':
    update_manifest()
