-- Allow authors to delete their own feed posts.
drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts
  for delete using (auth.uid() = user_id);
