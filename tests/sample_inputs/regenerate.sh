#!/usr/bin/env bash
# Regenerate the hermetic sample audio fixture used by Tier 1 smoke tests.
# .mp3 is gitignored repo-wide, so this script reproduces the fixture deterministically.
set -euo pipefail
cd "$(dirname "$0")"
ffmpeg -y -hide_banner -loglevel error \
  -f lavfi -i "sine=frequency=440:duration=8" \
  -ar 44100 -b:a 192k \
  sample_track.mp3
echo "regenerated: $(pwd)/sample_track.mp3"
