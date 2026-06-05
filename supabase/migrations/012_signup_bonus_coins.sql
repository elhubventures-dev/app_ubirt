-- Signup bonus: new accounts start with 100 coins (was 1000)

alter table public.profiles
  alter column coins set default 100;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  base_username text;
  final_username text;
begin
  base_username := lower(regexp_replace(
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
  '[^a-z0-9_]', '_', 'g'));
  if base_username = '' or base_username is null then
    base_username := 'user';
  end if;
  final_username := base_username || '_' || substr(replace(new.id::text, '-', ''), 1, 6);

  insert into public.profiles (id, username, display_name, avatar_url, coins)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url',
    100
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
