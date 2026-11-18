-- SECURITY DEFINER hardening found while checking the isolated SQL suites against the migration chain
-- (CI-01 follow-up).
--
-- 1. Four SECURITY DEFINER functions had no search_path of their own, so they resolved names through
--    the caller's search_path while running as their owner. All four are callable by service_role only,
--    and every name in their bodies lives in public or pg_catalog, so pinning the path changes nothing
--    they do; it only removes the dependence on the caller's settings.
alter function public.apply_visit_package_to_booking_impl_20261109(uuid) set search_path = pg_catalog, public;
alter function public.branch_admins_effective(uuid) set search_path = pg_catalog, public;
alter function public.recalculate_ratings_for_date(date) set search_path = pg_catalog, public;
alter function public.save_shift_items_atomic(uuid, jsonb) set search_path = pg_catalog, public;

-- 2. The *_impl_20261109 bodies are called only by their SECURITY DEFINER wrappers, which run as the
--    owner and add the access checks (20261109091100, 20261110130000). service_role could still call
--    the bodies directly and skip those checks: apply_visit_package_to_booking itself is closed to
--    service_role since 20261110130000, its body was not. No application code calls them.
revoke all on function public.apply_visit_package_to_booking_impl_20261109(uuid) from service_role;
revoke all on function public.get_business_finance_stats_impl_20261109(uuid, date, date, uuid, boolean) from service_role;
revoke all on function public.get_staff_finance_stats_impl_20261109(uuid, uuid, date, date, boolean) from service_role;
