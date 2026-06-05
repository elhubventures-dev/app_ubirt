-- Keep post like/comment counts in sync when anyone engages (bypasses posts RLS).

create or replace function public.increment_post_likes(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = coalesce(likes_count, 0) + 1
  where id = p_post_id;
end;
$$;

create or replace function public.decrement_post_likes(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
  where id = p_post_id;
end;
$$;

create or replace function public.increment_post_comments(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set comments_count = coalesce(comments_count, 0) + 1
  where id = p_post_id;
end;
$$;

grant execute on function public.increment_post_likes(uuid) to authenticated;
grant execute on function public.decrement_post_likes(uuid) to authenticated;
grant execute on function public.increment_post_comments(uuid) to authenticated;

-- Triggers keep counts accurate even if client only inserts/deletes rows.
create or replace function public.handle_post_like_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = coalesce(likes_count, 0) + 1
  where id = new.post_id;
  return new;
end;
$$;

create or replace function public.handle_post_like_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set likes_count = greatest(coalesce(likes_count, 0) - 1, 0)
  where id = old.post_id;
  return old;
end;
$$;

create or replace function public.handle_comment_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set comments_count = coalesce(comments_count, 0) + 1
  where id = new.post_id;
  return new;
end;
$$;

drop trigger if exists on_post_like_insert on public.post_likes;
create trigger on_post_like_insert
  after insert on public.post_likes
  for each row execute function public.handle_post_like_insert();

drop trigger if exists on_post_like_delete on public.post_likes;
create trigger on_post_like_delete
  after delete on public.post_likes
  for each row execute function public.handle_post_like_delete();

drop trigger if exists on_comment_insert on public.comments;
create trigger on_comment_insert
  after insert on public.comments
  for each row execute function public.handle_comment_insert();

-- Ensure insert policies allow authenticated users to like/bookmark/comment.
drop policy if exists "Users manage own likes" on public.post_likes;
create policy "Users manage own likes" on public.post_likes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage own bookmarks" on public.post_bookmarks;
create policy "Users manage own bookmarks" on public.post_bookmarks
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
