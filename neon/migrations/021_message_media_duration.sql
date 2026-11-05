-- Auto-ported from supabase/migrations/021_message_media_duration.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

alter table public.messages
  add column if not exists media_duration real;
