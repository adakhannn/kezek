-- Verified HTTP actors enter through one service-only command. No JWT/session claim impersonation.
begin;

create or replace function public._hold_slot_for_actor(
    p_biz_id uuid, p_branch_id uuid, p_service_id uuid,
    p_staff_id uuid, p_start timestamptz, p_actor_id uuid
)
returns uuid language plpgsql security definer set search_path = public, pg_temp
as $$
declare
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_service_duration_min int;
    v_end timestamptz;
    v_booking_id uuid;
begin
    v_client_id := p_actor_id;
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;

    select coalesce(p.full_name, u.raw_user_meta_data->>'full_name', u.email),
           coalesce(p.phone, u.phone), u.email
    into v_client_name, v_client_phone, v_client_email
    from auth.users u left join public.profiles p on p.id = u.id
    where u.id = v_client_id;
    if not found then raise exception 'User not found'; end if;

    if not exists (select 1 from public.profiles where id = v_client_id) then
        insert into public.profiles (id, full_name, phone)
        values (v_client_id, coalesce(v_client_name, 'Пользователь'), v_client_phone)
        on conflict (id) do nothing;
    end if;

    select duration_min into v_service_duration_min
    from public.services
    where id = p_service_id and biz_id = p_biz_id and active = true;
    if not found then raise exception 'service not found or inactive'; end if;

    if not exists (select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'staff not found or inactive'; end if;

    if not exists (select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'branch not found or inactive'; end if;

    v_end := p_start + (v_service_duration_min || ' minutes')::interval;
    if not public.schedule_contains_booking(p_staff_id, p_branch_id, p_start, v_end)
    then raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS'; end if;

    if exists (select 1 from public.bookings
        where staff_id = p_staff_id and status in ('confirmed', 'paid')
        and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)'))
    then raise exception 'time slot is already booked'; end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id, client_id,
        client_name, client_phone, client_email, start_at, end_at, status, expires_at
    ) values (
        p_biz_id, p_branch_id, p_service_id, p_staff_id, v_client_id,
        v_client_name, v_client_phone, v_client_email, p_start, v_end,
        'confirmed'::booking_status, null
    ) returning id into v_booking_id;
    return v_booking_id;
end;
$$;

create or replace function public._hold_complex_slot_for_actor(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_start timestamptz,
    p_services jsonb,
    p_actor_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
    v_booking_id uuid;
    v_expires_at timestamptz;
    v_client_id uuid;
    v_client_name text;
    v_client_phone text;
    v_client_email text;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
begin
    -- Текущий пользователь
    v_client_id := p_actor_id;
    if v_client_id is null then
        raise exception 'User must be authenticated';
    end if;

    -- Данные клиента из профиля
    select p.full_name, p.phone, u.email
    into v_client_name, v_client_phone, v_client_email
    from public.profiles p
    join auth.users u on u.id = p.id
    where p.id = v_client_id;

    if not found then
        raise exception 'User profile not found';
    end if;

    -- Проверка филиала
    if not exists (
        select 1
        from public.branches
        where id = p_branch_id
          and biz_id = p_biz_id
          and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    -- Проверка мастера
    if not exists (
        select 1
        from public.staff
        where id = p_staff_id
          and biz_id = p_biz_id
          and (branch_id = p_branch_id or exists (select 1 from public.staff_schedule_versions v where v.staff_id = p_staff_id))
          and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    -- Валидация и суммирование услуг
    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;

        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        -- Проверяем, что услуга существует и активна в этом бизнесе
        if not exists (
            select 1
            from public.services s
            where s.id = v_service_id
              and s.biz_id = p_biz_id
              and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;

    -- Время истечения резерва (2 минуты)
    v_expires_at := now() + interval '2 minutes';

    -- Проверка пересечений с существующими бронированиями
    if exists (
        select 1
        from public.bookings
        where staff_id = p_staff_id
          and (status in ('confirmed','paid') or (status = 'hold' and expires_at > now()))
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    -- Создаём бронирование (service_id = первая услуга комплекса)
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        expires_at
    )
    values (
        p_biz_id,
        p_branch_id,
        (p_services->0->>'service_id')::uuid,
        p_staff_id,
        v_client_id,
        v_client_name,
        v_client_phone,
        v_client_email,
        p_start,
        v_end,
        'hold'::booking_status,
        v_expires_at
    )
    returning id into v_booking_id;

    -- Заполняем booking_services
    v_index := 0;
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (
            booking_id,
            service_id,
            duration_min,
            order_index
        )
        values (
            v_booking_id,
            v_service_id,
            v_duration_min,
            v_order_index
        );
    end loop;

    return v_booking_id;
end;
$$;

CREATE OR REPLACE FUNCTION public._confirm_booking_transition(
    p_booking_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
declare
    v_current_status booking_status;
begin
    -- Получаем текущий статус бронирования
    select status into v_current_status
    from public.bookings
    where id = p_booking_id for update;
    
    if not found then
        raise exception 'Booking not found';
    end if;
    
    -- Если статус уже confirmed, просто выходим (идемпотентность)
    if v_current_status = 'confirmed' then
        return;
    end if;
    
    -- Проверяем, что статус можно изменить на 'confirmed'
    if v_current_status not in ('hold') then
        raise exception 'Booking status cannot be changed to confirmed. Current status: %', v_current_status;
    end if;
    
    -- Обновляем статус на 'confirmed' и очищаем expires_at
    update public.bookings
    set status = 'confirmed'::booking_status,
        expires_at = null
    where id = p_booking_id;
    
    if not found then
        raise exception 'Failed to update booking status';
    end if;
end;
$$;

-- Private transition is shared by both checked entry points.
create function public._confirm_created_booking(p_booking_id uuid,p_actor_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_client_id uuid;
begin
  select client_id into v_client_id from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'Booking not found'; end if;
  if v_client_id is distinct from p_actor_id then
    raise exception using errcode='42501',message='BOOKING_FORBIDDEN';
  end if;
  perform public._confirm_booking_transition(p_booking_id);
end;
$$;

-- Shared authorization and lock order for checked lifecycle commands. Finance
-- commands acquire staff before shift/booking, so never acquire booking first.
create function public._assert_booking_transition_access(p_booking_id uuid)
returns public.bookings language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_booking public.bookings;
  v_locked public.bookings;
  v_actor uuid := auth.uid();
  v_role text := coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
  select * into v_booking from public.bookings where id=p_booking_id;
  if not found then raise exception using errcode='P0002',message='BOOKING_NOT_FOUND'; end if;
  if v_role not in ('service_role','postgres','supabase_admin') then
    if v_actor is null then raise exception using errcode='42501',message='BOOKING_FORBIDDEN'; end if;
    if v_booking.client_id is distinct from v_actor
      and not public.finance_can_manage_business(v_actor,v_booking.biz_id)
      and not public.has_branch_admin(v_booking.branch_id)
      and not public.is_super_admin()
      and not exists(select 1 from public.staff s where s.id=v_booking.staff_id
        and s.biz_id=v_booking.biz_id and s.user_id=v_actor and s.is_active) then
      raise exception using errcode='42501',message='BOOKING_FORBIDDEN';
    end if;
  end if;
  perform id from public.staff where id=v_booking.staff_id for update;
  select * into v_locked from public.bookings where id=p_booking_id for update;
  if not found then raise exception using errcode='P0002',message='BOOKING_NOT_FOUND'; end if;
  if row(v_locked.client_id,v_locked.biz_id,v_locked.branch_id,v_locked.staff_id)
    is distinct from row(v_booking.client_id,v_booking.biz_id,v_booking.branch_id,v_booking.staff_id) then
    raise exception using errcode='40001',message='BOOKING_CHANGED';
  end if;
  return v_locked;
end;
$$;
revoke all on function public._assert_booking_transition_access(uuid) from public,anon,authenticated,service_role;

create or replace function public.confirm_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp set lock_timeout='5s' as $$
begin
  perform public._assert_booking_transition_access(p_booking_id);
  perform public._confirm_booking_transition(p_booking_id);
end;
$$;
revoke all on function public.confirm_booking(uuid) from public,anon;
grant execute on function public.confirm_booking(uuid) to authenticated,service_role;

create or replace function public.cancel_booking(p_booking_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp set lock_timeout='5s' as $$
declare v_booking public.bookings;
begin
  v_booking := public._assert_booking_transition_access(p_booking_id);
  if v_booking.status='cancelled' then return; end if;
  if v_booking.status='paid' or v_booking.promotion_applied is not null
    or v_booking.subscription_applied is not null
    or exists(select 1 from public.staff_shift_items i where i.booking_id=p_booking_id) then
    raise exception using errcode='P0001',message='BOOKING_FINANCIAL_REVERSAL_REQUIRED';
  end if;
  if v_booking.status not in ('hold','confirmed') then
    raise exception using errcode='P0001',message='BOOKING_STATUS_NOT_CANCELLABLE';
  end if;
  update public.bookings set status='cancelled',expires_at=null where id=p_booking_id;
end;
$$;
revoke all on function public.cancel_booking(uuid) from public,anon;
grant execute on function public.cancel_booking(uuid) to authenticated,service_role;

-- RLS still controls reads. Browser DML would bypass every checked command,
-- including paid/benefit guards, so revoke both table and column write grants.
revoke insert,update,delete,truncate,references,trigger on public.bookings from public,anon,authenticated;
do $$
declare v_columns text;
begin
  select string_agg(quote_ident(attname),',') into v_columns from pg_attribute
    where attrelid='public.bookings'::regclass and attnum>0 and not attisdropped;
  execute format('revoke insert (%1$s),update (%1$s),references (%1$s) on public.bookings from public,anon,authenticated',v_columns);
end;
$$;

-- Deprecated internal wrappers retain their JWT semantics for trusted SQL
-- dependencies; external callers cannot invoke hold/confirm in separate requests.
create or replace function public.hold_slot(p_biz_id uuid,p_branch_id uuid,p_service_id uuid,p_staff_id uuid,p_start timestamptz)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select public._hold_slot_for_actor(p_biz_id,p_branch_id,p_service_id,p_staff_id,p_start,auth.uid());
$$;
create or replace function public.hold_complex_slot(p_biz_id uuid,p_branch_id uuid,p_staff_id uuid,p_start timestamptz,p_services jsonb)
returns uuid language sql security definer set search_path=public,pg_temp as $$
  select public._hold_complex_slot_for_actor(p_biz_id,p_branch_id,p_staff_id,p_start,p_services,auth.uid());
$$;
revoke all on function public.hold_slot(uuid,uuid,uuid,uuid,timestamptz),
 public.hold_complex_slot(uuid,uuid,uuid,timestamptz,jsonb),
 public._hold_slot_for_actor(uuid,uuid,uuid,uuid,timestamptz,uuid),
 public._hold_complex_slot_for_actor(uuid,uuid,uuid,timestamptz,jsonb,uuid),
 public._confirm_booking_transition(uuid),public._confirm_created_booking(uuid,uuid)
 from public,anon,authenticated,service_role;

create or replace function public.create_confirmed_booking(
  p_request_id uuid,
  p_payload jsonb,
  p_guest_secret text,
  p_actor_id uuid
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp set lock_timeout = '5s'
as $$
declare
  v_user_id uuid := p_actor_id;
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
  if v_guest and v_user_id is not null then
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
      v_booking_id := public._hold_complex_slot_for_actor(v_biz_id, v_branch_id, v_staff_id, v_start, v_services, v_user_id);
    else
      v_booking_id := public._hold_slot_for_actor(v_biz_id, v_branch_id, v_service_id, v_staff_id, v_start, v_user_id);
    end if;
  end if;
  perform public._confirm_created_booking(v_booking_id, v_user_id);
  perform public.enqueue_booking_notification(v_booking_id, 'confirm');
  v_response := jsonb_build_object('booking_id', v_booking_id, 'confirmed', true);
  update public.booking_creation_requests set booking_id = v_booking_id, response = v_response
    where request_id = p_request_id;
  return v_response;
end;
$$;
revoke all on function public.create_confirmed_booking(uuid,jsonb,text) from public,anon,authenticated,service_role;
revoke all on function public.create_confirmed_booking(uuid,jsonb,text,uuid) from public,anon,authenticated;
grant execute on function public.create_confirmed_booking(uuid,jsonb,text,uuid) to service_role;
comment on function public.create_confirmed_booking(uuid,jsonb,text,uuid) is
 'Service-only atomic booking command. Actor is supplied by the authenticated HTTP boundary; guest proof and actor are mutually exclusive. Direct browser RPC is forbidden.';

create function public._assert_internal_booking_access(p_biz_id uuid,p_branch_id uuid,p_staff_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_actor uuid:=auth.uid(); v_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
  if v_role not in ('service_role','postgres','supabase_admin') and (
    v_actor is null or not (public.finance_can_manage_business(v_actor,p_biz_id)
      or public.has_branch_admin(p_branch_id) or public.is_super_admin()
      or exists(select 1 from public.staff s where s.id=p_staff_id and s.biz_id=p_biz_id and s.user_id=v_actor and s.is_active))) then
    raise exception using errcode='42501',message='BOOKING_FORBIDDEN';
  end if;
  if not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id and is_active) then
    raise exception 'branch not found or inactive';
  end if;
  perform id from public.staff where id=p_staff_id and biz_id=p_biz_id and is_active
    and (branch_id=p_branch_id or exists(select 1 from public.staff_schedule_versions where staff_id=p_staff_id)) for update;
  if not found then raise exception 'staff not found or inactive'; end if;
end;
$$;
revoke all on function public._assert_internal_booking_access(uuid,uuid,uuid) from public,anon,authenticated,service_role;

create or replace function public.create_internal_booking(p_biz_id uuid,p_branch_id uuid,p_service_id uuid,p_staff_id uuid,
  p_start timestamptz,p_minutes integer,p_client_id uuid default null,p_client_name text default null,p_client_phone text default null)
returns uuid language plpgsql security definer set search_path=public,pg_temp set lock_timeout='5s' as $$
declare v_id uuid; v_end timestamptz;
begin
  perform public._assert_internal_booking_access(p_biz_id,p_branch_id,p_staff_id);
  if p_start is null or not isfinite(p_start) or p_minutes is null or p_minutes<1 or p_minutes>1440 then
    raise exception using errcode='22023',message='INVALID_BOOKING_REQUEST';
  end if;
  if not exists(select 1 from public.services where id=p_service_id and biz_id=p_biz_id and active) then
    raise exception 'service not found or inactive';
  end if;
  v_end:=p_start+make_interval(mins=>p_minutes);
  if exists(select 1 from public.staff_schedule_versions where staff_id=p_staff_id)
    and not public.schedule_contains_booking(p_staff_id,p_branch_id,p_start,v_end) then
    raise exception 'booking is outside effective schedule';
  end if;
  if exists(select 1 from public.bookings where staff_id=p_staff_id
    and (status in ('confirmed','paid') or (status='hold' and expires_at>now()))
    and tstzrange(start_at,end_at,'[)') && tstzrange(p_start,v_end,'[)')) then
    raise exception 'time slot is already booked';
  end if;
  insert into public.bookings(biz_id,branch_id,service_id,staff_id,start_at,end_at,status,client_id,client_name,client_phone)
    values(p_biz_id,p_branch_id,p_service_id,p_staff_id,p_start,v_end,'confirmed',p_client_id,
      case when p_client_id is null then nullif(btrim(p_client_name),'') end,
      case when p_client_id is null then nullif(btrim(p_client_phone),'') end) returning id into v_id;
  return v_id;
end;
$$;
-- Seven-argument legacy overload has no application caller; do not retain its
-- unchecked INSERT path or silently route older clients to another overload.
do $$ begin
  if to_regprocedure('public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid)') is not null then
    revoke all on function public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid) from public,anon,authenticated,service_role;
  end if;
end; $$;
revoke all on function public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid,text,text) from public,anon;
grant execute on function public.create_internal_booking(uuid,uuid,uuid,uuid,timestamptz,integer,uuid,text,text) to authenticated,service_role;
create or replace function public.create_internal_complex_booking(
    p_biz_id uuid,
    p_branch_id uuid,
    p_staff_id uuid,
    p_start timestamptz,
    p_services jsonb,
    p_client_id uuid default null,
    p_client_name text default null,
    p_client_phone text default null,
    p_client_email text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
set lock_timeout = '5s'
as $$
declare
    v_booking_id uuid;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
begin
    perform public._assert_internal_booking_access(p_biz_id,p_branch_id,p_staff_id);
    if p_start is null or not isfinite(p_start) then raise exception 'INVALID_BOOKING_REQUEST'; end if;

    -- Валидация и суммирование услуг
    if p_services is null or jsonb_typeof(p_services) <> 'array' or jsonb_array_length(p_services) = 0 or jsonb_array_length(p_services)>20 then
        raise exception 'services array must be a non-empty JSON array';
    end if;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        if v_service_id is null then
            raise exception 'service_id is required in services[%]', v_index;
        end if;
        if v_duration_min is null or v_duration_min <= 0 or v_duration_min>1440 then
            raise exception 'duration_min must be positive in services[%]', v_index;
        end if;

        -- Проверяем, что услуга существует и активна в этом бизнесе
        if not exists (
            select 1
            from public.services s
            where s.id = v_service_id
              and s.biz_id = p_biz_id
              and s.active = true
        ) then
            raise exception 'service not found or inactive: %', v_service_id;
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 or v_total_duration_min>1440 then
        raise exception 'total duration must be positive';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;

    if exists(select 1 from public.staff_schedule_versions where staff_id=p_staff_id)
      and not public.schedule_contains_booking(p_staff_id,p_branch_id,p_start,v_end) then
      raise exception 'booking is outside effective schedule';
    end if;

    -- Проверка пересечений с существующими бронированиями мастера
    if exists (
        select 1
        from public.bookings b
        where b.staff_id = p_staff_id
          and (b.status in ('confirmed','paid') or (b.status = 'hold' and b.expires_at > now()))
          and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    -- Создаём бронирование (service_id = первая услуга комплекса)
    insert into public.bookings (
        biz_id,
        branch_id,
        service_id,
        staff_id,
        client_id,
        client_name,
        client_phone,
        client_email,
        start_at,
        end_at,
        status,
        expires_at
    )
    values (
        p_biz_id,
        p_branch_id,
        (p_services->0->>'service_id')::uuid,
        p_staff_id,
        p_client_id,
        p_client_name,
        p_client_phone,
        p_client_email,
        p_start,
        v_end,
        'confirmed'::booking_status,
        null
    )
    returning id into v_booking_id;

    -- Заполняем booking_services
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_duration_min := (v_item->>'duration_min')::integer;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);

        insert into public.booking_services (
            booking_id,
            service_id,
            duration_min,
            order_index
        )
        values (
            v_booking_id,
            v_service_id,
            v_duration_min,
            v_order_index
        );
    end loop;

    return v_booking_id;
end;
$$;
revoke all on function public.create_internal_complex_booking(uuid,uuid,uuid,timestamptz,jsonb,uuid,text,text,text) from public,anon;
grant execute on function public.create_internal_complex_booking(uuid,uuid,uuid,timestamptz,jsonb,uuid,text,text,text) to authenticated,service_role;
commit;
