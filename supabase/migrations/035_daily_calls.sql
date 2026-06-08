-- Daily.co 1:1 audio/video calls: sessions + Realtime signaling.

create table if not exists public.call_sessions (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  initiated_by uuid not null references public.profiles (id) on delete cascade,
  callee_id uuid not null references public.profiles (id) on delete cascade,
  call_type text not null check (call_type in ('audio', 'video')),
  status text not null default 'ringing' check (
    status in ('ringing', 'active', 'ended', 'declined', 'missed', 'cancelled')
  ),
  daily_room_name text not null,
  daily_room_url text not null,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists call_sessions_conversation_idx
  on public.call_sessions (conversation_id, created_at desc);

create index if not exists call_sessions_callee_status_idx
  on public.call_sessions (callee_id, status, created_at desc);

alter table public.call_sessions enable row level security;

create policy "Conversation members view calls"
  on public.call_sessions
  for select
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = call_sessions.conversation_id
        and cm.user_id = auth.uid()
    )
  );

create policy "Conversation members update calls"
  on public.call_sessions
  for update
  using (
    exists (
      select 1 from public.conversation_members cm
      where cm.conversation_id = call_sessions.conversation_id
        and cm.user_id = auth.uid()
    )
  );

-- Inserts are done via service role from /api/calls/* after auth checks.

do $$
begin
  alter publication supabase_realtime add table public.call_sessions;
exception
  when duplicate_object then null;
end $$;
