-- Client and guest bookings were checked less than the booking UI implies (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md MOB-01, API-04):
--   * Neither the slots nor the hold commands checked service_staff, so the mobile app (whose
--     staff step lists every active staff member of the branch) and direct API calls booked a
--     master for a service they do not perform. The web UI filters by service_staff
--     (packages/core-domain filterServicesForStaff); _staff_performs_service() applies the same
--     rule in the database: an active link, or, for staff working away from their home branch
--     (temporary transfer), a linked service with the same name and duration; a business that
--     never linked services to staff keeps showing every master.
--   * The simple holds did not check that the service belongs to the booked branch.
--   * The complex holds (services[]) took duration_min from the client and checked neither the
--     working schedule nor the start time: a client could hold a master for a year from any
--     moment. Durations now come from services, the whole visit must fit the schedule
--     (schedule_contains_booking) and every service must be the branch's and performed by the
--     master. No hold may start in the past (five minutes of grace for a slot shown at its
--     start; the UI offers slots from 30 minutes ahead).
-- Validation failures use SQLSTATE 22023, which the booking route answers with 400.
-- Internal bookings by managers (create_internal_*) are unchanged.
begin;

create or replace function public._staff_performs_service(p_staff_id uuid, p_service_id uuid, p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (
            select 1 from public.service_staff ss
             where ss.service_id = p_service_id and ss.staff_id = p_staff_id and ss.is_active)
        or exists (
            select 1
              from public.services target
              join public.staff st on st.id = p_staff_id and st.biz_id = target.biz_id
              join public.services own on own.biz_id = target.biz_id and own.id <> target.id
                   and own.name_ru = target.name_ru and own.duration_min = target.duration_min
              join public.service_staff ss on ss.service_id = own.id and ss.staff_id = p_staff_id and ss.is_active
             where target.id = p_service_id and st.branch_id is distinct from p_branch_id)
        or not exists (
            select 1
              from public.services s
              join public.staff st on st.biz_id = s.biz_id
              join public.service_staff ss on ss.staff_id = st.id and ss.is_active
             where s.id = p_service_id);
$$;

revoke all on function public._staff_performs_service(uuid, uuid, uuid) from public, anon, authenticated, service_role;

-- Slots for one service: only staff who perform it (also used per staff by get_free_slots_page_v1).
CREATE OR REPLACE FUNCTION public.get_free_slots_service_day_v2(
    p_biz_id uuid,
    p_service_id uuid,
    p_day date,
    p_per_staff integer,
    p_step_min integer,
    p_staff_id uuid
)
RETURNS TABLE(
    staff_id uuid,
    branch_id uuid,
    start_at timestamp with time zone,
    end_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_service record;
  v_staff record;
  v_sched record;
  v_dur_min int;
  v_biz_tz text;
  v_effective_branch_id uuid;
BEGIN
  -- current_user is the definer; the SET ROLE/session login identifies the invoker.
  IF p_staff_id IS NULL AND coalesce(nullif(current_setting('role',true),'none'),session_user)
    NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'USE_PAGED_SLOTS';
  END IF;
  -- 1) сервис и его филиал
  SELECT s.id, s.biz_id, s.branch_id, s.duration_min
  INTO v_service
  FROM public.services s
  WHERE s.id = p_service_id AND s.biz_id = p_biz_id AND s.active;

  IF v_service.id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND_OR_INACTIVE';
  END IF;

  v_dur_min := v_service.duration_min;

  -- tz бизнеса
  SELECT b.tz INTO v_biz_tz FROM public.businesses b WHERE b.id = p_biz_id;
  IF v_biz_tz IS NULL THEN v_biz_tz := 'Asia/Bishkek'; END IF;

  -- 2) Select the requested staff before resolving any schedules.
  -- Separate UNION branches retain a primary-key lookup even with a generic plan.
  FOR v_staff IN
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE p_staff_id IS NULL AND st.biz_id = p_biz_id AND st.is_active
      AND public._staff_performs_service(st.id, p_service_id, v_service.branch_id)
    UNION ALL
    SELECT st.id AS staff_id, st.branch_id AS home_branch_id
    FROM public.staff st
    WHERE p_staff_id IS NOT NULL AND st.id = p_staff_id
      AND st.biz_id = p_biz_id AND st.is_active
      AND public._staff_performs_service(st.id, p_service_id, v_service.branch_id)
  LOOP
    -- Получаем расписание на дату (resolve_staff_day уже учитывает временные переводы)
    SELECT * INTO v_sched FROM public.resolve_staff_day(v_staff.staff_id, p_day);
    IF NOT FOUND THEN CONTINUE; END IF;

    -- Проверяем, что в расписании есть интервалы работы
    IF v_sched.intervals IS NULL OR jsonb_array_length(v_sched.intervals) = 0 THEN
      CONTINUE;
    END IF;

    -- Определяем эффективный филиал мастера на эту дату из расписания
    v_effective_branch_id := v_sched.branch_id;

    -- The canonical resolver already decided the branch. A second lookup must
    -- never resurrect a superseded transfer in a different branch.
    IF v_effective_branch_id IS DISTINCT FROM v_service.branch_id THEN CONTINUE; END IF;

    -- генерим сетку слотов в локальном времени бизнеса → переводим в timestamptz
    RETURN QUERY
      WITH
        raw_intervals AS (
          SELECT jsonb_array_elements(v_sched.intervals) AS j
        ),
        work AS (
          SELECT
            -- локальный старт/финиш (ts without tz), собранные из p_day + 'HH:MM'
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS begin_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS end_local
          FROM raw_intervals
        ),
        timeline AS (
          SELECT
            generate_series(
              w.begin_local,
              w.end_local - make_interval(mins => v_dur_min),
              make_interval(mins => p_step_min)
            ) AS slot_local_start
          FROM work w
          WHERE w.end_local > w.begin_local
        ),
        slots_local AS (
          SELECT
            t.slot_local_start,
            t.slot_local_start + make_interval(mins => v_dur_min) AS slot_local_end
          FROM timeline t
        ),
        -- убираем перерывы
        breaks_local AS (
          SELECT
            ( (p_day::text || ' ' || (j->>'start'))::timestamp ) AS b_start_local,
            ( (p_day::text || ' ' || (j->>'end'))::timestamp )   AS b_end_local
          FROM jsonb_array_elements(v_sched.breaks) AS j
        ),
        slots_no_breaks AS (
          SELECT s.*
          FROM slots_local s
          WHERE NOT EXISTS (
            SELECT 1
            FROM breaks_local b
            WHERE tstzrange((s.slot_local_start AT TIME ZONE v_biz_tz), (s.slot_local_end AT TIME ZONE v_biz_tz), '[)')
                  && tstzrange((b.b_start_local AT TIME ZONE v_biz_tz), (b.b_end_local AT TIME ZONE v_biz_tz), '[)')
          )
        ),
        slots_tz AS (
          SELECT
            -- приводим «локальное» время бизнеса к timestamptz (UTC)
            (s.slot_local_start AT TIME ZONE v_biz_tz) AS slot_start,
            (s.slot_local_end   AT TIME ZONE v_biz_tz) AS slot_end
          FROM slots_no_breaks s
        ),
        free AS (
          SELECT stz.slot_start, stz.slot_end
          FROM slots_tz stz
          WHERE NOT EXISTS (
            SELECT 1
            FROM public.bookings bk
            WHERE bk.biz_id = p_biz_id
              AND bk.staff_id = v_staff.staff_id
              AND (bk.status IN ('confirmed', 'paid') OR (bk.status='hold' AND bk.expires_at>now()))
              AND tstzrange(bk.start_at, bk.end_at, '[)') && tstzrange(stz.slot_start, stz.slot_end, '[)')
          )
          ORDER BY stz.slot_start
          LIMIT p_per_staff
        )
    SELECT v_staff.staff_id, v_effective_branch_id, f.slot_start, f.slot_end
    FROM free f;
  END LOOP;

  RETURN;
