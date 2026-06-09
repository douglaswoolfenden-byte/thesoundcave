#!/usr/bin/env bash
# Sound Cave dev launcher.
# Starts the API (port 8000) AND the static site (port 3000) in one command.
# Open http://localhost:3000 in your browser. Ctrl+C kills both.

set -e
cd "$(dirname "$0")"

# venv lives in venv.nosync — the `.nosync` suffix keeps iCloud Drive from
# evicting the package files (this project sits under ~/Documents, which syncs).
# Do NOT use a plain `venv/` symlink: iCloud mangles symlinks.
VENV=venv.nosync

if [ ! -x "$VENV/bin/python" ]; then
  echo "⚙️  venv missing — creating $VENV and installing requirements…"
  python3 -m venv "$VENV"
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
  pip install --quiet --upgrade pip && pip install --quiet -r requirements.txt
else
  # shellcheck disable=SC1091
  source "$VENV/bin/activate"
fi

cleanup() {
  echo ""
  echo "🛑 Shutting down…"
  [ -n "${API_PID:-}" ] && kill "$API_PID" 2>/dev/null || true
  [ -n "${WEB_PID:-}" ] && kill "$WEB_PID" 2>/dev/null || true
  exit 0
}
trap cleanup INT TERM

# Free the ports if a previous run got stuck
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

echo "🔥 Starting API on http://localhost:8000 …"
python -u content_api.py > /tmp/soundcave_api.log 2>&1 &
API_PID=$!

echo "🌐 Starting website on http://localhost:3000 …"
python -u -m http.server 3000 > /tmp/soundcave_web.log 2>&1 &
WEB_PID=$!

# Wait for both ports to actually accept connections.
# Flask debug mode + APScheduler take ~8–12s to bind on first run.
wait_for_port() {
  local port=$1 name=$2 max=${3:-30}
  for i in $(seq 1 "$max"); do
    if lsof -ti:"$port" >/dev/null 2>&1 && curl -s -o /dev/null --max-time 1 "http://localhost:$port/" 2>/dev/null; then
      echo "   ✓ $name ready (port $port, ${i}s)"
      return 0
    fi
    # Bail early if the process died
    if ! kill -0 "$3" 2>/dev/null && [ -n "$3" ]; then :; fi
    sleep 1
  done
  echo "   ✗ $name never bound to port $port after ${max}s"
  echo "     tail of /tmp/soundcave_${name}.log:"
  tail -20 "/tmp/soundcave_${name}.log" | sed 's/^/       /'
  return 1
}

echo ""
echo "⏳ Waiting for servers to be ready (don't open browser yet)…"
wait_for_port 3000 web 15 || { cleanup; exit 1; }
wait_for_port 8000 api 30 || { cleanup; exit 1; }

echo ""
echo "✅ Sound Cave is fully running — login will work now."
echo "   👉 Open this in your browser:  http://localhost:3000"
echo ""
echo "   API logs:  tail -f /tmp/soundcave_api.log"
echo "   Web logs:  tail -f /tmp/soundcave_web.log"
echo ""
echo "Press Ctrl+C to stop everything."

wait
