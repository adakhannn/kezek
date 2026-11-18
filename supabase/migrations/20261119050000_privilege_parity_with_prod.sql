-- Privileges of databases built from migrations match production (17 Nov review, DB-15 follow-up).
--
-- The prod baseline is a pg_dump, and pg_dump writes each object's grants relative to PostgreSQL's
-- built-in defaults. Replayed into a Supabase database, where the project's default privileges for
-- role postgres in schema public grant new tables, views and functions to anon and authenticated
-- (closed for later objects by 20261119030000_closed_default_privileges), the baseline therefore
-- left those grants in place even where production has none. A comparison on 19 November of every
-- function EXECUTE and every table, view and sequence privilege of anon and authenticated, production
-- against a database built from the migrations, found 25 functions (23 of them SECURITY DEFINER, for
-- example unlink_auth_identity, approve_staff_application, transition_telegram_web_login and
-- transfer_staff_home) and 16 tables and views more open in the rebuilt database, and nothing more open
-- in production. Production is unchanged by this migration; any database rebuilt from the
-- repository (local, CI, a restore or a move to another project) now gets production's privileges.

-- Functions production runs as service_role only.
revoke all on function public.approve_staff_application(uuid,uuid,uuid,boolean) from anon, authenticated;
revoke all on function public.cancel_business_role_application(uuid,uuid) from anon, authenticated;
revoke all on function public.check_explicit_schedule_booking() from anon, authenticated;
revoke all on function public.guard_legacy_staff_schedule_write() from anon, authenticated;
revoke all on function public.guard_staff_absence_booking() from anon, authenticated;
revoke all on function public.guard_staff_home_change() from anon, authenticated;
revoke all on function public.publish_staff_schedule(uuid,uuid,uuid,bigint,text,date,uuid,jsonb) from anon, authenticated;
revoke all on function public.read_staff_schedule(uuid,uuid,date,date) from anon, authenticated;
revoke all on function public.read_staff_schedule_draft(uuid,uuid,date,text) from anon, authenticated;
revoke all on function public.read_staff_work_locations(uuid,date,date) from anon, authenticated;
revoke all on function public.reject_application_with_policy(text,uuid,uuid,text,integer) from anon, authenticated;
revoke all on function public.release_application_submission_block(uuid,uuid,uuid) from anon, authenticated;
revoke all on function public.replace_branch_schedule(uuid,uuid,uuid,jsonb) from anon, authenticated;
revoke all on function public.reset_staff_schedule_day(uuid,uuid,uuid,bigint,date) from anon, authenticated;
revoke all on function public.resolve_staff_day(uuid,date) from anon, authenticated;
revoke all on function public.resolve_staff_day_legacy(uuid,date) from anon, authenticated;
revoke all on function public.schedule_actor_can_manage(uuid,uuid) from anon, authenticated;
revoke all on function public.schedule_bound_to_branch(jsonb,uuid,date) from anon, authenticated;
revoke all on function public.schedule_contains_booking(uuid,uuid,timestamp with time zone,timestamp with time zone) from anon, authenticated;
revoke all on function public.schedule_effective_day(uuid,date) from anon, authenticated;
revoke all on function public.schedule_validate_day(jsonb) from anon, authenticated;
revoke all on function public.transfer_staff_home(uuid,uuid,uuid,uuid,uuid) from anon, authenticated;
revoke all on function public.transition_telegram_profile_link(text,text,uuid,bigint,text,text) from anon, authenticated;
revoke all on function public.transition_telegram_web_login(text,text,text,bigint,text) from anon, authenticated;
revoke all on function public.unlink_auth_identity(uuid,text) from anon, authenticated;

-- Tables and views: production grants these roles nothing more than what remains.
revoke all on table public.account_deletion_requests from anon;
revoke all on table public.account_deletion_requests from authenticated;
revoke all on table public.application_moderation_actions from anon;
revoke all on table public.application_moderation_actions from authenticated;
revoke all on table public.application_submission_blocks from anon;
revoke all on table public.application_submission_blocks from authenticated;
revoke all on table public.business_creation_audit_log from anon;
revoke all on table public.business_creation_audit_log from authenticated;
revoke all on table public.business_registration_applications from anon;
revoke all on table public.business_registration_applications from authenticated;
revoke all on table public.business_role_applications from anon;
revoke all on table public.business_role_applications from authenticated;
revoke all on table public.staff_home_branch_changes from anon;
revoke all on table public.staff_home_branch_changes from authenticated;
revoke all on table public.staff_schedule_versions from anon;
revoke all on table public.staff_schedule_versions from authenticated;
revoke delete, insert, update on table public.staff_time_off from anon;
revoke delete, insert, update on table public.staff_time_off from authenticated;
revoke all on table public.telegram_profile_link_attempts from anon;
revoke all on table public.telegram_profile_link_attempts from authenticated;
revoke all on table public.telegram_web_login_attempts from anon;
revoke all on table public.telegram_web_login_attempts from authenticated;
revoke all on table public.auth_users_view from anon;
revoke all on table public.current_staff_branch from anon;
revoke all on table public.current_user_roles from anon;
revoke all on table public.user_roles_legacy from anon;
revoke all on table public.user_roles_with_user from anon;
