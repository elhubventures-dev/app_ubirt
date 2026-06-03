-- 003_analytics_gamification.sql

-- 1. Add analytics columns to existing tables
alter table public.posts 
  add column if not exists views_count int default 0;

alter table public.profiles
  add column if not exists xp int default 0,
  add column if not exists level int default 1;

-- 2. Follows Table
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

alter table public.follows enable row level security;
create policy "Follows viewable by everyone" on public.follows for select using (true);
create policy "Users manage own follows" on public.follows for all using (auth.uid() = follower_id);

-- 3. Achievements Table
create table if not exists public.user_achievements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  badge_id text not null,
  unlocked_at timestamptz default now(),
  unique(user_id, badge_id)
);

alter table public.user_achievements enable row level security;
create policy "Achievements viewable by everyone" on public.user_achievements for select using (true);
-- Achievements should only be insertable by system/RPCs to prevent cheating, 
-- but for simplicity in this MVP we allow the user to insert their own via RPC.

-- 4. RPCs for secure increments

-- Increment views count safely
create or replace function public.increment_post_views(p_post_id uuid)
returns void
language plpgsql security definer
as $$
begin
  update public.posts
  set views_count = views_count + 1
  where id = p_post_id;
end;
$$;

-- Add XP and auto level-up safely
create or replace function public.add_user_xp(p_user_id uuid, p_amount int)
returns void
language plpgsql security definer
as $$
declare
  v_current_xp int;
  v_current_level int;
  v_new_xp int;
  v_new_level int;
begin
  select xp, level into v_current_xp, v_current_level from public.profiles where id = p_user_id;
  
  v_new_xp := coalesce(v_current_xp, 0) + p_amount;
  
  -- Simple level formula: Level = floor(sqrt(XP / 100)) + 1
  -- E.g., 0 XP = Lvl 1, 100 XP = Lvl 2, 400 XP = Lvl 3, 900 XP = Lvl 4
  v_new_level := floor(sqrt(v_new_xp / 100.0)) + 1;
  
  if v_new_level < 1 then
     v_new_level := 1;
  end if;

  update public.profiles
  set xp = v_new_xp, level = v_new_level
  where id = p_user_id;
end;
$$;

-- Toggle follow safely
create or replace function public.toggle_follow(p_following_id uuid)
returns boolean
language plpgsql security definer
as $$
declare
  v_follower_id uuid := auth.uid();
  v_exists boolean;
begin
  if v_follower_id is null then
    raise exception 'Not authenticated';
  end if;

  select exists(
    select 1 from public.follows 
    where follower_id = v_follower_id and following_id = p_following_id
  ) into v_exists;

  if v_exists then
    delete from public.follows where follower_id = v_follower_id and following_id = p_following_id;
    return false; -- Unfollowed
  else
    insert into public.follows (follower_id, following_id) values (v_follower_id, p_following_id);
    return true; -- Followed
  end if;
end;
$$;
