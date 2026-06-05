-- Gift transfers with 80% to creator, 20% platform fee

create table if not exists public.gifts (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid references public.posts (id) on delete set null,
  amount int not null check (amount > 0),
  receiver_amount int not null check (receiver_amount >= 0),
  platform_fee int not null check (platform_fee >= 0),
  created_at timestamptz not null default now(),
  check (receiver_amount + platform_fee = amount)
);

create index if not exists gifts_receiver_id_created_at_idx
  on public.gifts (receiver_id, created_at desc);

create index if not exists gifts_sender_id_created_at_idx
  on public.gifts (sender_id, created_at desc);

alter table public.gifts enable row level security;

create policy "Users view own gifts"
  on public.gifts
  for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

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
  v_receiver_amount int;
  v_platform_fee int;
  v_sender_balance int;
  v_receiver_balance int;
  v_sender_name text;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
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
    raise exception 'Insufficient coins';
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
  set coins = coins + v_receiver_amount
  where id = v_receiver_id
  returning coins into v_receiver_balance;

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
      || ' coins (80%).'
  );

  return json_build_object(
    'success', true,
    'amount', p_amount,
    'receiver_amount', v_receiver_amount,
    'platform_fee', v_platform_fee,
    'sender_balance', v_sender_balance,
    'receiver_balance', v_receiver_balance,
    'receiver_id', v_receiver_id
  );
end;
$$;

revoke all on function public.send_gift(uuid, int) from public;
grant execute on function public.send_gift(uuid, int) to authenticated;
