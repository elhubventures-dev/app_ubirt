-- Auto-ported from supabase/migrations/028_read_receipts_realtime.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

-- Enable realtime updates for read receipts (last_read_at on conversation_members).
alter table public.conversation_members replica identity full;

do $$
begin
  -- [neon-port] skipped supabase_realtime publication (use Ably)

exception
  when duplicate_object then null;
end $$;
