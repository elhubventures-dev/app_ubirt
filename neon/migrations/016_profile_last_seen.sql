-- Auto-ported from supabase/migrations/016_profile_last_seen.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

alter table public.profiles
  add column if not exists last_seen_at timestamptz not null default now();

update public.profiles
set last_seen_at = now()
where last_seen_at is null;
