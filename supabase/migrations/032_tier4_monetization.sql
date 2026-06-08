-- Tier 4 creator monetization: subscriptions, tips, promotions, referrals, link tracking.

alter table public.profiles
  add column if not exists subscription_price_coins int check (subscription_price_coins is null or subscription_price_coins >= 50),
  add column if not exists subscription_description text,
  add column if not exists tip_min_coins int not null default 10 check (tip_min_coins >= 1),
  add column if not exists paid_dm_price_coins int check (paid_dm_price_coins is null or paid_dm_price_coins >= 10),
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

alter table public.posts
  add column if not exists subscribers_only boolean not null default false;

create index if not exists posts_subscribers_only_idx
  on public.posts (user_id, subscribers_only) where subscribers_only = true;

-- Active creator subscriptions (30-day access via platform coins)
create table if not exists public.creator_subscriptions (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  subscriber_id uuid not null references public.profiles (id) on delete cascade,
  price_paid int not null check (price_paid > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (creator_id, subscriber_id),
  check (creator_id <> subscriber_id)
);

create index if not exists creator_subscriptions_subscriber_idx
  on public.creator_subscriptions (subscriber_id, expires_at desc);

alter table public.creator_subscriptions enable row level security;

create policy "Users view own subscriptions"
  on public.creator_subscriptions
  for select
  using (auth.uid() = subscriber_id or auth.uid() = creator_id);

-- Profile tips and paid DMs
create table if not exists public.creator_tips (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles (id) on delete cascade,
  receiver_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount > 0),
  receiver_amount int not null check (receiver_amount >= 0),
  platform_fee int not null check (platform_fee >= 0),
  tip_type text not null check (tip_type in ('tip', 'paid_dm')),
  message text,
  conversation_id uuid references public.conversations (id) on delete set null,
  created_at timestamptz not null default now(),
  check (sender_id <> receiver_id),
  check (receiver_amount + platform_fee = amount)
);

create index if not exists creator_tips_receiver_idx
  on public.creator_tips (receiver_id, created_at desc);

alter table public.creator_tips enable row level security;

create policy "Users view own tips"
  on public.creator_tips
  for select
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

-- Self-serve post promotion
create table if not exists public.post_promotions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  coins_spent int not null check (coins_spent > 0),
  boost_score int not null check (boost_score > 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists post_promotions_active_idx
  on public.post_promotions (post_id, expires_at desc);

alter table public.post_promotions enable row level security;

create policy "Anyone can view active promotions"
  on public.post_promotions
  for select
  using (true);

create policy "Users create own promotions"
  on public.post_promotions
  for insert
  with check (auth.uid() = user_id);

-- Referral tracking
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referred_id uuid not null references public.profiles (id) on delete cascade,
  bonus_coins int not null default 50 check (bonus_coins > 0),
  created_at timestamptz not null default now(),
  unique (referred_id),
  check (referrer_id <> referred_id)
);

alter table public.referrals enable row level security;

create policy "Users view own referrals"
  on public.referrals
  for select
  using (auth.uid() = referrer_id or auth.uid() = referred_id);

