-- 004_wallet_mux_push_notifications.sql
-- P0 production schema: wallet, Paystack ledger, push tokens, feed Mux, live notifications.

-- 1. Wallet + push on profiles
alter table public.profiles
  add column if not exists coins int not null default 1000;

alter table public.profiles
  add column if not exists device_token text;

-- 2. Paystack purchase ledger (service role writes via webhook)
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  reference text not null unique,
  amount bigint not null,
  status text not null default 'success'
    check (status in ('pending', 'success', 'failed')),
  coins_added int not null,
  email text,
  created_at timestamptz not null default now()
);

create index if not exists transactions_user_id_created_at_idx
  on public.transactions (user_id, created_at desc);

alter table public.transactions enable row level security;

create policy "Users view own transactions"
  on public.transactions
  for select
  using (auth.uid() = user_id);

-- 3. Mux fields on feed posts
alter table public.posts
  add column if not exists mux_asset_id text,
  add column if not exists mux_playback_id text;

-- 4. Safe coin credit for Paystack webhook
create or replace function public.add_user_coins(p_user_id uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'p_amount must be positive';
  end if;

  update public.profiles
  set coins = coalesce(coins, 0) + p_amount
  where id = p_user_id
  returning coins into v_new_balance;

  if not found then
    raise exception 'Profile not found: %', p_user_id;
  end if;

  return v_new_balance;
end;
$$;

revoke all on function public.add_user_coins(uuid, int) from public;
grant execute on function public.add_user_coins(uuid, int) to service_role;

-- 5. Notification creation (bypasses RLS; skips self-notifications)
create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_text text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_id uuid;
begin
  if v_actor_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_recipient_id is null or p_recipient_id = v_actor_id then
    return null;
  end if;

  insert into public.notifications (user_id, type, text, read)
  values (p_recipient_id, p_type, p_text, false)
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, text) to authenticated;

-- 6. Follow notifications inside toggle_follow
create or replace function public.toggle_follow(p_following_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_follower_id uuid := auth.uid();
  v_exists boolean;
  v_follower_name text;
begin
  if v_follower_id is null then
    raise exception 'Not authenticated';
  end if;

  if v_follower_id = p_following_id then
    raise exception 'Cannot follow yourself';
  end if;

  select exists(
    select 1 from public.follows
    where follower_id = v_follower_id and following_id = p_following_id
  ) into v_exists;

  if v_exists then
    delete from public.follows
    where follower_id = v_follower_id and following_id = p_following_id;
    return false;
  end if;

  insert into public.follows (follower_id, following_id)
  values (v_follower_id, p_following_id);

  select display_name into v_follower_name
  from public.profiles
  where id = v_follower_id;

  perform public.create_notification(
    p_following_id,
    'follow',
    coalesce(v_follower_name, 'Someone') || ' started following you'
  );

  return true;
end;
$$;

-- 7. Realtime for notifications inbox
alter table public.notifications replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
end $$;
