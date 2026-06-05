-- 026_notification_push_dispatch.sql
-- Server-side push dispatch when a notification row is inserted.
-- Requires pg_net (enabled on Supabase hosted projects).

create extension if not exists pg_net with schema extensions;

create or replace function public.dispatch_push_for_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url := coalesce(
      nullif(current_setting('app.push_webhook_url', true), ''),
      'https://www.app.ubirtai.site/api/webhooks/notification-push'
    ),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    body := jsonb_build_object(
      'type', 'INSERT',
      'table', 'notifications',
      'record', jsonb_build_object(
        'id', NEW.id,
        'user_id', NEW.user_id,
        'type', NEW.type,
        'text', NEW.text,
        'conversation_id', NEW.conversation_id
      )
    ),
    timeout_milliseconds := 8000
  );
  return NEW;
exception
  when others then
    raise warning 'dispatch_push_for_notification failed: %', sqlerrm;
    return NEW;
end;
$$;

drop trigger if exists trg_dispatch_push_for_notification on public.notifications;
create trigger trg_dispatch_push_for_notification
after insert on public.notifications
for each row
execute function public.dispatch_push_for_notification();
