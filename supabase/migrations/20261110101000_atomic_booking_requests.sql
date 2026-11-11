-- A request receipt survives response loss; no process-local state or expiry
-- can turn the same request into another booking. Apply after the outbox.
begin;

create table public.booking_creation_requests (
  request_id uuid primary key,
  caller_hash text not null,
  payload_hash text not null,
  booking_id uuid,
  response jsonb,
  created_at timestamptz not null default now(),
  constraint booking_creation_receipt_complete check (
    (booking_id is null and response is null) or
    (booking_id is not null and response is not null)
  )
);
alter table public.booking_creation_requests enable row level security;
revoke all on public.booking_creation_requests from public, anon, authenticated;

create or replace function public.create_confirmed_booking(
  p_request_id uuid,
  p_payload jsonb,
  p_guest_secret text default null
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_user_id uuid := auth.uid();
  v_guest boolean := p_guest_secret is not null;
  v_caller_hash text;
  v_payload_hash text;
  v_payload jsonb;
  v_receipt public.booking_creation_requests%rowtype;
  v_biz_id uuid;
  v_branch_id uuid;
  v_service_id uuid;
  v_staff_id uuid;
  v_start timestamptz;
  v_services jsonb;
  v_booking_id uuid;
  v_response jsonb;
begin
  if p_request_id is null or p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
  end if;
  if v_guest then
    if p_guest_secret !~ '^[a-f0-9]{64}$' then
      raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
    end if;
    v_caller_hash := encode(sha256(convert_to('guest:' || p_guest_secret, 'UTF8')), 'hex');
  else
    if v_user_id is null then
      raise exception using errcode = '42501', message = 'BOOKING_AUTH_REQUIRED';
    end if;
    v_caller_hash := encode(sha256(convert_to('user:' || v_user_id::text, 'UTF8')), 'hex');
  end if;

  v_biz_id := (p_payload->>'biz_id')::uuid;
  v_branch_id := (p_payload->>'branch_id')::uuid;
  v_service_id := (p_payload->>'service_id')::uuid;
  v_staff_id := (p_payload->>'staff_id')::uuid;
  v_start := (p_payload->>'start_at')::timestamptz;
  v_services := nullif(p_payload->'services', 'null'::jsonb);
  if v_biz_id is null or v_staff_id is null or v_start is null or
     (v_guest and v_branch_id is null) or
     (v_services is not null and (jsonb_typeof(v_services) <> 'array' or jsonb_array_length(v_services) > 20)) then
    raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
  end if;
  if v_service_id is null then v_service_id := (v_services->0->>'service_id')::uuid; end if;
  if v_service_id is null then
    raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
  end if;
  -- Hash the effective command, not JSON property order, timestamp spelling,
  -- ignored extra fields, or caller-supplied identity fields.
  v_payload := jsonb_build_object(
    'biz_id', v_biz_id, 'branch_id', v_branch_id, 'service_id', v_service_id,
    'staff_id', v_staff_id, 'start_at', extract(epoch from v_start), 'services', v_services,
    'client_name', case when v_guest then trim(p_payload->>'client_name') end,
    'client_phone', case when v_guest then trim(p_payload->>'client_phone') end,
    'client_email', case when v_guest then trim(p_payload->>'client_email') end
  );
  v_payload_hash := encode(sha256(convert_to(v_payload::text, 'UTF8')), 'hex');

  insert into public.booking_creation_requests(request_id, caller_hash, payload_hash)
  values(p_request_id, v_caller_hash, v_payload_hash)
  on conflict(request_id) do nothing;
  select * into strict v_receipt from public.booking_creation_requests
    where request_id = p_request_id for update;
  if v_receipt.caller_hash <> v_caller_hash or v_receipt.payload_hash <> v_payload_hash then
    raise exception using errcode = 'P0001', message = 'BOOKING_REQUEST_CONFLICT';
  end if;
  if v_receipt.response is not null then return v_receipt.response; end if;

  if v_branch_id is null then
    select id into v_branch_id from public.branches
      where biz_id = v_biz_id and is_active order by id limit 1;
    if not found then
      raise exception using errcode = 'P0001', message = 'NO_ACTIVE_BRANCH_FOR_BIZ';
    end if;
  end if;
  -- Serialize different request keys for the same staff too. Existing writers
  -- perform their conflict check after this lock, including legacy schedules.
  perform id from public.staff where id = v_staff_id and biz_id = v_biz_id for update;
  if not found then
    raise exception using errcode = '22023', message = 'staff not found or inactive';
  end if;
  if v_guest then
    if coalesce(jsonb_array_length(v_services), 0) > 1 then
      v_booking_id := public.hold_complex_slot_guest(v_biz_id, v_branch_id, v_staff_id, v_start,
        v_services, p_payload->>'client_name', p_payload->>'client_phone', p_payload->>'client_email');
    else
      v_booking_id := public.hold_slot_guest(v_biz_id, v_branch_id, v_service_id, v_staff_id, v_start,
        p_payload->>'client_name', p_payload->>'client_phone', p_payload->>'client_email');
    end if;
  else
    if coalesce(jsonb_array_length(v_services), 0) > 0 then
      v_booking_id := public.hold_complex_slot(v_biz_id, v_branch_id, v_staff_id, v_start, v_services);
    else
      v_booking_id := public.hold_slot(v_biz_id, v_branch_id, v_service_id, v_staff_id, v_start);
    end if;
  end if;
  perform public.confirm_booking(v_booking_id);
  perform public.enqueue_booking_notification(v_booking_id, 'confirm');
  v_response := jsonb_build_object('booking_id', v_booking_id, 'confirmed', true);
  update public.booking_creation_requests set booking_id = v_booking_id, response = v_response
    where request_id = p_request_id;
  return v_response;
end;
$$;
revoke all on function public.create_confirmed_booking(uuid, jsonb, text) from public;
grant execute on function public.create_confirmed_booking(uuid, jsonb, text) to anon, authenticated;
-- All application creation paths now use the atomic command. Keep legacy
-- writers internal so direct RPC callers cannot bypass request identity.
revoke all on function public.hold_slot(uuid,uuid,uuid,uuid,timestamptz),
  public.hold_complex_slot(uuid,uuid,uuid,timestamptz,jsonb),
  public.hold_slot_guest(uuid,uuid,uuid,uuid,timestamptz,text,text,text),
  public.hold_complex_slot_guest(uuid,uuid,uuid,timestamptz,jsonb,text,text,text)
  from public, anon, authenticated;
comment on table public.booking_creation_requests is
  'Durable booking command receipts. Do not expire/delete receipts: response loss must never create another booking.';
commit;
