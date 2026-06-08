-- Tier 3 messaging: reactions, replies, post shares, mute/archive, themes, read-receipt pref.

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null,
  add column if not exists shared_post_id uuid references public.posts (id) on delete set null;

create index if not exists messages_reply_to_idx on public.messages (reply_to_id) where reply_to_id is not null;
create index if not exists messages_shared_post_idx on public.messages (shared_post_id) where shared_post_id is not null;

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_message_idx on public.message_reactions (message_id);

alter table public.message_reactions enable row level security;

create policy "Members view message reactions"
  on public.message_reactions
  for select
  using (
    exists (
      select 1 from public.messages m
      join public.conversation_members cm on cm.conversation_id = m.conversation_id
      where m.id = message_reactions.message_id and cm.user_id = auth.uid()
    )
  );

create policy "Members manage own reactions"
  on public.message_reactions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.conversation_members
  add column if not exists archived_at timestamptz,
  add column if not exists muted_until timestamptz,
  add column if not exists chat_theme text not null default 'default'
    check (chat_theme in ('default', 'midnight', 'ocean', 'violet', 'forest'));

alter table public.profiles
  add column if not exists show_read_receipts boolean not null default true;

alter table public.message_reactions replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception
  when duplicate_object then null;
end $$;
