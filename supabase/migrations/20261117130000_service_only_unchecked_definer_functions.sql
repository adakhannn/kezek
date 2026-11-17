-- SECURITY DEFINER functions without any caller check were executable by anon and
-- authenticated (the baseline re-granted them to every API role):
--   * sync_user_notification_email adds a VERIFIED notification e-mail to ANY user, and
--     remove_user_notification_email_source deletes one. Owner and staff user ids are readable
--     with the public anon key (businesses.owner_id, staff.user_id), so anyone could attach
--     their own address to a business owner, drop the owner's own and receive booking
--     notifications with client names and phones;
--   * recalculate_ratings_for_date recalculates every staff/branch/business rating (DoS);
--   * get_api_metrics_stats, get_failed_api_requests and get_slow_api_requests return API
--     metrics including stored error messages;
--   * branch_admins_effective lists owner/admin user ids of any branch (20260307000000 meant
--     it to be service-only).
-- Every application caller uses the service role, and the auth.users trigger calls the
-- notification helpers from a SECURITY DEFINER function owned by postgres.
begin;

revoke all on function public.sync_user_notification_email(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.sync_user_notification_email(uuid, text, text, text) to service_role;

revoke all on function public.remove_user_notification_email_source(uuid, text) from public, anon, authenticated;
grant execute on function public.remove_user_notification_email_source(uuid, text) to service_role;

revoke all on function public.recalculate_ratings_for_date(date) from public, anon, authenticated;
grant execute on function public.recalculate_ratings_for_date(date) to service_role;

revoke all on function public.get_api_metrics_stats(text, integer, text) from public, anon, authenticated;
grant execute on function public.get_api_metrics_stats(text, integer, text) to service_role;

revoke all on function public.get_failed_api_requests(text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_failed_api_requests(text, integer, integer) to service_role;

revoke all on function public.get_slow_api_requests(text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_slow_api_requests(text, integer, integer) to service_role;

revoke all on function public.branch_admins_effective(uuid) from public, anon, authenticated;
grant execute on function public.branch_admins_effective(uuid) to service_role;

commit;
