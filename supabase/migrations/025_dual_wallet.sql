-- 025_dual_wallet.sql
-- Split wallet into platform coins (purchases + signup) and gift coins (creator earnings).

alter table public.profiles
  add column if not exists gift_coins int not null default 0 check (gift_coins >= 0);

comment on column public.profiles.coins is 'Platform coins: signup bonus + purchases. Spent on in-app actions (e.g. sending gifts).';
comment on column public.profiles.gift_coins is 'Gift coins: received from fans. Convert to platform coins or withdraw.';

-- Move historical gift earnings out of the shared balance.
with gift_totals as (
  select receiver_id, coalesce(sum(receiver_amount), 0)::int as total
  from public.gifts
  group by receiver_id
)
update public.profiles p
set
  gift_coins = gt.total,
  coins = greatest(0, p.coins - gt.total)
from gift_totals gt
where p.id = gt.receiver_id
  and gt.total > 0;

create table if not exists public.wallet_conversions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount > 0),
  from_wallet text not null default 'gift' check (from_wallet = 'gift'),
  to_wallet text not null default 'platform' check (to_wallet = 'platform'),
  created_at timestamptz not null default now()
);

create index if not exists wallet_conversions_user_id_created_at_idx
  on public.wallet_conversions (user_id, created_at desc);

alter table public.wallet_conversions enable row level security;

create policy "Users view own wallet conversions"
  on public.wallet_conversions
  for select
  using (auth.uid() = user_id);

-- Platform coin credits (purchases, signup) stay on profiles.coins
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

create or replace function public.send_gift(p_post_id uuid, p_amount int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_receiver_id uuid;
  v_sender_coins int;
  v_sender_balance int;
  v_receiver_gift_balance int;
  v_receiver_amount int;
  v_platform_fee int;
  v_sender_name text;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Gift amount must be positive';
  end if;

  select user_id into v_receiver_id
  from public.posts
  where id = p_post_id;

  if v_receiver_id is null then
    raise exception 'Post not found';
  end if;

  if v_receiver_id = v_sender_id then
    raise exception 'You cannot send a gift to yourself';
  end if;

  select coins into v_sender_coins
  from public.profiles
  where id = v_sender_id
  for update;

  if v_sender_coins is null then
    raise exception 'Sender profile not found';
  end if;

  if v_sender_coins < p_amount then
    raise exception 'Insufficient platform coins';
  end if;

  v_receiver_amount := floor(p_amount * 0.8)::int;
  v_platform_fee := p_amount - v_receiver_amount;

  perform 1
  from public.profiles
  where id = v_receiver_id
  for update;

  update public.profiles
  set coins = coins - p_amount
  where id = v_sender_id
  returning coins into v_sender_balance;

  update public.profiles
  set gift_coins = gift_coins + v_receiver_amount
  where id = v_receiver_id
  returning gift_coins into v_receiver_gift_balance;

  insert into public.gifts (
    sender_id,
    receiver_id,
    post_id,
    amount,
    receiver_amount,
    platform_fee
  )
  values (
    v_sender_id,
    v_receiver_id,
    p_post_id,
    p_amount,
    v_receiver_amount,
    v_platform_fee
  );

  select display_name into v_sender_name
  from public.profiles
  where id = v_sender_id;

  perform public.create_notification(
    v_receiver_id,
    'gift',
    coalesce(v_sender_name, 'Someone')
      || ' sent you a gift of '
      || p_amount
      || ' coins. You received '
      || v_receiver_amount
      || ' gift coins (80%).',
    v_sender_id,
    p_post_id,
    null
  );

  return json_build_object(
    'success', true,
    'amount', p_amount,
    'receiver_amount', v_receiver_amount,
    'platform_fee', v_platform_fee,
    'sender_balance', v_sender_balance,
    'receiver_gift_balance', v_receiver_gift_balance,
    'receiver_id', v_receiver_id
  );
end;
$$;

create or replace function public.convert_gift_coins(p_amount int)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_gift_balance int;
  v_platform_balance int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;

  select gift_coins into v_gift_balance
  from public.profiles
  where id = v_user_id
  for update;

  if v_gift_balance is null then
    raise exception 'Profile not found';
  end if;

  if v_gift_balance < p_amount then
    raise exception 'Insufficient gift coins';
  end if;

  update public.profiles
  set
    gift_coins = gift_coins - p_amount,
    coins = coins + p_amount
  where id = v_user_id
  returning gift_coins, coins
  into v_gift_balance, v_platform_balance;

  insert into public.wallet_conversions (user_id, amount)
  values (v_user_id, p_amount);

  return json_build_object(
    'success', true,
    'amount', p_amount,
    'gift_balance', v_gift_balance,
    'platform_balance', v_platform_balance
  );
end;
$$;

revoke all on function public.convert_gift_coins(int) from public;
grant execute on function public.convert_gift_coins(int) to authenticated;