-- Profile link click analytics
create table if not exists public.profile_link_clicks (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profile_link_clicks_profile_idx
  on public.profile_link_clicks (profile_id, created_at desc);

alter table public.profile_link_clicks enable row level security;

create policy "Profile owners view link clicks"
  on public.profile_link_clicks
  for select
  using (auth.uid() = profile_id);

create policy "Authenticated users record link clicks"
  on public.profile_link_clicks
  for insert
  with check (auth.uid() is not null);

-- Ensure referral codes exist for existing profiles
update public.profiles
set referral_code = lower(username)
where referral_code is null and username is not null;

-- ---------------------------------------------------------------------------
-- Subscribe to creator (30 days, platform coins, 80/20 split)
-- ---------------------------------------------------------------------------
create or replace function public.subscribe_to_creator(p_creator_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_subscriber_id uuid := auth.uid();
  v_price int;
  v_sender_coins int;
  v_receiver_amount int;
  v_platform_fee int;
  v_expires_at timestamptz;
  v_sender_name text;
begin
  if v_subscriber_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_creator_id = v_subscriber_id then
    raise exception 'You cannot subscribe to yourself';
  end if;

  select subscription_price_coins into v_price
  from public.profiles where id = p_creator_id;

  if v_price is null or v_price < 50 then
    raise exception 'This creator has not enabled subscriptions';
  end if;

  select coins into v_sender_coins from public.profiles where id = v_subscriber_id for update;
  if coalesce(v_sender_coins, 0) < v_price then
    raise exception 'Insufficient platform coins';
  end if;

  v_receiver_amount := floor(v_price * 0.8)::int;
  v_platform_fee := v_price - v_receiver_amount;
  v_expires_at := now() + interval '30 days';

  perform 1 from public.profiles where id = p_creator_id for update;

  update public.profiles set coins = coins - v_price where id = v_subscriber_id;
  update public.profiles set gift_coins = gift_coins + v_receiver_amount where id = p_creator_id;

  insert into public.creator_subscriptions (creator_id, subscriber_id, price_paid, expires_at)
  values (p_creator_id, v_subscriber_id, v_price, v_expires_at)
  on conflict (creator_id, subscriber_id)
  do update set
    price_paid = excluded.price_paid,
    expires_at = greatest(public.creator_subscriptions.expires_at, excluded.expires_at),
    updated_at = now();

  select display_name into v_sender_name from public.profiles where id = v_subscriber_id;

  perform public.create_notification(
    p_creator_id,
    'subscription',
    coalesce(v_sender_name, 'Someone') || ' subscribed to you for 30 days',
    v_subscriber_id,
    null,
    null
  );

  return json_build_object(
    'success', true,
    'price', v_price,
    'receiver_amount', v_receiver_amount,
    'platform_fee', v_platform_fee,
    'expires_at', v_expires_at
  );
end;
$$;

grant execute on function public.subscribe_to_creator(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Send tip or paid DM
-- ---------------------------------------------------------------------------
create or replace function public.send_creator_tip(
  p_receiver_id uuid,
  p_amount int,
  p_message text default null,
  p_tip_type text default 'tip'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sender_id uuid := auth.uid();
  v_sender_coins int;
  v_receiver_amount int;
  v_platform_fee int;
  v_min_amount int;
  v_paid_dm_price int;
  v_conv_id uuid;
  v_sender_name text;
begin
  if v_sender_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_receiver_id = v_sender_id then
    raise exception 'You cannot tip yourself';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Amount must be positive';
  end if;
  if p_tip_type not in ('tip', 'paid_dm') then
    raise exception 'Invalid tip type';
  end if;

  select tip_min_coins, paid_dm_price_coins
  into v_min_amount, v_paid_dm_price
  from public.profiles where id = p_receiver_id;

  if p_tip_type = 'paid_dm' then
    if v_paid_dm_price is null then
      raise exception 'This creator has not enabled paid DMs';
    end if;
    if p_amount < v_paid_dm_price then
      raise exception 'Paid DM requires at least % coins', v_paid_dm_price;
    end if;
  elsif p_amount < coalesce(v_min_amount, 10) then
    raise exception 'Minimum tip is % coins', coalesce(v_min_amount, 10);
  end if;

  select coins into v_sender_coins from public.profiles where id = v_sender_id for update;
  if coalesce(v_sender_coins, 0) < p_amount then
    raise exception 'Insufficient platform coins';
  end if;

  v_receiver_amount := floor(p_amount * 0.8)::int;
  v_platform_fee := p_amount - v_receiver_amount;

  perform 1 from public.profiles where id = p_receiver_id for update;

  update public.profiles set coins = coins - p_amount where id = v_sender_id;
  update public.profiles set gift_coins = gift_coins + v_receiver_amount where id = p_receiver_id;

  if p_tip_type = 'paid_dm' then
    select public.create_direct_conversation(p_receiver_id) into v_conv_id;
    insert into public.messages (conversation_id, sender_id, content, status)
    values (
      v_conv_id,
      v_sender_id,
      coalesce(nullif(trim(p_message), ''), '💎 Paid message'),
      'sent'
    );
  end if;

  insert into public.creator_tips (
    sender_id, receiver_id, amount, receiver_amount, platform_fee, tip_type, message, conversation_id
  )
  values (
    v_sender_id, p_receiver_id, p_amount, v_receiver_amount, v_platform_fee, p_tip_type,
    nullif(trim(p_message), ''), v_conv_id
  );

  select display_name into v_sender_name from public.profiles where id = v_sender_id;

  perform public.create_notification(
    p_receiver_id,
    'gift',
    coalesce(v_sender_name, 'Someone')
      || case when p_tip_type = 'paid_dm' then ' sent a paid message (' else ' sent a tip (' end
      || p_amount || ' coins)',
    v_sender_id,
    null,
    v_conv_id
  );

  return json_build_object(
    'success', true,
    'amount', p_amount,
    'receiver_amount', v_receiver_amount,
    'conversation_id', v_conv_id
  );
end;
$$;

grant execute on function public.send_creator_tip(uuid, int, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Promote post (coins → boost score for 24h default)
-- ---------------------------------------------------------------------------
create or replace function public.promote_post(
  p_post_id uuid,
  p_coins int,
  p_hours int default 24
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_post_owner uuid;
  v_sender_coins int;
  v_expires_at timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_coins is null or p_coins < 50 then
    raise exception 'Minimum promotion is 50 coins';
  end if;

  select user_id into v_post_owner from public.posts where id = p_post_id;
  if v_post_owner is null then
    raise exception 'Post not found';
  end if;
  if v_post_owner <> v_user_id then
    raise exception 'You can only promote your own posts';
  end if;

  select coins into v_sender_coins from public.profiles where id = v_user_id for update;
  if coalesce(v_sender_coins, 0) < p_coins then
    raise exception 'Insufficient platform coins';
  end if;

  update public.profiles set coins = coins - p_coins where id = v_user_id;
  v_expires_at := now() + make_interval(hours => greatest(1, coalesce(p_hours, 24)));

  insert into public.post_promotions (post_id, user_id, coins_spent, boost_score, expires_at)
  values (p_post_id, v_user_id, p_coins, p_coins, v_expires_at);

  return json_build_object('success', true, 'coins_spent', p_coins, 'expires_at', v_expires_at);
end;
$$;

grant execute on function public.promote_post(uuid, int, int) to authenticated;

-- ---------------------------------------------------------------------------
-- Referral code (both parties get 50 platform coins, once per user)
-- ---------------------------------------------------------------------------
create or replace function public.apply_referral_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_referrer_id uuid;
  v_bonus int := 50;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_code is null or trim(p_code) = '' then
    raise exception 'Referral code required';
  end if;

  if exists (select 1 from public.referrals where referred_id = v_user_id) then
    raise exception 'You already used a referral code';
  end if;

  select id into v_referrer_id
  from public.profiles
  where lower(referral_code) = lower(trim(p_code))
  limit 1;

  if v_referrer_id is null then
    raise exception 'Invalid referral code';
  end if;
  if v_referrer_id = v_user_id then
    raise exception 'You cannot use your own referral code';
  end if;

  insert into public.referrals (referrer_id, referred_id, bonus_coins)
  values (v_referrer_id, v_user_id, v_bonus);

  update public.profiles set referred_by = v_referrer_id where id = v_user_id;
  perform public.add_user_coins(v_user_id, v_bonus);
  perform public.add_user_coins(v_referrer_id, v_bonus);

  return json_build_object('success', true, 'bonus_coins', v_bonus);
end;
$$;

grant execute on function public.apply_referral_code(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Profile link click tracking
-- ---------------------------------------------------------------------------
create or replace function public.record_profile_link_click(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then return;
  if p_profile_id = auth.uid() then return;
  insert into public.profile_link_clicks (profile_id, viewer_id)
  values (p_profile_id, auth.uid());
end;
$$;

grant execute on function public.record_profile_link_click(uuid) to authenticated;

-- Check active subscription
create or replace function public.is_subscribed_to_creator(p_creator_id uuid, p_viewer_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.creator_subscriptions
    where creator_id = p_creator_id
      and subscriber_id = p_viewer_id
      and expires_at > now()
  );
$$;

grant execute on function public.is_subscribed_to_creator(uuid, uuid) to authenticated;

-- Update creator monetization settings
create or replace function public.update_creator_monetization(
  p_subscription_price int,
  p_subscription_description text default null,
  p_tip_min int default null,
  p_paid_dm_price int default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if p_subscription_price is not null and p_subscription_price > 0 and p_subscription_price < 50 then
    raise exception 'Subscription price must be at least 50 coins or null to disable';
  end if;

  update public.profiles
  set
    subscription_price_coins = case when p_subscription_price <= 0 then null else p_subscription_price end,
    subscription_description = coalesce(p_subscription_description, subscription_description),
    tip_min_coins = coalesce(p_tip_min, tip_min_coins),
    paid_dm_price_coins = case when p_paid_dm_price <= 0 then null else p_paid_dm_price end
  where id = auth.uid();
end;
$$;

grant execute on function public.update_creator_monetization(int, text, int, int) to authenticated;
