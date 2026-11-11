-- Exact legacy seven-argument function from schema-only snapshot, used to verify revocation.
CREATE OR REPLACE FUNCTION public.create_internal_booking(p_biz_id uuid, p_branch_id uuid, p_service_id uuid, p_staff_id uuid, p_start timestamp with time zone, p_minutes integer, p_client_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_booking_id uuid;
  v_client_role_id uuid;
begin
  -- TODO: твои проверки пересечений/RLS (если были) до вставки

  insert into public.bookings (
    biz_id, branch_id, service_id, staff_id, client_id,
    start_at, end_at, status, time_range, source
  )
  values (
    p_biz_id, p_branch_id, p_service_id, p_staff_id, p_client_id,
    p_start, p_start + make_interval(mins => p_minutes),
    'hold',
    tstzrange(p_start, p_start + make_interval(mins => p_minutes), '[)'),
    'desk'
  )
  returning id into v_booking_id;

  -- назначаем роль 'client' пользователю в этом бизнесе (если ещё нет)
  select id into v_client_role_id
  from public.roles
  where key = 'client'
  limit 1;

  if v_client_role_id is not null and p_client_id is not null then
    insert into public.user_roles(user_id, biz_id, role_id)
    values (p_client_id, p_biz_id, v_client_role_id)
    on conflict (user_id, role_id, biz_id) do nothing;
  end if;

  return v_booking_id;
end;
$function$;
