-- Auto-ported from supabase/migrations/008_posts_delete_policy.sql for Neon
-- Review RLS: Neon API uses service DATABASE_URL; enforce auth in /api handlers.
-- Requires neon/migrations/000_bootstrap_users.sql first.

-- Allow authors to delete their own feed posts.
drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts" on public.posts
  for delete using (auth.uid() = user_id);
