alter table public.profiles
  add column if not exists last_seen_at timestamptz not null default now();

update public.profiles
set last_seen_at = now()
where last_seen_at is null;
