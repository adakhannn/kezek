-- Client reschedule (owner decision of 25 Nov 2026, R25-27 in docs/PROJECT_REVIEW_2026-11-25.md):
-- a client moves their own future confirmed booking to another free time with the same business,
-- branch, staff member and services. Until now a client could only cancel and book again, losing
-- the slot in between.
--
-- reschedule_booking_request is a service-only command like create_confirmed_booking: the HTTP
-- boundary (POST /api/bookings/[id]/reschedule) verifies the session and passes the actor. In one
-- transaction it
--   * keeps an idempotency receipt in booking_creation_requests under its own caller namespace
--     ('reschedule:' || actor, as create_internal_booking_request uses 'internal:'), so a lost
--     response is answered by replaying the same Idempotency-Key, and a key reused for another
--     booking, time or caller fails with BOOKING_REQUEST_CONFLICT;
--   * locks the staff row, then the booking (the lock order of the booking and finance commands);
--   * refuses unless the actor is the booking's client (BOOKING_FORBIDDEN), the booking is
--     confirmed (BOOKING_STATUS_NOT_RESCHEDULABLE), has not started (BOOKING_ALREADY_STARTED, the
--     cut-off of 20261125150000) and carries no money or benefit: paid, promotion or subscription
--     applied, or a shift item (BOOKING_FINANCIAL_REVERSAL_REQUIRED, the rule of cancel_booking);
--   * checks the new time as the client holds do (20261118100000): an approved business, active
--     branch, staff and services of that branch performed by the master, a start in the future,
--     the visit inside the effective schedule (schedule_contains_booking) and no overlap with
--     another confirmed or paid booking or a live hold of the master. The duration stays the
--     booked one (end_at - start_at); booking_services keep durations and order, not times.
--     The check_explicit_schedule_booking trigger and the no_overlap constraint check again.
--   * moves start_at/end_at. The revision trigger (20261110090000) bumps notification_revision, so
--     pending events of the old time become obsolete, and the enqueue trigger writes a 'confirm'
--     event of the new revision; the explicit enqueue below is the same idempotent call, kept so
--     the command does not depend on the trigger.
-- Validation failures use SQLSTATE 22023 (the route answers 400), a taken time 'time slot is
-- already booked' (409 booking_slot_unavailable), state refusals P0001 (409).
-- Default privileges are closed (20261119030000): the ACL is stated here, service_role only.
begin;

