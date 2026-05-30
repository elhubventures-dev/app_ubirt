-- UBIRT initial schema (run in Supabase SQL Editor or via CLI)

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text unique not null,
  display_name text,
  avatar_url text,
  created_at timestamptz default now()
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Posts (feed)
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null,
  media_url text,
  media_type text default 'video' check (media_type in ('video', 'image')),
  category text default 'general',
  likes_count int default 0,
  comments_count int default 0,
  created_at timestamptz default now()
);

create table if not exists public.post_likes (
  post_id uuid references public.posts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.post_bookmarks (
  post_id uuid references public.posts (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (post_id, user_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null,
  created_at timestamptz default now()
);

-- Messaging
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  title text,
  updated_at timestamptz default now()
);

create table if not exists public.conversation_members (
  conversation_id uuid references public.conversations (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  content text not null,
  status text default 'sent' check (status in ('sent', 'delivered', 'read')),
  created_at timestamptz default now()
);

-- Creator uploads
create table if not exists public.uploads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  category text default 'Product',
  visibility text default 'team' check (visibility in ('team', 'public', 'private')),
  status text default 'draft' check (status in ('draft', 'published')),
  storage_path text,
  media_url text,
  mux_asset_id text,
  mux_playback_id text,
  created_at timestamptz default now()
);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null,
  text text not null,
  read boolean default false,
  created_at timestamptz default now()
);

-- AI chat (per user)
create table if not exists public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text default 'UBIRT Assistant',
  created_at timestamptz default now()
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  text text not null,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.comments enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_members enable row level security;
alter table public.messages enable row level security;
alter table public.uploads enable row level security;
alter table public.notifications enable row level security;
alter table public.ai_conversations enable row level security;
alter table public.ai_messages enable row level security;

-- Profiles
create policy "Profiles are viewable by everyone" on public.profiles for select using (true);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

-- Posts
create policy "Posts are viewable by everyone" on public.posts for select using (true);
create policy "Users can insert own posts" on public.posts for insert with check (auth.uid() = user_id);
create policy "Users can update own posts" on public.posts for update using (auth.uid() = user_id);

-- Likes / bookmarks
create policy "Likes viewable" on public.post_likes for select using (true);
create policy "Users manage own likes" on public.post_likes for all using (auth.uid() = user_id);

create policy "Bookmarks viewable" on public.post_bookmarks for select using (true);
create policy "Users manage own bookmarks" on public.post_bookmarks for all using (auth.uid() = user_id);

-- Comments
create policy "Comments viewable" on public.comments for select using (true);
create policy "Users insert comments" on public.comments for insert with check (auth.uid() = user_id);

-- Conversations (members only)
create policy "Members view conversations" on public.conversations for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = id and cm.user_id = auth.uid())
);
create policy "Authenticated create conversations" on public.conversations for insert with check (auth.uid() is not null);

create policy "Members view membership" on public.conversation_members for select using (
  user_id = auth.uid() or exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = conversation_members.conversation_id and cm.user_id = auth.uid()
  )
);
create policy "Users join conversations" on public.conversation_members for insert with check (auth.uid() = user_id);

-- Messages
create policy "Members view messages" on public.messages for select using (
  exists (select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid())
);
create policy "Members send messages" on public.messages for insert with check (
  auth.uid() = sender_id and exists (
    select 1 from public.conversation_members cm where cm.conversation_id = conversation_id and cm.user_id = auth.uid()
  )
);

-- Uploads
create policy "Users view own uploads" on public.uploads for select using (auth.uid() = user_id or visibility = 'public');
create policy "Users manage own uploads" on public.uploads for all using (auth.uid() = user_id);

-- Notifications
create policy "Users view own notifications" on public.notifications for select using (auth.uid() = user_id);
create policy "Users update own notifications" on public.notifications for update using (auth.uid() = user_id);

-- AI
create policy "Users manage own ai conversations" on public.ai_conversations for all using (auth.uid() = user_id);
create policy "Users manage own ai messages" on public.ai_messages for all using (
  exists (select 1 from public.ai_conversations ac where ac.id = conversation_id and ac.user_id = auth.uid())
);

-- Storage buckets (create in Dashboard or via API; policies below assume bucket names)
insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "Authenticated upload files" on storage.objects for insert
  with check (bucket_id = 'uploads' and auth.uid() is not null);

create policy "Public read uploads" on storage.objects for select
  using (bucket_id = 'uploads');

create policy "Users upload avatars" on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "Public read avatars" on storage.objects for select
  using (bucket_id = 'avatars');

-- Realtime for chat (Step 6)
alter table public.messages replica identity full;