END$function$;

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
    where id = p_service_id and biz_id = p_biz_id and branch_id = p_branch_id and active = true;
    if not found then raise exception using errcode = '22023', message = 'service not found or inactive'; end if;

    if not exists (select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'staff not found or inactive'; end if;

    if not exists (select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true)
    then raise exception 'branch not found or inactive'; end if;

    if not public._staff_performs_service(p_staff_id, p_service_id, p_branch_id) then
        raise exception using errcode = '22023', message = 'STAFF_DOES_NOT_PERFORM_SERVICE';
    end if;
    if p_start < now() - interval '5 minutes' then
        raise exception using errcode = '22023', message = 'SLOT_IN_PAST';
    end if;

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

    if p_services is null or jsonb_typeof(p_services) <> 'array'
       or jsonb_array_length(p_services) = 0 or jsonb_array_length(p_services) > 20 then
        raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
    end if;
    if p_start < now() - interval '5 minutes' then
        raise exception using errcode = '22023', message = 'SLOT_IN_PAST';
    end if;

    -- Each service: the branch's, active, performed by the master; duration from the catalog.
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_service_id := (p_services->v_index->>'service_id')::uuid;
        if v_service_id is null then
            raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
        end if;

        select s.duration_min into v_duration_min
          from public.services s
         where s.id = v_service_id and s.biz_id = p_biz_id and s.branch_id = p_branch_id and s.active = true;
        if not found then
            raise exception using errcode = '22023', message = 'service not found or inactive';
        end if;
        if not public._staff_performs_service(p_staff_id, v_service_id, p_branch_id) then
            raise exception using errcode = '22023', message = 'STAFF_DOES_NOT_PERFORM_SERVICE';
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;
    if not public.schedule_contains_booking(p_staff_id, p_branch_id, p_start, v_end) then
        raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS';
    end if;

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
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);
        select s.duration_min into v_duration_min from public.services s where s.id = v_service_id;

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

