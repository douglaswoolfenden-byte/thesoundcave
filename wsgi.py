"""Production WSGI entrypoint (Railway / gunicorn).

Decisions 0003 + 0006: the Flask backend runs on Railway under gunicorn, which
imports this module and serves `app`. It never executes content_api.py's
`__main__` block, so the scheduled-post executor is started here explicitly.

Run with a SINGLE worker (see Procfile) so exactly one APScheduler instance
ticks — multiple workers would each start one and fire scheduled posts N times.
"""
from content_api import app, _start_executor

_start_executor()
