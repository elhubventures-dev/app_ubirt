-- Fix infinite RLS recursion on conversation_members.
-- Policies that subquery conversation_members from within conversation_members
-- policies cause PostgreSQL to recurse indefinitely.

create or replace function public.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "Members view membership" on public.conversation_members;
create policy "Members view membership"
  on public.conversation_members
  for select
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Members view conversations" on public.conversations;
create policy "Members view conversations"
  on public.conversations
  for select
  using (public.is_conversation_member(id));

drop policy if exists "Members view messages" on public.messages;
create policy "Members view messages"
  on public.messages
  for select
  using (public.is_conversation_member(conversation_id));

drop policy if exists "Members send messages" on public.messages;
create policy "Members send messages"
  on public.messages
  for insert
  with check (
    auth.uid() = sender_id
    and public.is_conversation_member(conversation_id)
  );

drop policy if exists "Members update conversations" on public.conversations;
create policy "Members update conversations"
  on public.conversations
  for update
  using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));
