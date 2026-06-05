-- Create or return a 1:1 conversation between the current user and another user.
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
  where cm1.user_id = v_user_id
    and cm2.user_id = p_other_user_id
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

  insert into public.conversations (title)
  values (v_title)
  returning id into v_conv_id;

  insert into public.conversation_members (conversation_id, user_id)
  values (v_conv_id, v_user_id), (v_conv_id, p_other_user_id);

  return v_conv_id;
end;
$$;

grant execute on function public.create_direct_conversation(uuid) to authenticated;
