-- The guest receipt returns the business time zone (ARCH-11): the receipt page shows the visit time
-- in the business's zone, not in Asia/Bishkek. A new last column, so the result type changes and
-- the function is recreated with the same owner, grants and body otherwise.
begin;

set local lock_timeout = '5s';

drop function public.booking_receipt_public(uuid);

create function public.booking_receipt_public(p_id uuid)
 returns table(id uuid, status public.booking_status, start_at timestamp with time zone, end_at timestamp with time zone, staff_name text, services jsonb, tz text)
 language sql
 stable security definer
 set search_path to ''
as $function$
  select b.id, b.status, b.start_at, b.end_at, st.full_name,
    case when exists(select 1 from public.booking_services bs where bs.booking_id=b.id)
      then (select jsonb_agg(jsonb_build_object(
        'name_ru',s.name_ru,'name_ky',s.name_ky,'name_en',s.name_en,
        'duration_min',bs.duration_min) order by bs.order_index,bs.service_id)
        from public.booking_services bs join public.services s on s.id=bs.service_id
        where bs.booking_id=b.id)
      else jsonb_build_array(jsonb_build_object(
        'name_ru',primary_service.name_ru,'name_ky',primary_service.name_ky,
        'name_en',primary_service.name_en,'duration_min',primary_service.duration_min))
    end,
    coalesce(nullif(btrim(biz.tz),''),'Asia/Bishkek')
  from public.bookings b
  join public.staff st on st.id=b.staff_id
  join public.services primary_service on primary_service.id=b.service_id
  join public.businesses biz on biz.id=b.biz_id
  where b.id=p_id;
$function$;

alter function public.booking_receipt_public(uuid) owner to postgres;
revoke all on function public.booking_receipt_public(uuid) from public;
grant execute on function public.booking_receipt_public(uuid) to anon, authenticated, service_role;

commit;
