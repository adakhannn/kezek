-- The last function that differed between production and a database built from the migrations
-- (privilege parity check, 19 November; see 20261119050000_privilege_parity_with_prod). Production's
-- get_free_slots_service_day has the same code with older comments. Re-creating it from the
-- migration chain's own definition makes every project function identical in body, interface,
-- config and grants (CREATE OR REPLACE keeps the grants). In a database built from the migrations
-- this replaces the function with itself.
CREATE OR REPLACE FUNCTION public.get_free_slots_service_day(p_biz_id uuid, p_service_id uuid, p_day date, p_per_staff integer DEFAULT 3, p_step_min integer DEFAULT 15, p_tz text DEFAULT 'Asia/Bishkek'::text)
 RETURNS TABLE(staff_id uuid, start_at timestamp with time zone, end_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with svc as (
  select duration_min from services
  where id = p_service_id and biz_id = p_biz_id and active = true
),
masters as (
  select st.id as staff_id
  from service_staff ss
  join staff st on st.id = ss.staff_id and st.biz_id = p_biz_id and st.is_active = true
  where ss.service_id = p_service_id
),
hours as (
  select
    wh.staff_id,
    -- границы окна локально
    make_timestamptz(extract(year from p_day)::int,
                     extract(month from p_day)::int,
                     extract(day from p_day)::int,
                     split_part(i->>'start',':',1)::int,
                     split_part(i->>'start',':',2)::int,
                     0, p_tz) at time zone p_tz as start_local,
    make_timestamptz(extract(year from p_day)::int,
                     extract(month from p_day)::int,
                     extract(day from p_day)::int,
                     split_part(i->>'end',':',1)::int,
                     split_part(i->>'end',':',2)::int,
                     0, p_tz) at time zone p_tz as end_local
  from working_hours wh
  join masters m on m.staff_id = wh.staff_id
  cross join lateral jsonb_array_elements(wh.intervals) as i
  where wh.biz_id = p_biz_id
    and wh.day_of_week = extract(isodow from p_day)::int % 7
),
grid as (
  select
    h.staff_id,
    (gs.slot at time zone p_tz) at time zone 'UTC' as start_at, -- делаем timestamptz корректно
    (gs.slot + (svc.duration_min || ' minutes')::interval) at time zone 'UTC' as end_at
  from hours h
  cross join svc
  cross join lateral generate_series(
    h.start_local,
    h.end_local - (svc.duration_min || ' minutes')::interval,
    (p_step_min || ' minutes')::interval
  ) as gs(slot)
),
free as (
  select g.*
  from grid g
  where not exists (
    select 1 from bookings b
    where b.biz_id = p_biz_id
      and b.staff_id = g.staff_id
      and b.status in ('hold','confirmed','paid')
      and tstzrange(b.start_at, b.end_at, '[)') && tstzrange(g.start_at, g.end_at, '[)')
  )
)
select staff_id, start_at, end_at
from (
  select f.*,
         row_number() over (partition by staff_id order by start_at asc) as rn
  from free f
) t
where rn <= p_per_staff
order by staff_id, start_at;
$function$
;
