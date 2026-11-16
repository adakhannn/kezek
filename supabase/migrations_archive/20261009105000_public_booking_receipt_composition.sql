-- Existing public receipt UUID is the capability; expose visit details only,
-- never client identity, contacts, internal notes or financial ledger data.
-- Keep booking_view_public intact for existing consumers.
begin;
create function public.booking_receipt_public(p_id uuid)
returns table(id uuid, status public.booking_status, start_at timestamptz,
              end_at timestamptz, staff_name text, services jsonb)
language sql stable security definer set search_path = ''
as $$
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
    end
  from public.bookings b
  join public.staff st on st.id=b.staff_id
  join public.services primary_service on primary_service.id=b.service_id
  where b.id=p_id;
$$;
revoke all on function public.booking_receipt_public(uuid) from public;
grant execute on function public.booking_receipt_public(uuid) to anon, authenticated, service_role;
commit;
