-- WhatsApp inbox health looks at a recent window, like the booking outbox (R25-14,
-- docs/PROJECT_REVIEW_2026-11-25.md, 20261125120000_booking_outbox_health_window.sql).
-- whatsapp_inbox_backlog_health() (20261110124000) read every row with status<>'sent'. Terminal
-- rows (failed, ambiguous, legacy_manual, expired) are kept as tombstones, so one of them kept
-- the queue 'failed' forever and the scan grew with history. Now terminal rows count only when
-- they were completed in the last 24 hours (completed_at is set on every terminal transition);
-- pending/processing rows, including stuck ones, are always counted as before.
-- Kept separate from the outbox migration: the isolated SQL suites apply them independently.
-- Same signature, return shape, language, security definer, search_path and statement_timeout.
begin;

set local lock_timeout = '5s';

create index if not exists whatsapp_inbox_terminal_recent
    on public.whatsapp_inbox (completed_at)
    where status in ('failed','ambiguous','legacy_manual','expired');

create or replace function public.whatsapp_inbox_backlog_health() returns jsonb
language plpgsql security definer set search_path=pg_catalog,public set statement_timeout='4s' as $$
declare result jsonb; observed_at timestamptz:=clock_timestamp();
begin
  perform public._require_whatsapp_inbox_service();
  with states as (
    select i.*, (i.command_receipt is null and exists(select 1 from public.whatsapp_messages m where m.whatsapp_message_id=i.message_id)) as legacy
    from public.whatsapp_inbox i
    where i.status in ('pending','processing')
      or (i.status in ('failed','ambiguous','legacy_manual','expired') and i.completed_at>=observed_at-interval '24 hours')
  ), flags as (
    select *,
      status in ('pending','processing') and (status='pending' or lease_until<=observed_at)
        and available_at<=observed_at and attempts<8 and reply_started_at is null
        and provider_timestamp>=observed_at-interval '24 hours' and not legacy as due,
      status='ambiguous' or (status='processing' and lease_until<=observed_at and reply_started_at is not null) as uncertain,
      status in ('failed','ambiguous','legacy_manual','expired') or (status in ('pending','processing') and (status='pending' or lease_until<=observed_at)
        and (attempts>=8 or provider_timestamp<observed_at-interval '24 hours' or legacy or reply_started_at is not null)) as attention
    from states
  ) select jsonb_build_object(
      'pending',count(*) filter(where status='pending'),
      'due',count(*) filter(where due),
      'processing',count(*) filter(where status='processing'),
      'failed',count(*) filter(where attention),
      'ambiguous',count(*) filter(where uncertain),
      'oldest_due_age_seconds',coalesce(greatest(0,extract(epoch from observed_at-min(case when status='processing' then greatest(available_at,lease_until) else available_at end) filter(where due))),0)
    ) into result from flags;
  return result;
end;
$$;

-- Default privileges are closed: restate the ACL explicitly.
revoke all on function public.whatsapp_inbox_backlog_health() from public,anon,authenticated,service_role;
grant execute on function public.whatsapp_inbox_backlog_health() to service_role;

commit;
