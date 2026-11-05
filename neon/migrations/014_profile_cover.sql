-- Auto-ported from supabase/migrations/014_profile_cover.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

alter table public.profiles
  add column if not exists cover_url text;