CREATE OR REPLACE FUNCTION public.hold_slot_guest(p_biz_id uuid, p_branch_id uuid, p_service_id uuid, p_staff_id uuid, p_start timestamp with time zone, p_client_name text, p_client_phone text, p_client_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_service_duration_min int;
  v_end timestamptz;
  v_expires_at timestamptz;
  v_booking_id uuid;
  v_client_name_trimmed text;
  v_client_phone_trimmed text;
  v_client_email_trimmed text;
begin
  if p_client_name is null or trim(p_client_name)='' then
    raise exception 'client_name is required';
  end if;
  if p_client_phone is null or trim(p_client_phone)='' then
    raise exception 'client_phone is required';
  end if;
  v_client_name_trimmed:=trim(p_client_name);
  v_client_phone_trimmed:=trim(p_client_phone);
  v_client_email_trimmed:=case when p_client_email is not null then trim(p_client_email) else null end;
  select duration_min into v_service_duration_min from public.services
    where id=p_service_id and biz_id=p_biz_id and branch_id=p_branch_id and active=true;
  if not found then raise exception using errcode='22023', message='service not found or inactive'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'staff not found or inactive';
  end if;
  if not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'branch not found or inactive';
  end if;
  if not public._staff_performs_service(p_staff_id,p_service_id,p_branch_id) then
    raise exception using errcode='22023', message='STAFF_DOES_NOT_PERFORM_SERVICE';
  end if;
  if p_start < now() - interval '5 minutes' then
    raise exception using errcode='22023', message='SLOT_IN_PAST';
  end if;
  v_end:=p_start+(v_service_duration_min||' minutes')::interval;
  if not public.schedule_contains_booking(p_staff_id,p_branch_id,p_start,v_end) then
    raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS';
  end if;
  v_expires_at:=now()+interval '2 minutes';
  if exists(
    select 1 from public.bookings where staff_id=p_staff_id and status in('confirmed','paid')
      and tstzrange(start_at,end_at,'[)')&&tstzrange(p_start,v_end,'[)')
    union all
    select 1 from public.bookings where staff_id=p_staff_id and status='hold'
      and (expires_at is null or expires_at>=now())
      and tstzrange(start_at,end_at,'[)')&&tstzrange(p_start,v_end,'[)')
  ) then raise exception 'time slot is already booked'; end if;
  insert into public.bookings(biz_id,branch_id,service_id,staff_id,client_id,
    client_name,client_phone,client_email,start_at,end_at,status,expires_at)
  values(p_biz_id,p_branch_id,p_service_id,p_staff_id,null,
    v_client_name_trimmed,v_client_phone_trimmed,v_client_email_trimmed,p_start,v_end,
    'hold'::booking_status,v_expires_at)
  returning id into v_booking_id;
  return v_booking_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.hold_complex_slot_guest(p_biz_id uuid, p_branch_id uuid, p_staff_id uuid, p_start timestamp with time zone, p_services jsonb, p_client_name text, p_client_phone text, p_client_email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
    v_booking_id uuid;
    v_expires_at timestamptz;
    v_total_duration_min integer := 0;
    v_item jsonb;
    v_service_id uuid;
    v_duration_min integer;
    v_order_index integer;
    v_index integer := 0;
    v_end timestamptz;
    v_client_name_trimmed text;
    v_client_phone_trimmed text;
    v_client_email_trimmed text;
begin
    if p_client_name is null or trim(p_client_name) = '' then
        raise exception 'client_name is required';
    end if;
    if p_client_phone is null or trim(p_client_phone) = '' then
        raise exception 'client_phone is required';
    end if;

    v_client_name_trimmed := trim(p_client_name);
    v_client_phone_trimmed := trim(p_client_phone);
    v_client_email_trimmed := case when p_client_email is not null then trim(p_client_email) else null end;

    if not exists (
        select 1 from public.branches
        where id = p_branch_id and biz_id = p_biz_id and is_active = true
    ) then
        raise exception 'branch not found or inactive';
    end if;

    if not exists (
        select 1 from public.staff
        where id = p_staff_id and biz_id = p_biz_id and (branch_id = p_branch_id or exists (select 1 from public.staff_schedule_versions v where v.staff_id = p_staff_id)) and is_active = true
    ) then
        raise exception 'staff not found or inactive';
    end if;

    if p_services is null or jsonb_typeof(p_services) <> 'array'
       or jsonb_array_length(p_services) = 0 or jsonb_array_length(p_services) > 20 then
        raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
    end if;
    if p_start < now() - interval '5 minutes' then
        raise exception using errcode = '22023', message = 'SLOT_IN_PAST';
    end if;

    -- Each service: the branch's, active, performed by the master; duration from the catalog.
    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_service_id := (p_services->v_index->>'service_id')::uuid;
        if v_service_id is null then
            raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
        end if;

        select s.duration_min into v_duration_min
          from public.services s
         where s.id = v_service_id and s.biz_id = p_biz_id and s.branch_id = p_branch_id and s.active = true;
        if not found then
            raise exception using errcode = '22023', message = 'service not found or inactive';
        end if;
        if not public._staff_performs_service(p_staff_id, v_service_id, p_branch_id) then
            raise exception using errcode = '22023', message = 'STAFF_DOES_NOT_PERFORM_SERVICE';
        end if;

        v_total_duration_min := v_total_duration_min + v_duration_min;
    end loop;

    if v_total_duration_min <= 0 then
        raise exception using errcode = '22023', message = 'INVALID_BOOKING_REQUEST';
    end if;

    v_end := p_start + (v_total_duration_min || ' minutes')::interval;
    if not public.schedule_contains_booking(p_staff_id, p_branch_id, p_start, v_end) then
        raise exception 'SCHEDULE_OUTSIDE_WORKING_HOURS';
    end if;
    v_expires_at := now() + interval '2 minutes';

    if exists (
        select 1 from public.bookings
        where staff_id = p_staff_id
          and (status in ('confirmed','paid') or (status = 'hold' and expires_at > now()))
          and tstzrange(start_at, end_at, '[)') && tstzrange(p_start, v_end, '[)')
    ) then
        raise exception 'time slot is already booked';
    end if;

    insert into public.bookings (
        biz_id, branch_id, service_id, staff_id,
        client_id, client_name, client_phone, client_email,
        start_at, end_at, status, expires_at
    )
    values (
        p_biz_id, p_branch_id, (p_services->0->>'service_id')::uuid, p_staff_id,
        null, v_client_name_trimmed, v_client_phone_trimmed, v_client_email_trimmed,
        p_start, v_end, 'hold'::booking_status, v_expires_at
    )
    returning id into v_booking_id;

    for v_index in 0 .. jsonb_array_length(p_services) - 1 loop
        v_item := p_services->v_index;
        v_service_id := (v_item->>'service_id')::uuid;
        v_order_index := coalesce((v_item->>'order_index')::integer, v_index);
        select s.duration_min into v_duration_min from public.services s where s.id = v_service_id;

        insert into public.booking_services (booking_id, service_id, duration_min, order_index)
        values (v_booking_id, v_service_id, v_duration_min, v_order_index);
    end loop;

    return v_booking_id;
end;
$function$;

commit;
