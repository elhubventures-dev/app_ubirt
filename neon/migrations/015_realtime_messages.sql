-- Auto-ported from supabase/migrations/015_realtime_messages.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

-- Enable Supabase Realtime for live DM delivery
alter table public.messages replica identity full;

do $$
begin
  -- [neon-port] skipped supabase_realtime publication (use Ably)

exception
  when duplicate_object then null;
end $$;
