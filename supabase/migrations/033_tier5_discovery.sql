-- Tier 5 content & discovery: location, sounds, collabs, polls, Q&A, trending helpers.

alter table public.posts
  add column if not exists sound_id text,
  add column if not exists location_tag text,
  add column if not exists co_author_id uuid references public.profiles (id) on delete set null;

create index if not exists posts_sound_id_idx on public.posts (sound_id) where sound_id is not null;
create index if not exists posts_location_tag_idx on public.posts (location_tag) where location_tag is not null;
create index if not exists posts_co_author_idx on public.posts (co_author_id) where co_author_id is not null;

alter table public.uploads
  add column if not exists sound_id text,
  add column if not exists location_tag text,
  add column if not exists co_author_username text,
  add column if not exists poll_options jsonb;

-- Polls (2–4 options per post)
create table if not exists public.post_polls (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null unique references public.posts (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.post_polls (id) on delete cascade,
  label text not null check (char_length(trim(label)) between 1 and 80),
  votes_count int not null default 0 check (votes_count >= 0),
  sort_order int not null default 0
);

create table if not exists public.poll_votes (
  poll_id uuid not null references public.post_polls (id) on delete cascade,
  option_id uuid not null references public.poll_options (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.post_polls enable row level security;
alter table public.poll_options enable row level security;
alter table public.poll_votes enable row level security;

create policy "Anyone can view polls"
  on public.post_polls for select using (true);
create policy "Anyone can view poll options"
  on public.poll_options for select using (true);
create policy "Users view own poll votes"
  on public.poll_votes for select using (auth.uid() = user_id);
create policy "Users manage own poll votes"
  on public.poll_votes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Profile Q&A
create table if not exists public.profile_questions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  asker_id uuid not null references public.profiles (id) on delete cascade,
  question text not null check (char_length(trim(question)) between 3 and 500),
  answer text check (answer is null or char_length(trim(answer)) <= 2000),
  answered_at timestamptz,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  check (profile_id <> asker_id)
);

create index if not exists profile_questions_profile_idx
  on public.profile_questions (profile_id, created_at desc);

alter table public.profile_questions enable row level security;

create policy "Public answered questions visible"
  on public.profile_questions for select
  using (is_public and answer is not null or auth.uid() = profile_id or auth.uid() = asker_id);

create policy "Users submit questions"
  on public.profile_questions for insert
  with check (auth.uid() = asker_id);

create policy "Profile owners answer questions"
  on public.profile_questions for update
  using (auth.uid() = profile_id);

-- Vote on poll (one vote per user per poll)
create or replace function public.vote_poll(p_post_id uuid, p_option_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_poll_id uuid;
  v_old_option uuid;
begin
  if v_user_id is null then raise exception 'Not authenticated'; end if;

  select pp.id into v_poll_id
  from public.post_polls pp where pp.post_id = p_post_id;
  if v_poll_id is null then raise exception 'Poll not found'; end if;

  if not exists (
    select 1 from public.poll_options where id = p_option_id and poll_id = v_poll_id
  ) then
    raise exception 'Invalid poll option';
  end if;

  select option_id into v_old_option
  from public.poll_votes where poll_id = v_poll_id and user_id = v_user_id;

  if v_old_option is not null then
    update public.poll_options set votes_count = greatest(0, votes_count - 1) where id = v_old_option;
    delete from public.poll_votes where poll_id = v_poll_id and user_id = v_user_id;
  end if;

  if v_old_option is distinct from p_option_id then
    insert into public.poll_votes (poll_id, option_id, user_id) values (v_poll_id, p_option_id, v_user_id);
    update public.poll_options set votes_count = votes_count + 1 where id = p_option_id;
  end if;

  return json_build_object('success', true, 'option_id', p_option_id);
end;
$$;

grant execute on function public.vote_poll(uuid, uuid) to authenticated;

create or replace function public.submit_profile_question(p_profile_id uuid, p_question text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
  v_asker_name text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_profile_id = auth.uid() then raise exception 'You cannot ask yourself'; end if;
  if p_question is null or char_length(trim(p_question)) < 3 then
    raise exception 'Question too short';
  end if;

  insert into public.profile_questions (profile_id, asker_id, question)
  values (p_profile_id, auth.uid(), trim(p_question))
  returning id into v_id;

  select display_name into v_asker_name from public.profiles where id = auth.uid();
  perform public.create_notification(
    p_profile_id, 'follow',
    coalesce(v_asker_name, 'Someone') || ' asked you a question',
    auth.uid(), null, null
  );

  return v_id;
end;
$$;

grant execute on function public.submit_profile_question(uuid, text) to authenticated;

create or replace function public.answer_profile_question(p_question_id uuid, p_answer text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_answer is null or char_length(trim(p_answer)) < 1 then
    raise exception 'Answer required';
  end if;

  update public.profile_questions
  set answer = trim(p_answer), answered_at = now(), is_public = true
  where id = p_question_id and profile_id = auth.uid();
end;
$$;

grant execute on function public.answer_profile_question(uuid, text) to authenticated;

-- Create poll for a post (called from app after post insert)
create or replace function public.create_post_poll(p_post_id uuid, p_options text[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_poll_id uuid;
  v_opt text;
  v_i int := 0;
begin
  if array_length(p_options, 1) is null or array_length(p_options, 1) < 2 then
    raise exception 'Poll needs at least 2 options';
  end if;
  if array_length(p_options, 1) > 4 then
    raise exception 'Poll allows at most 4 options';
  end if;

  insert into public.post_polls (post_id) values (p_post_id) returning id into v_poll_id;

  foreach v_opt in array p_options loop
    if trim(v_opt) <> '' then
      insert into public.poll_options (poll_id, label, sort_order)
      values (v_poll_id, trim(v_opt), v_i);
      v_i := v_i + 1;
    end if;
  end loop;

  return v_poll_id;
end;
$$;

grant execute on function public.create_post_poll(uuid, text[]) to authenticated;
