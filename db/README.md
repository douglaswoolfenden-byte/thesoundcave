# db/

SQL migrations for Sound Cave's Supabase project.

## Files

- `0001_init.sql` — schema (tables, enums, indexes)
- `0002_rls.sql` — Row Level Security policies
- `0003_storage.sql` — RLS on `storage.objects` for `generated_images` + `generated_videos` buckets
- `0004_auth_sync.sql` — auth.users → public.users sync trigger (Phase B)
- `0005_credits.sql` — credits ledger helpers (Phase C)
- `0006_billing.sql` — Stripe billing + subscriptions (Phase D)
- `0007_audio_tracks.sql` — audio_tracks table + clipping-ready columns on stash_items (Stream 2)
- `0008`–`0018` — see file headers (this index went stale; each migration's first comment block describes it)
- `0019_artist_tracking.sql` — Clan Data Tracking v2: `tracked_artists` registry + `artist_snapshots` time-series + `snapshot_runs` log (spec: wiki/spec/clan_data_tracking_v2.md)

All idempotent — safe to re-run.

## Buckets (created via REST or dashboard, not SQL)

- `generated_images` — public read
- `generated_videos` — public read
- `audio_tracks` — **private** (owner-only read; user uploads stay scoped). Create
  with `supabase.storage.create_bucket('audio_tracks', options={'public': False})`
  or via the Supabase dashboard before running 0007.

## Apply

Connection: pooler at `aws-1-eu-west-2.pooler.supabase.com:6543`, user `postgres.agmmdrqmjywggtsycsri`, password from `SUPABASE_DB_PASSWORD`.

```bash
# from project root, with venv active
python3 - <<'PY'
import os, urllib.parse, psycopg
from dotenv import load_dotenv
load_dotenv('../../.env')
pwd = urllib.parse.quote_plus(os.environ['SUPABASE_DB_PASSWORD'])
dsn = f"postgresql://postgres.agmmdrqmjywggtsycsri:{pwd}@aws-1-eu-west-2.pooler.supabase.com:6543/postgres?sslmode=require"
for f in ['db/0001_init.sql','db/0002_rls.sql']:
    with psycopg.connect(dsn) as c, c.cursor() as cur:
        cur.execute(open(f).read()); c.commit()
    print('applied', f)
PY
```

## Verify

```sql
select tablename, rowsecurity from pg_tables where schemaname='public';
```

All six tables (`users`, `artists`, `stash_items`, `credits_ledger`, `scheduled_posts`, `connected_accounts`) should return `rowsecurity = t`.
