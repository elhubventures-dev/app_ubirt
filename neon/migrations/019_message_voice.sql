-- Auto-ported from supabase/migrations/019_message_voice.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

alter table public.messages
  add column if not exists media_url text,
  add column if not exists media_type text;

alter table public.messages drop constraint if exists messages_media_type_check;
alter table public.messages
  add constraint messages_media_type_check
  check (media_type is null or media_type in ('audio', 'image', 'video'));
