-- Deleting a branch, a business, a service or a promotion destroyed history (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md DB-14; ARCH-08). The pre-October foreign keys of bookings,
-- shifts, finance operation logs, promotion usage and referrals were ON DELETE CASCADE, and the
-- delete code relied on it: a super admin's business delete wiped bookings, reviews, shifts and
-- finance logs; both branch deletes removed the branch's bookings and shifts (and inactive
-- masters with theirs) after deleting cancelled bookings first; any manager could DELETE a
-- branch through PostgREST. Now:
--   * those 13 foreign keys are NO ACTION: a parent with history can no longer be deleted by any
--     path. NO ACTION (checked at the end of the statement) rather than RESTRICT, so deleting a
--     business without history still cascades its branches and staff in any order;
--   * delete_branch_without_history() and delete_business_without_history() delete in one
--     transaction and only without history (ENG-69's definition plus the branch's own records),
--     otherwise BRANCH_HAS_HISTORY / BRANCH_IN_USE / BUSINESS_HAS_HISTORY; the old
--     force_delete_business_and_downgrade_owner() now calls the safe one;
--   * client roles lose DELETE on branches and client_visit_packages (no screen uses it).
-- Account deletion keeps its SET NULL design (bookings stay, client_id is cleared).
begin;

set local lock_timeout = '5s';

alter table public.bookings
    drop constraint bookings_branch_id_fkey,
    add constraint bookings_branch_id_fkey foreign key (branch_id) references public.branches(id),
    drop constraint bookings_biz_id_fkey,
    add constraint bookings_biz_id_fkey foreign key (biz_id) references public.businesses(id);
alter table public.staff_shifts
    drop constraint staff_shifts_staff_id_fkey,
    add constraint staff_shifts_staff_id_fkey foreign key (staff_id) references public.staff(id),
    drop constraint staff_shifts_branch_id_fkey,
    add constraint staff_shifts_branch_id_fkey foreign key (branch_id) references public.branches(id),
    drop constraint staff_shifts_biz_id_fkey,
    add constraint staff_shifts_biz_id_fkey foreign key (biz_id) references public.businesses(id);
alter table public.staff_finance_operation_logs
    drop constraint staff_finance_operation_logs_staff_id_fkey,
    add constraint staff_finance_operation_logs_staff_id_fkey foreign key (staff_id) references public.staff(id),
    drop constraint staff_finance_operation_logs_biz_id_fkey,
    add constraint staff_finance_operation_logs_biz_id_fkey foreign key (biz_id) references public.businesses(id);
alter table public.client_promotion_usage
    drop constraint client_promotion_usage_promotion_id_fkey,
    add constraint client_promotion_usage_promotion_id_fkey foreign key (promotion_id) references public.branch_promotions(id),
    drop constraint client_promotion_usage_branch_id_fkey,
    add constraint client_promotion_usage_branch_id_fkey foreign key (branch_id) references public.branches(id),
    drop constraint client_promotion_usage_biz_id_fkey,
    add constraint client_promotion_usage_biz_id_fkey foreign key (biz_id) references public.businesses(id);
alter table public.client_referrals
    drop constraint client_referrals_branch_id_fkey,
    add constraint client_referrals_branch_id_fkey foreign key (branch_id) references public.branches(id),
    drop constraint client_referrals_biz_id_fkey,
    add constraint client_referrals_biz_id_fkey foreign key (biz_id) references public.businesses(id);
alter table public.staff
    drop constraint staff_branch_id_fkey,
    add constraint staff_branch_id_fkey foreign key (branch_id) references public.branches(id);

