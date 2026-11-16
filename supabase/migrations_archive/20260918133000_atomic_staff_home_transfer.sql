-- Home-branch membership and published work locations are distinct.
begin;
create function public.transfer_staff_home(p_staff uuid,p_biz uuid,p_actor uuid,p_expected_branch uuid,p_target uuid)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare st record; today date; tz text;
begin
    if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
    -- Same branch -> staff lock order as replacement of branch opening hours.
    perform 1 from public.branches where id=p_target and biz_id=p_biz and is_active for update;
    if not found then raise exception 'SCHEDULE_INVALID_BRANCH'; end if;
    select * into st from public.staff where id=p_staff and biz_id=p_biz for update;
    if not found or not st.is_active then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    if st.branch_id is distinct from p_expected_branch then raise exception 'SCHEDULE_STALE'; end if;
    if st.branch_id=p_target then raise exception 'SCHEDULE_SAME_BRANCH'; end if;
    select coalesce(b.tz,'Asia/Bishkek') into tz from public.businesses b where b.id=p_biz;
    today := (now() at time zone tz)::date;
    -- Never delete a separately planned future assignment to make today's transfer fit.
    if exists(select 1 from public.staff_branch_assignments where staff_id=p_staff and valid_from>today)
        then raise exception 'SCHEDULE_FUTURE_ASSIGNMENT'; end if;
    update public.staff_branch_assignments set valid_to=today-1
        where staff_id=p_staff and valid_from<today and (valid_to is null or valid_to>=today);
    delete from public.staff_branch_assignments where staff_id=p_staff and valid_from=today;
    insert into public.staff_branch_assignments(biz_id,staff_id,branch_id,valid_from)
        values(p_biz,p_staff,p_target,today);
    insert into public.staff_home_branch_changes(staff_id,biz_id,from_branch_id,to_branch_id,effective_on,created_by)
        values(p_staff,p_biz,st.branch_id,p_target,today,p_actor);
    update public.staff set branch_id=p_target where id=p_staff;
    -- Published plans keep their branch; legacy inherited hours may change location.
    -- A conflicting future reservation aborts membership, assignments and audit together.
    if exists(select 1 from public.bookings b where b.staff_id=p_staff and b.end_at>now()
        and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
        and not public.schedule_contains_booking(p_staff,b.branch_id,b.start_at,b.end_at))
        then raise exception 'SCHEDULE_BOOKING_CONFLICT'; end if;
    return jsonb_build_object('note','HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED');
end;
$$;
revoke all on function public.transfer_staff_home(uuid,uuid,uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.transfer_staff_home(uuid,uuid,uuid,uuid,uuid) to service_role;

-- Profile edits and stale browser tabs must use the same atomic transfer command.
create function public.guard_staff_home_change()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
    if new.branch_id is distinct from old.branch_id and not exists(
        select 1 from public.staff_home_branch_changes c where c.staff_id=old.id
        and c.from_branch_id is not distinct from old.branch_id and c.to_branch_id=new.branch_id
        and c.transaction_id=txid_current()) then raise exception 'SCHEDULE_USE_TRANSFER_COMMAND'; end if;
    return new;
end;
$$;
revoke all on function public.guard_staff_home_change() from public,anon,authenticated;
create trigger guard_staff_home_change before update of branch_id on public.staff
for each row execute function public.guard_staff_home_change();
commit;
