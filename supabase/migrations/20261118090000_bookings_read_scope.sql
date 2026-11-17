-- Bookings were readable far more widely than the application reads them (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-06, DB-07):
--   * "Clients can view own bookings" and "Clients can view own booking_services" also matched
--     bookings.client_phone against the caller's profiles.phone. The profile phone is not verified
--     (it is set without an OTP), so anyone could read the bookings made with another person's
--     phone in every business: name, time, staff, service. The client cabinet (web and mobile)
--     reads only by client_id; guests see their booking through the receipt RPC.
--   * "read bookings by biz or client" gave any user_roles row of the business (any role key,
--     e.g. a staff or client row left after dismissal) every booking of the business, and
--     "read bookings by participants" gave the staff role every booking of the business, client
--     names and phones included. Staff screens (web and mobile) read only their own bookings,
--     which "Staff can view own bookings" allows to active staff.
--   * Since ENG-29 client roles have no INSERT, UPDATE or DELETE on bookings, so every write
--     policy was dead. They are dropped so that a later grant cannot bring them back (two let
--     any user_roles row of the business update or delete bookings, one matched by the
--     unverified phone, one allowed inserts with client_id NULL). The ALL policies of managers
--     and super admins only add the SELECT that "Business owners can view own bookings"
--     (owner/admin/manager, or is_super_admin(), which covers has_role('super_admin', null))
--     already gives; duplicates of bookings_select_client go as well.
-- Remaining for client roles: own bookings (client_id), active staff's own bookings, the
-- business's owners/admins/managers and super admins, and the restrictive lifecycle policy.
begin;

drop policy if exists "Clients can view own bookings" on public.bookings;
drop policy if exists "read bookings by biz or client" on public.bookings;
drop policy if exists "read bookings by participants" on public.bookings;
drop policy if exists "client reads own bookings" on public.bookings;
drop policy if exists "read my bookings" on public.bookings;

drop policy if exists "Clients can update own bookings" on public.bookings;
drop policy if exists "Clients can create own bookings" on public.bookings;
drop policy if exists "bookings_insert_client" on public.bookings;
drop policy if exists "client insert hold" on public.bookings;
drop policy if exists "Business owners can update own bookings" on public.bookings;
drop policy if exists "biz update" on public.bookings;
drop policy if exists "biz delete" on public.bookings;
drop policy if exists "bookings_srv_cascade_upd" on public.bookings;
drop policy if exists "srv_upd_bookings" on public.bookings;
drop policy if exists "manage bookings by role" on public.bookings;
drop policy if exists "Super admins can manage all bookings" on public.bookings;
drop policy if exists "super_all" on public.bookings;

drop policy if exists "Clients can view own booking_services" on public.booking_services;
create policy "Clients can view own booking_services" on public.booking_services
    for select to authenticated
    using (exists (select 1 from public.bookings b
                    where b.id = booking_services.booking_id
                      and b.client_id = (select auth.uid())));

commit;
