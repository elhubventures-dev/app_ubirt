-- Enable realtime updates for read receipts (last_read_at on conversation_members).
alter table public.conversation_members replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.conversation_members;
exception
  when duplicate_object then null;
end $$;
