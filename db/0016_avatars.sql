-- Sound Cave — Image Gen v2 Phase 2: avatars
-- Spec: wiki/spec/image_gen_v2.md (approved 2026-05-28)
-- Avatars are recurring characters / mascots / specific people that
-- generations should reproduce consistently (FLUX.2 + ref-passing in v1;
-- LoRA in a future v2). Each avatar belongs to one user (RLS-scoped).
-- Idempotent.

create table if not exists public.avatars (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text,
  reference_image_urls text[] not null default '{}',
  preview_url text,
  lora_weights_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists avatars_user_created_idx
  on public.avatars(user_id, created_at desc);

alter table public.avatars enable row level security;

drop policy if exists avatars_owner_all on public.avatars;
create policy avatars_owner_all on public.avatars
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- updated_at trigger (idempotent — uses helper if it exists, else inlines)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'set_updated_at_now') then
    drop trigger if exists avatars_updated_at on public.avatars;
    create trigger avatars_updated_at
      before update on public.avatars
      for each row execute function public.set_updated_at_now();
  end if;
end $$;
