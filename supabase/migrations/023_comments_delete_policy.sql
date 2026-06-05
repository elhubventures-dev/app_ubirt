-- Allow users to delete their own comments; keep post comment counts in sync.

create or replace function public.handle_comment_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts
  set comments_count = greatest(coalesce(comments_count, 0) - 1, 0)
  where id = old.post_id;
  return old;
end;
$$;

drop trigger if exists on_comment_delete on public.comments;
create trigger on_comment_delete
  after delete on public.comments
  for each row execute function public.handle_comment_delete();

drop policy if exists "Users delete own comments" on public.comments;
create policy "Users delete own comments"
  on public.comments
  for delete
  using (auth.uid() = user_id);
