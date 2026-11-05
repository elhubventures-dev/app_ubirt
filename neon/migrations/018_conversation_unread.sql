-- Auto-ported from supabase/migrations/018_conversation_unread.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

alter table public.conversation_members
  add column if not exists last_read_at timestamptz;

drop policy if exists "Users update own membership" on public.conversation_members;
create policy "Users update own membership"
  on public.conversation_members
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
