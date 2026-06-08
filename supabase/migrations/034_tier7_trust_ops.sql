-- Tier 7 trust, safety & ops: admin moderation, age gate, wallet audit log.

-- ---------------------------------------------------------------------------
-- Admin flag + age confirmation
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists age_confirmed_at timestamptz;

create or replace function public.is_app_admin(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select is_admin from public.profiles where id = coalesce(p_user_id, auth.uid())),
    false
  );
$$;

revoke all on function public.is_app_admin(uuid) from public;
grant execute on function public.is_app_admin(uuid) to authenticated;

create or replace function public.confirm_age_gate()
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_confirmed timestamptz;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set age_confirmed_at = coalesce(age_confirmed_at, now())
  where id = v_user_id
  returning age_confirmed_at into v_confirmed;

  return v_confirmed;
end;
$$;

grant execute on function public.confirm_age_gate() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports moderation queue (admin review)
-- ---------------------------------------------------------------------------
alter table public.reports
  add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution_note text,
  add column if not exists action_taken text check (
    action_taken is null
    or action_taken in ('none', 'warned', 'content_hidden', 'user_suspended', 'dismissed')
  );

drop policy if exists "Admins view all reports" on public.reports;
create policy "Admins view all reports"
  on public.reports
  for select
  using (public.is_app_admin());

drop policy if exists "Admins update reports" on public.reports;
create policy "Admins update reports"
  on public.reports
  for update
  using (public.is_app_admin())
  with check (public.is_app_admin());

