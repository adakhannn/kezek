-- Booking notification queue health looks at a recent window (R25-14, docs/PROJECT_REVIEW_2026-11-25.md).
-- booking_notification_backlog_health() (20261110125000) counted every failed event and every
-- ambiguous delivery ever recorded. Outbox events are kept forever as tombstones, so one failure
-- (a client who blocked the bot) kept readBackgroundQueueHealth() 'failed' and the daily health
-- alert firing for good, and the aggregate scanned the whole history against a 3 s client timeout.
--
-- Now: pending/due/processing come from live rows only (booking_notification_outbox_ready);
-- 'failed' counts events that reached status failed in the last 24 hours; 'ambiguous' counts
-- events with an ambiguous delivery that are still live or finished in the last 24 hours
-- (booking_notification_ambiguous_event_idx; deliveries are pruned after 30 days anyway).
-- Same signature, return shape, language, volatility, security definer and search_path.
begin;

set local lock_timeout = '5s';

create index if not exists booking_notification_outbox_failed_recent
    on public.booking_notification_outbox (completed_at)
    where status = 'failed';

create or replace function public.booking_notification_backlog_health()
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with live as (
    select o.status, o.created_at, (o.attempts<8 and o.created_at>=now()-interval '30 days' and o.available_at<=now()
      and (o.status='pending' or (o.status='processing' and o.lease_until<=now()))) as due
    from public.booking_notification_outbox o where o.status in ('pending','processing')
  )
  select jsonb_build_object(
    'pending',(select count(*) from live where status='pending'),
    'due',(select count(*) from live where due),
    'processing',(select count(*) from live where status='processing'),
    'failed',(select count(*) from public.booking_notification_outbox o
      where o.status='failed' and o.completed_at>=now()-interval '24 hours'),
    'ambiguous',(select count(distinct d.event_id) from public.booking_notification_deliveries d
      join public.booking_notification_outbox o on o.id=d.event_id
      where d.status='ambiguous' and (o.status in ('pending','processing') or o.completed_at>=now()-interval '24 hours')),
    'oldest_due_age_seconds',(select coalesce(greatest(0,extract(epoch from now()-min(created_at) filter(where due))),0) from live));
$$;

-- Default privileges are closed: restate the ACL explicitly.
revoke all on function public.booking_notification_backlog_health() from public,anon,authenticated,service_role;
grant execute on function public.booking_notification_backlog_health() to service_role;

commit;
