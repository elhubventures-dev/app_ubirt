create table if not exists public.message_hides (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (message_id, user_id)
);

create index if not exists message_hides_user_id_idx on public.message_hides (user_id);
create index if not exists message_hides_message_id_idx on public.message_hides (message_id);

alter table public.message_hides enable row level security;

drop policy if exists "Users hide messages for themselves" on public.message_hides;
create policy "Users hide messages for themselves"
  on public.message_hides
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_id
        and cm.user_id = auth.uid()
    )
  );

drop policy if exists "Users view own hides" on public.message_hides;
create policy "Users view own hides"
  on public.message_hides
  for select
  using (auth.uid() = user_id);

drop policy if exists "Users remove own hides" on public.message_hides;
create policy "Users remove own hides"
  on public.message_hides
  for delete
  using (auth.uid() = user_id);

drop policy if exists "Members delete messages" on public.messages;
drop policy if exists "Senders delete messages for everyone" on public.messages;
create policy "Senders delete messages for everyone"
  on public.messages
  for delete
  using (
    auth.uid() = sender_id
    and public.is_conversation_member(conversation_id)
  );