create function public.reschedule_booking_request(
  p_request_id uuid,
  p_booking_id uuid,
  p_new_start timestamptz,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s'
as $$
declare
  v_caller_hash text;
  v_payload_hash text;
  v_receipt public.booking_creation_requests%rowtype;
  v_booking public.bookings;
  v_locked public.bookings;
  v_duration interval;
  v_end timestamptz;
  v_service_id uuid;
  v_response jsonb;
begin
  if p_actor_id is null then
    raise exception using errcode = '42501', message = 'BOOKING_AUTH_REQUIRED';
  end if;
  if p_request_id is null or p_booking_id is null or p_new_start is null or not isfinite(p_new_start) then
    raise exception using errcode = '22023', message = 'INVALID_RESCHEDULE_REQUEST';
  end if;

  v_caller_hash := encode(sha256(convert_to('reschedule:' || p_actor_id::text, 'UTF8')), 'hex');
  v_payload_hash := encode(sha256(convert_to(jsonb_build_object('kind', 'reschedule',
    'booking_id', p_booking_id, 'start_at', extract(epoch from p_new_start))::text, 'UTF8')), 'hex');
  insert into public.booking_creation_requests(request_id, caller_hash, payload_hash)
  values(p_request_id, v_caller_hash, v_payload_hash)
  on conflict(request_id) do nothing;
  select * into strict v_receipt from public.booking_creation_requests
    where request_id = p_request_id for update;
  if v_receipt.caller_hash <> v_caller_hash or v_receipt.payload_hash <> v_payload_hash then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_CONFLICT';
  end if;
  -- A replay answers what the first call did, even after the booking changed again.
  if v_receipt.response is not null then return v_receipt.response; end if;

  select * into v_booking from public.bookings where id = p_booking_id;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if v_booking.client_id is distinct from p_actor_id then
    raise exception using errcode = '42501', message = 'BOOKING_FORBIDDEN';
  end if;
  -- Staff before booking: the lock order of every booking and finance command.
  perform id from public.staff where id = v_booking.staff_id for update;
  select * into v_locked from public.bookings where id = p_booking_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'BOOKING_NOT_FOUND'; end if;
  if row(v_locked.client_id, v_locked.biz_id, v_locked.branch_id, v_locked.staff_id)
    is distinct from row(v_booking.client_id, v_booking.biz_id, v_booking.branch_id, v_booking.staff_id) then
    raise exception using errcode = '40001', message = 'BOOKING_CHANGED';
  end if;

  if v_locked.status = 'paid' or v_locked.promotion_applied is not null
    or v_locked.subscription_applied is not null
    or exists(select 1 from public.staff_shift_items i where i.booking_id = p_booking_id) then
    raise exception using errcode = 'P0001', message = 'BOOKING_FINANCIAL_REVERSAL_REQUIRED';
  end if;
  if v_locked.status <> 'confirmed' then
    raise exception using errcode = 'P0001', message = 'BOOKING_STATUS_NOT_RESCHEDULABLE';
  end if;
  if v_locked.start_at <= now() then
    raise exception using errcode = 'P0001', message = 'BOOKING_ALREADY_STARTED';
  end if;

  if not exists(select 1 from public.businesses where id = v_locked.biz_id and coalesce(is_approved, false)) then
    raise exception using errcode = '22023', message = 'BUSINESS_NOT_BOOKABLE';
  end if;
  if not exists(select 1 from public.branches where id = v_locked.branch_id and biz_id = v_locked.biz_id and is_active) then
    raise exception using errcode = '22023', message = 'branch not found or inactive';
  end if;
  if not exists(select 1 from public.staff where id = v_locked.staff_id and biz_id = v_locked.biz_id and is_active) then
    raise exception using errcode = '22023', message = 'staff not found or inactive';
  end if;
  -- The services of the visit: booking_services for a complex visit, else the booking's service.
  for v_service_id in
    select bs.service_id from public.booking_services bs where bs.booking_id = p_booking_id
    union
    select v_locked.service_id where not exists(select 1 from public.booking_services bs where bs.booking_id = p_booking_id)
  loop
    if not exists(select 1 from public.services s where s.id = v_service_id and s.biz_id = v_locked.biz_id
        and s.branch_id = v_locked.branch_id and s.active) then
      raise exception using errcode = '22023', message = 'service not found or inactive';
    end if;
    if not public._staff_performs_service(v_locked.staff_id, v_service_id, v_locked.branch_id) then
      raise exception using errcode = '22023', message = 'STAFF_DOES_NOT_PERFORM_SERVICE';
    end if;
  end loop;

  if p_new_start <= now() then
    raise exception using errcode = '22023', message = 'SLOT_IN_PAST';
  end if;
  if p_new_start = v_locked.start_at then
    raise exception using errcode = '22023', message = 'RESCHEDULE_SAME_TIME';
  end if;
  v_duration := v_locked.end_at - v_locked.start_at;
  v_end := p_new_start + v_duration;
  if not public.schedule_contains_booking(v_locked.staff_id, v_locked.branch_id, p_new_start, v_end) then
    raise exception using errcode = '22023', message = 'SCHEDULE_OUTSIDE_WORKING_HOURS';
  end if;
  if exists(select 1 from public.bookings b
      where b.staff_id = v_locked.staff_id and b.id <> p_booking_id
        and (b.status in ('confirmed', 'paid') or (b.status = 'hold' and b.expires_at > now()))
        and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_new_start, v_end, '[)')) then
    raise exception 'time slot is already booked';
  end if;

  update public.bookings set start_at = p_new_start, end_at = v_end where id = p_booking_id;
  perform public.enqueue_booking_notification(p_booking_id, 'confirm');

  v_response := jsonb_build_object('booking_id', p_booking_id, 'rescheduled', true,
    'start_at', p_new_start, 'end_at', v_end);
  update public.booking_creation_requests set booking_id = p_booking_id, response = v_response
    where request_id = p_request_id;
  return v_response;
end;
$$;
revoke all on function public.reschedule_booking_request(uuid,uuid,timestamptz,uuid) from public,anon,authenticated;
grant execute on function public.reschedule_booking_request(uuid,uuid,timestamptz,uuid) to service_role;
comment on function public.reschedule_booking_request(uuid,uuid,timestamptz,uuid) is
 'Service-only client reschedule command. Actor is supplied by the authenticated HTTP boundary; same booking, staff, branch and services, new start. Direct browser RPC is forbidden.';

commit;
