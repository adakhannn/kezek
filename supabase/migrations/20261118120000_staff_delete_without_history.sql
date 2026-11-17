-- Deleting a staff member destroyed business history and could stop half-way (17 Nov review,
-- docs/PROJECT_REVIEW_2026-11-17.md API-05). The route deleted the master's past bookings
-- (bookings.staff_id is RESTRICT), which cascaded to reviews, used package visits
-- (client_visit_package_uses) and the outbox, then working hours, service links, assignments,
-- rules and time off, one request at a time, and finally the staff row, which cascades to
-- shifts, shift aggregates and finance logs. staff_schedule_versions is NO ACTION, so for a
-- master on published schedules the last step failed after the history was already gone. It
-- also removed every non-client role of the user in the business, an owner who works as a
-- master included.
-- delete_staff_without_history() does the whole deletion in one transaction and only for a
-- master without history (bookings, shifts, published schedules, home branch changes, finance
-- operations); otherwise STAFF_HAS_HISTORY, and the manager dismisses the master instead,
-- which keeps the data. Only the staff role of the user is removed; a client role is kept.
begin;

create or replace function public.delete_staff_without_history(p_biz_id uuid, p_staff_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
    v_user_id uuid;
begin
    select s.user_id into v_user_id
      from public.staff s
     where s.id = p_staff_id and s.biz_id = p_biz_id
     for update;
    if not found then
        raise exception using errcode = 'P0002', message = 'STAFF_NOT_FOUND';
    end if;

    if exists (select 1 from public.bookings where staff_id = p_staff_id)
       or exists (select 1 from public.staff_shifts where staff_id = p_staff_id)
       or exists (select 1 from public.staff_schedule_versions where staff_id = p_staff_id)
       or exists (select 1 from public.staff_home_branch_changes where staff_id = p_staff_id)
       or exists (select 1 from public.staff_finance_operation_logs where staff_id = p_staff_id) then
        raise exception using errcode = 'P0001', message = 'STAFF_HAS_HISTORY';
    end if;

    -- staff_branch_assignments has no foreign key to staff; the other per-master rows
    -- (working hours, service links, schedule rules, time off, day metrics, finance settings
    -- audit) cascade with the staff row.
    delete from public.staff_branch_assignments where staff_id = p_staff_id and biz_id = p_biz_id;

    if v_user_id is not null then
        delete from public.user_roles ur
         using public.roles r
         where r.id = ur.role_id and r.key = 'staff' and ur.user_id = v_user_id and ur.biz_id = p_biz_id;
        begin
            insert into public.user_roles(user_id, biz_id, role_id)
            select v_user_id, p_biz_id, r.id from public.roles r where r.key = 'client'
            on conflict do nothing;
        exception when raise_exception then
            -- A suspended account, or one with a pending lifecycle command, takes no new roles;
            -- the staff card is removed all the same.
            if sqlerrm not in ('USER_SUSPENDED', 'USER_LIFECYCLE_ASSIGNMENT_BLOCKED') then
                raise;
            end if;
        end;
    end if;

    delete from public.staff where id = p_staff_id and biz_id = p_biz_id;
end;
$$;

revoke all on function public.delete_staff_without_history(uuid, uuid) from public, anon, authenticated;
grant execute on function public.delete_staff_without_history(uuid, uuid) to service_role;

commit;