create or replace function public.review_report(
  p_report_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_action_taken text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_app_admin() then
    raise exception 'Admin access required';
  end if;
  if p_status not in ('reviewed', 'dismissed') then
    raise exception 'Invalid status';
  end if;

  update public.reports
  set
    status = p_status,
    reviewed_by = auth.uid(),
    reviewed_at = now(),
    resolution_note = nullif(trim(p_resolution_note), ''),
    action_taken = coalesce(nullif(trim(p_action_taken), ''), case when p_status = 'dismissed' then 'dismissed' else 'none' end)
  where id = p_report_id;

  if not found then
    raise exception 'Report not found';
  end if;

  return true;
end;
$$;

grant execute on function public.review_report(uuid, text, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Wallet audit log
-- ---------------------------------------------------------------------------
create table if not exists public.wallet_audit_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  action text not null,
  wallet_type text not null check (wallet_type in ('platform', 'gift')),
  amount int not null,
  balance_after int,
  reference_type text,
  reference_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists wallet_audit_log_user_created_idx
  on public.wallet_audit_log (user_id, created_at desc);

alter table public.wallet_audit_log enable row level security;

create policy "Users view own wallet audit log"
  on public.wallet_audit_log
  for select
  using (auth.uid() = user_id);

create policy "Admins view all wallet audit logs"
  on public.wallet_audit_log
  for select
  using (public.is_app_admin());

create or replace function public.log_wallet_action(
  p_user_id uuid,
  p_action text,
  p_wallet_type text,
  p_amount int,
  p_balance_after int default null,
  p_reference_type text default null,
  p_reference_id text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.wallet_audit_log (
    user_id,
    action,
    wallet_type,
    amount,
    balance_after,
    reference_type,
    reference_id,
    metadata
  )
  values (
    p_user_id,
    p_action,
    p_wallet_type,
    coalesce(p_amount, 0),
    p_balance_after,
    p_reference_type,
    p_reference_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
end;
$$;

-- Patch send_gift to audit
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
  if v_sender_id is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Gift amount must be positive'; end if;

  select user_id into v_receiver_id from public.posts where id = p_post_id;
  if v_receiver_id is null then raise exception 'Post not found'; end if;
  if v_receiver_id = v_sender_id then raise exception 'You cannot send a gift to yourself'; end if;

  select coins into v_sender_coins from public.profiles where id = v_sender_id for update;
  if v_sender_coins is null then raise exception 'Sender profile not found'; end if;
  if v_sender_coins < p_amount then raise exception 'Insufficient platform coins'; end if;

  v_receiver_amount := floor(p_amount * 0.8)::int;
  v_platform_fee := p_amount - v_receiver_amount;

  perform 1 from public.profiles where id = v_receiver_id for update;

  update public.profiles set coins = coins - p_amount where id = v_sender_id returning coins into v_sender_balance;
  update public.profiles set gift_coins = gift_coins + v_receiver_amount where id = v_receiver_id returning gift_coins into v_receiver_gift_balance;

  insert into public.gifts (sender_id, receiver_id, post_id, amount, receiver_amount, platform_fee)
  values (v_sender_id, v_receiver_id, p_post_id, p_amount, v_receiver_amount, v_platform_fee);

  perform public.log_wallet_action(v_sender_id, 'gift_send', 'platform', -p_amount, v_sender_balance, 'post', p_post_id::text, jsonb_build_object('receiver_id', v_receiver_id));
  perform public.log_wallet_action(v_receiver_id, 'gift_receive', 'gift', v_receiver_amount, v_receiver_gift_balance, 'post', p_post_id::text, jsonb_build_object('sender_id', v_sender_id));

  select display_name into v_sender_name from public.profiles where id = v_sender_id;

  perform public.create_notification(
    v_receiver_id, 'gift',
    coalesce(v_sender_name, 'Someone') || ' sent you a gift of ' || p_amount || ' coins. You received ' || v_receiver_amount || ' gift coins (80%).',
    v_sender_id, p_post_id, null
  );

  return json_build_object(
    'success', true, 'amount', p_amount, 'receiver_amount', v_receiver_amount,
    'platform_fee', v_platform_fee, 'sender_balance', v_sender_balance,
    'receiver_gift_balance', v_receiver_gift_balance, 'receiver_id', v_receiver_id
  );
end;
$$;

-- Patch add_user_coins to audit
create or replace function public.add_user_coins(p_user_id uuid, p_amount int)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_balance int;
begin
  if p_amount is null or p_amount <= 0 then raise exception 'p_amount must be positive'; end if;

  update public.profiles set coins = coalesce(coins, 0) + p_amount where id = p_user_id returning coins into v_new_balance;
  if not found then raise exception 'Profile not found: %', p_user_id; end if;

  perform public.log_wallet_action(p_user_id, 'coin_credit', 'platform', p_amount, v_new_balance, 'system', null, '{}'::jsonb);
  return v_new_balance;
end;
$$;

-- Patch withdrawal request to audit pending hold
create or replace function public.request_gift_coin_withdrawal(
  p_amount int,
  p_payout_method text,
  p_payout_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_balance int;
  v_request_id uuid;
  v_pending int;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;
  if p_amount is null or p_amount < 100 then raise exception 'Minimum withdrawal is 100 gift coins'; end if;
  if p_payout_method not in ('bank', 'paystack') then raise exception 'Invalid payout method'; end if;

  select gift_coins into v_balance from public.profiles where id = v_user_id for update;
  if coalesce(v_balance, 0) < p_amount then raise exception 'Insufficient gift coin balance'; end if;

  select coalesce(sum(amount), 0)::int into v_pending
  from public.withdrawal_requests where user_id = v_user_id and status in ('pending', 'approved');
  if coalesce(v_balance, 0) - v_pending < p_amount then raise exception 'You already have pending withdrawals for this balance'; end if;

  insert into public.withdrawal_requests (user_id, amount, payout_method, payout_details)
  values (v_user_id, p_amount, p_payout_method, coalesce(p_payout_details, '{}'::jsonb))
  returning id into v_request_id;

  perform public.log_wallet_action(v_user_id, 'withdrawal_request', 'gift', -p_amount, v_balance - p_amount, 'withdrawal', v_request_id::text, jsonb_build_object('method', p_payout_method));

  return v_request_id;
end;
$$;
