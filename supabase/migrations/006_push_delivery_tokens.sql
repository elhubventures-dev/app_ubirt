-- 006_push_delivery_tokens.sql
-- Production push delivery: multi-device token registry with provider/platform metadata.

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null unique,
  provider text not null default 'fcm' check (provider in ('fcm', 'apns')),
  platform text not null default 'android' check (platform in ('android', 'ios', 'web', 'unknown')),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id, enabled);

alter table public.push_tokens enable row level security;

drop policy if exists "Users manage own push tokens" on public.push_tokens;
create policy "Users manage own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create or replace function public.touch_push_tokens_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_push_tokens_updated_at on public.push_tokens;
create trigger trg_touch_push_tokens_updated_at
before update on public.push_tokens
for each row execute function public.touch_push_tokens_updated_at();

-- Backfill existing single profile token into push_tokens table as Android/FCM.
insert into public.push_tokens (user_id, token, provider, platform, enabled, last_seen_at)
select p.id, p.device_token, 'fcm', 'android', true, now()
from public.profiles p
where p.device_token is not null
on conflict (token) do update
set user_id = excluded.user_id,
    enabled = true,
    last_seen_at = now();
