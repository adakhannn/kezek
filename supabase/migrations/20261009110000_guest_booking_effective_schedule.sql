-- Preserve the deployed guest writer's two-minute hold and expired-hold
-- semantics. Work location is resolved by the shared effective schedule,
-- not the staff's permanent home branch. Existing grants/triggers unchanged.
begin;
create or replace function public.hold_slot_guest(
  p_biz_id uuid,p_branch_id uuid,p_service_id uuid,p_staff_id uuid,
  p_start timestamptz,p_client_name text,p_client_phone text,p_client_email text default null
) returns uuid language plpgsql security definer set search_path = public
as $$
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
    where id=p_service_id and biz_id=p_biz_id and active=true;
  if not found then raise exception 'service not found or inactive'; end if;
  if not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'staff not found or inactive';
  end if;
  if not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id and is_active=true) then
    raise exception 'branch not found or inactive';
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
$$;
commit;
