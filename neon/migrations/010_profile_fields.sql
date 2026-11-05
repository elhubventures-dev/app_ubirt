-- Auto-ported from supabase/migrations/010_profile_fields.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

-- Extended profile fields for edit profile
alter table public.profiles
  add column if not exists bio text,
  add column if not exists phone text,
  add column if not exists website text,
  add column if not exists location text;
