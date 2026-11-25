-- Booking reminders to the client 24 hours and 2 hours before the visit (owner decision of
-- 2026-11-25), and WhatsApp delivery failures reported by status webhooks (R25-07,
-- docs/PROJECT_REVIEW_2026-11-25.md).
--
-- Reminders are ordinary outbox events ('reminder_24h', 'reminder_2h') of the current booking
-- revision. enqueue_booking_reminders() is called by the booking-notification worker at the start
-- of every run (GET /api/cron/booking-notifications, pg_cron kezek_booking_notifications every
-- 2 minutes), so reminders exist only while the worker is enabled and need no schedule of their own.
-- The worker sends them like other events and closes them as obsolete when the booking is no longer
-- confirmed, its revision changed (rescheduled, cancelled) or the reminder window has passed.
--
-- A reminder is enqueued for a confirmed booking whose start is within its lead time
-- (24 h / 2 h) and still more than its minimum lead (2 h / 15 min) away, unless:
--   * the booking was created inside the lead time (the confirmation was just sent), or
--   * the confirmation of the current revision was enqueued inside the lead time (a reschedule
--     or another change re-sent the confirmation shortly before the visit), or
--   * this reminder already exists for the revision (unique (booking, revision, type)).
-- Default privileges are closed (20261119030000): every ACL is stated here; service_role only.
begin;

set local lock_timeout = '5s';

alter table public.booking_notification_outbox drop constraint if exists booking_notification_outbox_event_type_check;
alter table public.booking_notification_outbox add constraint booking_notification_outbox_event_type_check
    check (event_type in ('hold','confirm','cancel','reminder_24h','reminder_2h'));

-- The reminder scan reads confirmed bookings by start time; no existing index leads with start_at.
create index if not exists bookings_confirmed_start_at_idx on public.bookings (start_at) where status = 'confirmed';

create function public.enqueue_booking_reminders(p_limit integer default 200)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
    if p_limit is null or p_limit not between 1 and 1000 then
        raise exception 'INVALID_REMINDER_LIMIT' using errcode='22023';
    end if;
    with windows(event_type, lead_time, min_lead) as (values
        ('reminder_24h', interval '24 hours', interval '2 hours'),
        ('reminder_2h', interval '2 hours', interval '15 minutes')
    ), due as (
        select b.id, b.notification_revision, w.event_type
        from windows w
        join public.bookings b on b.status = 'confirmed'
            and b.start_at > now() + w.min_lead and b.start_at <= now() + w.lead_time
        where b.created_at <= b.start_at - w.lead_time
          and not exists (select 1 from public.booking_notification_outbox o
              where o.booking_id = b.id and o.booking_revision = b.notification_revision
                and (o.event_type = w.event_type
                     or (o.event_type = 'confirm' and o.created_at > b.start_at - w.lead_time)))
        order by b.start_at
        limit p_limit
    )
    insert into public.booking_notification_outbox(booking_id, booking_revision, event_type)
        select id, notification_revision, event_type from due
        on conflict (booking_id, booking_revision, event_type) do nothing;
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

-- WhatsApp reports a failed delivery of an accepted message (131047 outside the 24 h window,
-- 131026 undeliverable, template errors) only in a status webhook. Mark the matching sent outbox
-- delivery failed with that code, so the receipt no longer claims a delivered message. Events keep
-- their status: a staff number without WhatsApp must not turn the queue health red on every booking.
-- Unknown provider ids (OTP, inbox replies, pruned receipts) change nothing; repeats are harmless.
create index if not exists booking_notification_whatsapp_provider_idx
    on public.booking_notification_deliveries (provider_id) where channel = 'whatsapp' and provider_id is not null;

create function public.record_booking_notification_provider_failures(p_failures jsonb)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare v_count integer;
begin
    if p_failures is null or jsonb_typeof(p_failures) <> 'array' or jsonb_array_length(p_failures) > 100 then
        raise exception 'INVALID_PROVIDER_FAILURES' using errcode='22023';
    end if;
    with input as (
        select distinct on (f->>'provider_id') left(f->>'provider_id', 200) as provider_id,
            coalesce(nullif(left(f->>'error_code', 120), ''), 'provider_delivery_failed') as error_code
        from jsonb_array_elements(p_failures) f
        where jsonb_typeof(f) = 'object' and coalesce(f->>'provider_id', '') <> ''
    )
    update public.booking_notification_deliveries d set status = 'failed', last_error_code = i.error_code
        from input i
        where d.channel = 'whatsapp' and d.provider_id = i.provider_id and d.status = 'sent';
    get diagnostics v_count = row_count;
    return v_count;
end;
$$;

revoke all on function public.enqueue_booking_reminders(integer), public.record_booking_notification_provider_failures(jsonb)
    from public, anon, authenticated, service_role;
grant execute on function public.enqueue_booking_reminders(integer), public.record_booking_notification_provider_failures(jsonb)
    to service_role;

commit;
