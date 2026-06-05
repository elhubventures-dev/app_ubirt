-- Link notifications to the pages they reference
alter table public.notifications
  add column if not exists actor_id uuid references public.profiles (id) on delete set null,
  add column if not exists post_id uuid references public.posts (id) on delete set null,
  add column if not exists conversation_id uuid references public.conversations (id) on delete set null;

create or replace function public.create_notification(
  p_recipient_id uuid,
  p_type text,
  p_text text,
  p_actor_id uuid default null,
  p_post_id uuid default null,
  p_conversation_id uuid default null
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

  insert into public.notifications (
    user_id,
    type,
    text,
    read,
    actor_id,
    post_id,
    conversation_id
  )
  values (
    p_recipient_id,
    p_type,
    p_text,
    false,
    coalesce(p_actor_id, v_actor_id),
    p_post_id,
    p_conversation_id
  )
  returning id into v_id;

  return v_id;
end;
$$;

grant execute on function public.create_notification(uuid, text, text, uuid, uuid, uuid) to authenticated;

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
    coalesce(v_follower_name, 'Someone') || ' started following you',
    v_follower_id,
    null,
    null
  );

  return true;
end;
$$;

create or replace function public.send_gift(
  p_post_id uuid,
  p_amount int
)
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
  v_receiver_balance int;
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
      || ' coins (80%).',
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
    'receiver_balance', v_receiver_balance
  );
end;
$$;
