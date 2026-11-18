-- Inactive branches and staff are visible only to the people who need them (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-09, part 2).
--
-- "read branches of approved business" and "read staff of approved business" let anyone, anon
-- included, read every branch and staff card of an approved business, archived branches and
-- dismissed masters too; "Public can view active branches/staff" already shows the active ones.
-- The client's booking history (cabinet, booking page, mobile list) embeds the branch and the master
-- of each booking with the client's own session, so a client must keep seeing those rows after they
-- are deactivated; the owner (businesses.owner_id; not every owner has an owner row in user_roles) and
-- members of a business keep seeing all of its branches and staff.
--
-- Re-running changes nothing. The client rule reads bookings through SECURITY DEFINER helpers: a branches/staff policy that
-- queried bookings directly would recurse through the bookings policies, which read staff.

create or replace function private.viewer_booked_branch(p_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (select 1 from public.bookings b where b.branch_id = p_branch_id and b.client_id = auth.uid());
$$;

create or replace function private.viewer_booked_staff(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
    select exists (select 1 from public.bookings b where b.staff_id = p_staff_id and b.client_id = auth.uid());
$$;

-- New functions are closed by default (20261119030000); policies of authenticated sessions call these.
revoke all on function private.viewer_booked_branch(uuid) from public;
revoke all on function private.viewer_booked_staff(uuid) from public;
grant execute on function private.viewer_booked_branch(uuid) to authenticated;
grant execute on function private.viewer_booked_staff(uuid) to authenticated;

drop policy if exists "read branches of approved business" on public.branches;
drop policy if exists "Clients can view branches of own bookings" on public.branches;
create policy "Clients can view branches of own bookings" on public.branches
    for select to authenticated
    using (private.viewer_booked_branch(id));
drop policy if exists "Members can view branches of own business" on public.branches;
create policy "Members can view branches of own business" on public.branches
    for select to authenticated
    using (
        exists (select 1 from public.businesses b where b.id = branches.biz_id and b.owner_id = (select auth.uid()))
        or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.biz_id = branches.biz_id)
        or exists (select 1 from public.staff s where s.user_id = (select auth.uid()) and s.biz_id = branches.biz_id)
    );

drop policy if exists "read staff of approved business" on public.staff;
drop policy if exists "Clients can view staff of own bookings" on public.staff;
create policy "Clients can view staff of own bookings" on public.staff
    for select to authenticated
    using (private.viewer_booked_staff(id));
drop policy if exists "Members can view staff of own business" on public.staff;
create policy "Members can view staff of own business" on public.staff
    for select to authenticated
    using (
        exists (select 1 from public.businesses b where b.id = staff.biz_id and b.owner_id = (select auth.uid()))
        or exists (select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.biz_id = staff.biz_id)
    );
