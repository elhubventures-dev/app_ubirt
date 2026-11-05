-- Auto-ported from supabase/migrations/026_notification_push_dispatch.sql for Neon
-- pg_net is not available on Neon. Push is handled by app API / Ably publish instead.

-- No-op placeholder so later migrations that assume this file ran stay ordered.
create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Intentionally empty on Neon (no pg_net). Clients use Ably + /api/push.
  return NEW;
end;
$$;

drop trigger if exists trg_dispatch_push_for_notification on public.notifications;
create trigger trg_dispatch_push_for_notification
after insert on public.notifications
for each row
execute function public.dispatch_push_for_notification();
