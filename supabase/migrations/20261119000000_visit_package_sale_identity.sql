-- Selling a visit package (17 Nov review, docs/PROJECT_REVIEW_2026-11-17.md API-11) was not
-- idempotent: a double click or a retried request after a lost response sold a second package.
-- And dates were UTC: in Bishkek (UTC+6) a package sold between 00:00 and 06:00 got its term
-- counted from yesterday, and the visit lookup treated a package as valid for up to six hours
-- after its last local day.
--   * client_visit_packages.request_id stores the sale request's Idempotency-Key; the unique
--     index lets a retry find the package it already created instead of selling another one;
--   * get_applicable_visit_package_for_booking compares valid_until with today in the
--     business's time zone (DB-16 guarantees a valid businesses.tz).
begin;

set local lock_timeout = '5s';

alter table public.client_visit_packages add column if not exists request_id uuid;

comment on column public.client_visit_packages.request_id is
    'Idempotency key of the sale request (API-11): a retried sale returns the package it created.';

create unique index if not exists client_visit_packages_request_id_key
    on public.client_visit_packages (request_id)
    where request_id is not null;

create or replace function public.get_applicable_visit_package_for_booking(p_booking_id uuid)
returns uuid language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_booking record; v_package_id uuid; v_today date;
begin
    perform public.assert_booking_finance_access(p_booking_id);
    select b.id, b.biz_id, b.client_id, b.branch_id, b.service_id, b.status, coalesce(z.tz, 'Asia/Bishkek') as tz
      into v_booking
      from public.bookings b
      join public.businesses z on z.id = b.biz_id
     where b.id = p_booking_id;
    if v_booking.client_id is null or v_booking.status<>'paid'
        or exists(select 1 from public.client_visit_package_uses where booking_id=p_booking_id) then return null; end if;
    -- The package is valid through valid_until in the business's own calendar.
    v_today := (now() at time zone v_booking.tz)::date;
    select cvp.id into v_package_id
    from public.client_visit_packages cvp join public.visit_package_plans p on p.id=cvp.plan_id
    where cvp.client_id=v_booking.client_id and p.biz_id=v_booking.biz_id
        and cvp.remaining_visits>0 and cvp.valid_until>=v_today and p.is_active=true
        and (p.service_id is null or p.service_id=v_booking.service_id)
        and (p.branch_ids is null or array_length(p.branch_ids,1) is null or v_booking.branch_id=any(p.branch_ids))
    order by cvp.valid_until,cvp.id limit 1;
    return v_package_id;
end;
$$;
revoke all on function public.get_applicable_visit_package_for_booking(uuid) from public,anon;
grant execute on function public.get_applicable_visit_package_for_booking(uuid) to authenticated,service_role;

commit;
