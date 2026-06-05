-- 005_achievement_unlock.sql
-- Allow authenticated users to unlock badges via security definer RPC.

create or replace function public.unlock_badge(p_badge_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.user_achievements (user_id, badge_id)
  values (auth.uid(), p_badge_id)
  on conflict (user_id, badge_id) do nothing;
end;
$$;

grant execute on function public.unlock_badge(text) to authenticated;
