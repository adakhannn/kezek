-- Dead and broken database functions, and cleanup jobs missing from migrations (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-18, DB-15).
-- A reference scan on 2026-11-18 - application and script code, other function bodies, policies,
-- views, column defaults, CHECK constraints and triggers (pg_depend), pg_cron jobs and the
-- PostgREST pre-request hook - found these functions unused. Several were still callable by
-- client roles:
--   * has_role(uuid, text[]) (anon, authenticated; SECURITY DEFINER) failed on every call: it reads
--     user_roles.role, a column that does not exist (the app calls has_role(text, uuid));
--   * grant_user_role / revoke_user_role (anon, authenticated) - role management helpers the app
--     never calls (roles are managed by service-only commands since ENG-62);
--   * branches_sync_lat_lon_from_coords() - a trigger function no trigger uses;
--   * rule_branch_is_not_home(uuid, uuid) (anon, authenticated; SECURITY DEFINER).
-- The rest were already service-only leftovers of rewritten flows: the booking receipt view
-- (booking_receipt_public replaced it), the old notification claim (the outbox worker claims with
-- claim_booking_notification_batch), owner helpers, the old business delete entry point (DB-14
-- routes call delete_business_without_history), API metric readers and a frontend metric writer
-- nothing calls, the shift aggregates initializer and a superseded open-shift implementation.
-- cleanup_expired_whatsapp_otp_codes stays: a pg_cron job calls it - a job created by hand in
-- production and missing from migrations, so fresh databases never ran it; it is declared here.
-- cleanup_telegram_profile_links (deletes link attempts expired over a day ago) also stays: its
-- runbook (docs/TELEGRAM_PROFILE_LINK.md) asked for a daily run that was never scheduled.
begin;

drop function if exists public.has_role(uuid, text[]);
drop function if exists public.grant_user_role(uuid, uuid, text);
drop function if exists public.revoke_user_role(uuid, uuid, text);
drop function if exists public.branches_sync_lat_lon_from_coords();
drop function if exists public.rule_branch_is_not_home(uuid, uuid);
drop function if exists public.booking_view_public(uuid);
drop function if exists public.claim_booking_notifications(integer, integer);
drop function if exists public.clear_business_owner(uuid);
drop function if exists public.exec_grant_owner(uuid, uuid, uuid);
drop function if exists public.force_delete_business_and_downgrade_owner(uuid);
drop function if exists public.get_failed_api_requests(text, integer, integer);
drop function if exists public.get_slow_api_requests(text, integer, integer);
drop function if exists public.initialize_shift_aggregates(uuid, uuid);
drop function if exists public.log_frontend_metric(text, jsonb, timestamp with time zone, uuid, text, text, inet);
drop function if exists public.open_staff_shift_safe_impl_20261109(uuid, uuid, uuid, date, timestamp with time zone, timestamp with time zone, integer);

-- cron.schedule updates a job with the same name, so re-running is idempotent.
select cron.schedule('cleanup_expired_whatsapp_otp_codes_hourly', '0 * * * *', 'select public.cleanup_expired_whatsapp_otp_codes(1440);');
select cron.schedule('kezek_cleanup_telegram_profile_links', '17 3 * * *', 'select public.cleanup_telegram_profile_links();');

notify pgrst, 'reload schema';

commit;
