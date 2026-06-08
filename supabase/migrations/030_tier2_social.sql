-- Tier 2: reposts, pinned posts, profile views, mention-friendly notifications.

alter table public.profiles
  add column if not exists pinned_post_id uuid references public.posts (id) on delete set null;

alter table public.posts
  add column if not exists repost_of uuid references public.posts (id) on delete set null,
  add column if not exists repost_caption text;

create index if not exists posts_repost_of_idx on public.posts (repost_of) where repost_of is not null;

-- Profile view analytics (deduped per viewer per day)
create table if not exists public.profile_views (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  viewer_id uuid references public.profiles (id) on delete set null,
  viewed_on date not null default current_date,
  created_at timestamptz not null default now(),
  unique (profile_id, viewer_id, viewed_on)
);

create index if not exists profile_views_profile_idx on public.profile_views (profile_id, viewed_on desc);

alter table public.profile_views enable row level security;

create policy "Profile owners read view stats"
  on public.profile_views
  for select
  using (auth.uid() = profile_id);

create or replace function public.record_profile_view(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_viewer uuid := auth.uid();
begin
  if v_viewer is null or p_profile_id is null or v_viewer = p_profile_id then
    return;
  end if;

  insert into public.profile_views (profile_id, viewer_id, viewed_on)
  values (p_profile_id, v_viewer, current_date)
  on conflict (profile_id, viewer_id, viewed_on) do nothing;
end;
$$;

grant execute on function public.record_profile_view(uuid) to authenticated;

create or replace function public.get_profile_view_count(p_profile_id uuid, p_days int default 28)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.profile_views
  where profile_id = p_profile_id
    and viewed_on >= current_date - greatest(p_days, 1);
$$;

grant execute on function public.get_profile_view_count(uuid, int) to authenticated;

-- Extend notification prefs default with mentions (new profiles; app normalizes existing rows)
alter table public.profiles
  alter column notification_preferences set default '{
    "inApp": true,
    "likes": true,
    "comments": true,
    "messages": true,
    "follows": true,
    "gifts": true,
    "mentions": true
  }'::jsonb;
