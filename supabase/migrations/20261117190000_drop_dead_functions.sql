-- Functions that fail on every call (plpgsql_check, ENG-61) and have no callers in the
-- application or the database:
--   * apply_promotion_to_booking_impl_20261109 — the pre-guard original renamed in
--     20261109090100; apply_promotion_to_booking is a full replacement and does not call it;
--   * create_internal_booking with 7 arguments — inserts into the generated column time_range;
--     create_internal_booking_request uses the 9-argument overload;
--   * grant_role / revoke_role (both overloads) — ambiguous has_role('super_admin', null);
--     the admin UI uses grant_role_rpc;
--   * dev_become_superadmin — retired in 20261110132000 (no EXECUTE for any role), the only
--     caller of grant_role;
--   * purge_user — updates the non-existent public.invitations; account removal runs through
--     finalize_due_account_deletions.
begin;

drop function if exists public.apply_promotion_to_booking_impl_20261109(uuid);
drop function if exists public.create_internal_booking(uuid, uuid, uuid, uuid, timestamptz, integer, uuid);
drop function if exists public.dev_become_superadmin();
drop function if exists public.grant_role(uuid, uuid, text);
drop function if exists public.grant_role(uuid, text, uuid);
drop function if exists public.revoke_role(uuid, uuid, text);
drop function if exists public.revoke_role(uuid, text, uuid);
drop function if exists public.purge_user(uuid);

commit;
