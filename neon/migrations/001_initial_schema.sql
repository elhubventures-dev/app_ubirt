-- Auto-ported from supabase/migrations/001_initial_schema.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

-- UBIRT initial schema (run in Supabase SQL Editor or via CLI)

-- Profiles (extends public.app_users / Clerk)
create table if not exists public.profiles (
  id uuid primary key references public.app_users (id) on delete cascade,
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
    coalesce(new.raw_meta->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_meta->>'display_name', split_part(new.email, '@', 1)),
    new.raw_meta->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on public.app_users;
create trigger on_auth_user_created
  after insert on public.app_users
  for each row execute function public.handle_new_user();

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
-- [neon-port] skipped storage policy


-- [neon-port] skipped storage policy


-- [neon-port] skipped storage policy


-- [neon-port] skipped storage policy


-- Realtime for chat (Step 6)
alter table public.messages replica identity full;
