-- Auto-ported from supabase/migrations/020_messages_delete_policy.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

drop policy if exists "Members delete messages" on public.messages;
create policy "Members delete messages"
  on public.messages
  for delete
  using (public.is_conversation_member(conversation_id));
