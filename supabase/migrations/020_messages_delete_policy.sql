drop policy if exists "Members delete messages" on public.messages;
create policy "Members delete messages"
  on public.messages
  for delete
  using (public.is_conversation_member(conversation_id));
