-- Allow users to create their own profile if the signup trigger did not run
create policy "Users can insert own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- Safer signup trigger: avoid duplicate username failures
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

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    final_username,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;
