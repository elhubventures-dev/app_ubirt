-- Tier 1: report/block, notification preferences, creator withdrawal requests.

-- ---------------------------------------------------------------------------
-- Blocked users
-- ---------------------------------------------------------------------------
create table if not exists public.blocked_users (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index if not exists blocked_users_blocker_idx on public.blocked_users (blocker_id);

alter table public.blocked_users enable row level security;

create policy "Users manage own blocks"
  on public.blocked_users
  for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'comment', 'user', 'message')),
  target_id text not null,
  reason text not null,
  details text,
  status text not null default 'pending' check (status in ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now()
);

create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

alter table public.reports enable row level security;

create policy "Users create reports"
  on public.reports
  for insert
  with check (auth.uid() = reporter_id);

create policy "Users view own reports"
  on public.reports
  for select
  using (auth.uid() = reporter_id);

-- ---------------------------------------------------------------------------
-- Notification preferences (synced across devices)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists notification_preferences jsonb not null default '{
    "inApp": true,
    "likes": true,
    "comments": true,
    "messages": true,
    "follows": true,
    "gifts": true
  }'::jsonb;

-- ---------------------------------------------------------------------------
-- Creator withdrawal requests
-- ---------------------------------------------------------------------------
create table if not exists public.withdrawal_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount int not null check (amount > 0),
  currency text not null default 'NGN',
  payout_method text not null check (payout_method in ('bank', 'paystack')),
  payout_details jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'paid')),
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists withdrawal_requests_user_idx
  on public.withdrawal_requests (user_id, created_at desc);

alter table public.withdrawal_requests enable row level security;

create policy "Users view own withdrawal requests"
  on public.withdrawal_requests
  for select
  using (auth.uid() = user_id);

create policy "Users create own withdrawal requests"
  on public.withdrawal_requests
  for insert
  with check (auth.uid() = user_id);

create or replace function public.touch_withdrawal_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_touch_withdrawal_requests_updated_at on public.withdrawal_requests;
create trigger trg_touch_withdrawal_requests_updated_at
before update on public.withdrawal_requests
for each row execute function public.touch_withdrawal_requests_updated_at();

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
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  if p_amount is null or p_amount < 100 then
    raise exception 'Minimum withdrawal is 100 gift coins';
  end if;
  if p_payout_method not in ('bank', 'paystack') then
    raise exception 'Invalid payout method';
  end if;

  select gift_coins into v_balance from public.profiles where id = v_user_id for update;
  if coalesce(v_balance, 0) < p_amount then
    raise exception 'Insufficient gift coin balance';
  end if;

  select coalesce(sum(amount), 0)::int into v_pending
  from public.withdrawal_requests
  where user_id = v_user_id and status in ('pending', 'approved');

  if coalesce(v_balance, 0) - v_pending < p_amount then
    raise exception 'You already have pending withdrawals for this balance';
  end if;

  insert into public.withdrawal_requests (user_id, amount, payout_method, payout_details)
  values (v_user_id, p_amount, p_payout_method, coalesce(p_payout_details, '{}'::jsonb))
  returning id into v_request_id;

  return v_request_id;
end;
$$;

grant execute on function public.request_gift_coin_withdrawal(int, text, jsonb) to authenticated;