create or replace function public.delete_branch_without_history(p_biz_id uuid, p_branch_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_staff_id uuid;
begin
    perform 1 from public.branches where id = p_branch_id and biz_id = p_biz_id for update;
    if not found then
        raise exception using errcode = 'P0002', message = 'BRANCH_NOT_FOUND';
    end if;

    -- Still used: active masters or services, or a visit package plan sold for its services.
    if exists (select 1 from public.staff where branch_id = p_branch_id and is_active)
       or exists (select 1 from public.services where branch_id = p_branch_id and active)
       or exists (select 1 from public.visit_package_plans p join public.services s on s.id = p.service_id
                   where s.branch_id = p_branch_id) then
        raise exception using errcode = 'P0001', message = 'BRANCH_IN_USE';
    end if;

    -- History of the branch, or of an inactive master homed there (ENG-69's definition).
    if exists (select 1 from public.bookings where branch_id = p_branch_id)
       or exists (select 1 from public.bookings b join public.services s on s.id = b.service_id where s.branch_id = p_branch_id)
       or exists (select 1 from public.booking_services bs join public.services s on s.id = bs.service_id where s.branch_id = p_branch_id)
       or exists (select 1 from public.staff_shifts where branch_id = p_branch_id)
       or exists (select 1 from public.staff_schedule_versions where branch_id = p_branch_id)
       or exists (select 1 from public.staff_home_branch_changes where from_branch_id = p_branch_id or to_branch_id = p_branch_id)
       or exists (select 1 from public.client_promotion_usage where branch_id = p_branch_id)
       or exists (select 1 from public.client_referrals where branch_id = p_branch_id)
       or exists (select 1 from public.staff st
                   where st.branch_id = p_branch_id
                     and (exists (select 1 from public.bookings where staff_id = st.id)
                          or exists (select 1 from public.staff_shifts where staff_id = st.id)
                          or exists (select 1 from public.staff_schedule_versions where staff_id = st.id)
                          or exists (select 1 from public.staff_home_branch_changes where staff_id = st.id)
                          or exists (select 1 from public.staff_finance_operation_logs where staff_id = st.id))) then
        raise exception using errcode = 'P0001', message = 'BRANCH_HAS_HISTORY';
    end if;

    for v_staff_id in select id from public.staff where branch_id = p_branch_id loop
        perform public.delete_staff_without_history(p_biz_id, v_staff_id);
    end loop;
    delete from public.staff_schedule_rules where branch_id = p_branch_id;
    delete from public.staff_branch_assignments where branch_id = p_branch_id;
    delete from public.services where branch_id = p_branch_id;
    -- Working hours, branch admins, unused promotions and metrics cascade with the branch.
    delete from public.branches where id = p_branch_id and biz_id = p_biz_id;
end;
$$;

create or replace function public.delete_business_without_history(p_biz_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    perform 1 from public.businesses where id = p_biz_id for update;
    if not found then
        raise exception using errcode = 'P0002', message = 'BUSINESS_NOT_FOUND';
    end if;

    if exists (select 1 from public.bookings where biz_id = p_biz_id)
       or exists (select 1 from public.staff_shifts where biz_id = p_biz_id)
       or exists (select 1 from public.staff_finance_operation_logs where biz_id = p_biz_id)
       or exists (select 1 from public.staff_schedule_versions where biz_id = p_biz_id)
       or exists (select 1 from public.staff_home_branch_changes where biz_id = p_biz_id)
       or exists (select 1 from public.client_promotion_usage where biz_id = p_biz_id)
       or exists (select 1 from public.client_referrals where biz_id = p_biz_id)
       or exists (select 1 from public.client_visit_packages cvp join public.visit_package_plans p on p.id = cvp.plan_id
                   where p.biz_id = p_biz_id) then
        raise exception using errcode = 'P0001', message = 'BUSINESS_HAS_HISTORY';
    end if;

    -- Rows without a cascading path (no foreign key, or RESTRICT to a branch) go first.
    delete from public.staff_branch_assignments where biz_id = p_biz_id;
    delete from public.staff_schedule_rules where biz_id = p_biz_id;
    delete from public.user_roles where biz_id = p_biz_id;
    update public.businesses set owner_id = null where id = p_biz_id;
    delete from public.businesses where id = p_biz_id;
end;
$$;

-- The old entry point keeps working, but only for a business without history.
create or replace function public.force_delete_business_and_downgrade_owner(p_biz_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
    perform public.delete_business_without_history(p_biz_id);
end;
$$;

revoke all on function public.delete_branch_without_history(uuid, uuid), public.delete_business_without_history(uuid),
    public.force_delete_business_and_downgrade_owner(uuid) from public, anon, authenticated;
grant execute on function public.delete_branch_without_history(uuid, uuid), public.delete_business_without_history(uuid),
    public.force_delete_business_and_downgrade_owner(uuid) to service_role;

revoke delete on table public.branches, public.client_visit_packages from anon, authenticated;

commit;
