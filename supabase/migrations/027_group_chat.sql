-- Group chat: type discriminator, member roles, invite links, and management RPCs.

alter table public.conversations
  add column if not exists type text not null default 'direct'
    check (type in ('direct', 'group')),
  add column if not exists created_by uuid references public.profiles (id) on delete set null,
  add column if not exists invite_code text unique,
  add column if not exists avatar_url text;

alter table public.conversation_members
  add column if not exists role text not null default 'member'
    check (role in ('owner', 'admin', 'member')),
  add column if not exists joined_at timestamptz not null default now();

create index if not exists conversations_invite_code_idx
  on public.conversations (invite_code)
  where invite_code is not null;

-- Helpers
create or replace function public.get_group_member_role(p_conversation_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select cm.role
  from public.conversation_members cm
  where cm.conversation_id = p_conversation_id
    and cm.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_group_admin(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and c.type = 'group'
      and cm.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_group_owner(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    join public.conversations c on c.id = cm.conversation_id
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and c.type = 'group'
      and cm.role = 'owner'
  );
$$;

revoke all on function public.get_group_member_role(uuid) from public;
grant execute on function public.get_group_member_role(uuid) to authenticated;
revoke all on function public.is_group_admin(uuid) from public;
grant execute on function public.is_group_admin(uuid) to authenticated;
revoke all on function public.is_group_owner(uuid) from public;
grant execute on function public.is_group_owner(uuid) to authenticated;

-- Ensure direct conversations are tagged correctly
create or replace function public.create_direct_conversation(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conv_id uuid;
  v_title text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if p_other_user_id = v_user_id then
    raise exception 'Cannot message yourself';
  end if;

  select cm1.conversation_id
  into v_conv_id
  from public.conversation_members cm1
  join public.conversation_members cm2 on cm1.conversation_id = cm2.conversation_id
  join public.conversations c on c.id = cm1.conversation_id
  where cm1.user_id = v_user_id
    and cm2.user_id = p_other_user_id
    and c.type = 'direct'
    and (
      select count(*)
      from public.conversation_members cm3
      where cm3.conversation_id = cm1.conversation_id
    ) = 2
  limit 1;

  if v_conv_id is not null then
    return v_conv_id;
  end if;

  select coalesce(display_name, username, 'Chat')
  into v_title
  from public.profiles
  where id = p_other_user_id;

  insert into public.conversations (title, type, created_by)
  values (v_title, 'direct', v_user_id)
  returning id into v_conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_user_id, 'member'), (v_conv_id, p_other_user_id, 'member');

  return v_conv_id;
end;
$$;

grant execute on function public.create_direct_conversation(uuid) to authenticated;

-- Create a group conversation
create or replace function public.create_group_conversation(
  p_title text,
  p_member_ids uuid[] default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conv_id uuid;
  v_invite_code text;
  v_member_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if coalesce(trim(p_title), '') = '' then
    raise exception 'Group name is required';
  end if;

  v_invite_code := substring(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  insert into public.conversations (title, type, created_by, invite_code)
  values (trim(p_title), 'group', v_user_id, v_invite_code)
  returning id into v_conv_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_user_id, 'owner');

  foreach v_member_id in array coalesce(p_member_ids, '{}')
  loop
    if v_member_id is not null and v_member_id <> v_user_id then
      insert into public.conversation_members (conversation_id, user_id, role)
      values (v_conv_id, v_member_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
    end if;
  end loop;

  return v_conv_id;
end;
$$;

grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;

-- Join a group via invite link
create or replace function public.join_group_via_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_conv_id uuid;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select id
  into v_conv_id
  from public.conversations
  where invite_code = trim(p_invite_code)
    and type = 'group'
  limit 1;

  if v_conv_id is null then
    raise exception 'Invalid or expired group invite link';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (v_conv_id, v_user_id, 'member')
  on conflict (conversation_id, user_id) do nothing;

  return v_conv_id;
end;
$$;

grant execute on function public.join_group_via_invite(text) to authenticated;

-- Add members (owner/admin only)
create or replace function public.add_group_members(
  p_conversation_id uuid,
  p_member_ids uuid[]
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_member_id uuid;
  v_added int := 0;
  v_rowcount int;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_admin(p_conversation_id) then
    raise exception 'Only group owners and admins can add members';
  end if;

  foreach v_member_id in array coalesce(p_member_ids, '{}')
  loop
    if v_member_id is not null and v_member_id <> v_user_id then
      insert into public.conversation_members (conversation_id, user_id, role)
      values (p_conversation_id, v_member_id, 'member')
      on conflict (conversation_id, user_id) do nothing;
      get diagnostics v_rowcount = row_count;
      if v_rowcount > 0 then
        v_added := v_added + 1;
      end if;
    end if;
  end loop;

  return v_added;
end;
$$;

grant execute on function public.add_group_members(uuid, uuid[]) to authenticated;

-- Promote/demote admins (owner only)
create or replace function public.update_group_member_role(
  p_conversation_id uuid,
  p_user_id uuid,
  p_role text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_owner(p_conversation_id) then
    raise exception 'Only the group owner can change member roles';
  end if;

  if p_role not in ('admin', 'member') then
    raise exception 'Invalid role. Use admin or member.';
  end if;

  if p_user_id = v_user_id then
    raise exception 'Cannot change your own role';
  end if;

  update public.conversation_members
  set role = p_role
  where conversation_id = p_conversation_id
    and user_id = p_user_id
    and role <> 'owner';

  if not found then
    raise exception 'Member not found or cannot change owner role';
  end if;

  return true;
end;
$$;

grant execute on function public.update_group_member_role(uuid, uuid, text) to authenticated;

-- Remove member or leave group
create or replace function public.remove_group_member(
  p_conversation_id uuid,
  p_user_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_target_role text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  select role
  into v_target_role
  from public.conversation_members
  where conversation_id = p_conversation_id
    and user_id = p_user_id;

  if v_target_role is null then
    raise exception 'Member not found';
  end if;

  if v_target_role = 'owner' and p_user_id <> v_user_id then
    raise exception 'Cannot remove the group owner';
  end if;

  if p_user_id = v_user_id then
    if v_target_role = 'owner' then
      raise exception 'Transfer ownership before leaving the group';
    end if;
  elsif not public.is_group_admin(p_conversation_id) then
    raise exception 'Only group owners and admins can remove members';
  end if;

  delete from public.conversation_members
  where conversation_id = p_conversation_id
    and user_id = p_user_id;

  return true;
end;
$$;

grant execute on function public.remove_group_member(uuid, uuid) to authenticated;

-- Regenerate invite link (owner/admin)
create or replace function public.regenerate_group_invite(p_conversation_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_invite_code text;
begin
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  if not public.is_group_admin(p_conversation_id) then
    raise exception 'Only group owners and admins can manage invite links';
  end if;

  v_invite_code := substring(replace(gen_random_uuid()::text, '-', ''), 1, 12);

  update public.conversations
  set invite_code = v_invite_code
  where id = p_conversation_id
    and type = 'group';

  if not found then
    raise exception 'Group not found';
  end if;

  return v_invite_code;
end;
$$;

grant execute on function public.regenerate_group_invite(uuid) to authenticated;

-- Group owners/admins can update conversation metadata
drop policy if exists "Members update conversations" on public.conversations;
create policy "Members update conversations"
  on public.conversations
  for update
  using (
    public.is_conversation_member(id)
    and (
      type = 'direct'
      or public.is_group_admin(id)
    )
  )
  with check (
    public.is_conversation_member(id)
    and (
      type = 'direct'
      or public.is_group_admin(id)
    )
  );
