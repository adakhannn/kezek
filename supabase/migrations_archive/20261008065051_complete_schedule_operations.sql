begin;

-- A reset is an append-only day version, not deletion of audit history.
create or replace function public.schedule_effective_day(p_staff uuid, p_day date)
returns jsonb language plpgsql stable security definer set search_path = public
as $$
declare
    st record; v record; legacy record; regular_day boolean := false; result jsonb; business_tz text;
begin
    select s.*, coalesce(b.tz,'Asia/Bishkek') as business_tz into st
    from public.staff s join public.businesses b on b.id=s.biz_id where s.id=p_staff;
    if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
    business_tz := st.business_tz;
    result := jsonb_build_object('date',p_day,'branch_id',st.branch_id,'tz',business_tz,
        'source','unconfigured','intervals','[]'::jsonb,'breaks','[]'::jsonb);
    if not st.is_active then return result; end if;
    if exists(select 1 from public.staff_time_off t where t.staff_id=p_staff and t.biz_id=st.biz_id
              and p_day between t.date_from and t.date_to) then
        return result || jsonb_build_object('source','absence');
    end if;
    select * into v from public.staff_schedule_versions where staff_id=p_staff
        and kind='day' and effective_from=p_day order by revision desc limit 1;
    regular_day := found and coalesce(v.days->'day'->>'use_regular','false')='true';
    if found and not regular_day then
        return public.schedule_bound_to_branch(result || (v.days->'day') || jsonb_build_object('branch_id',v.branch_id,'source','day'),st.biz_id,p_day);
    end if;
    -- Never silently overwrite legacy date/range exceptions when publishing a week.
    if not regular_day and exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active
        and ((r.kind='date' and r.date_on=p_day) or (r.kind='range' and p_day between r.date_from and r.date_to))) then
        select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
        if found then
            return result || to_jsonb(legacy) || jsonb_build_object('source','legacy');
        end if;
    end if;
    select * into v from public.staff_schedule_versions where staff_id=p_staff
        and kind='week' and effective_from<=p_day order by effective_from desc,revision desc limit 1;
    if found then
        return public.schedule_bound_to_branch(result || (v.days->extract(isodow from p_day)::int::text)
            || jsonb_build_object('branch_id',v.branch_id,'source','week'),st.biz_id,p_day);
    end if;
    select * into legacy from public.resolve_staff_day_legacy(p_staff,p_day);
    if found then
        -- working_hours historically inherits the home branch. Freeze that history
        -- across transfers, but never override a legacy rule's explicit branch.
        if not exists(select 1 from public.staff_schedule_rules r where r.staff_id=p_staff and r.is_active
            and r.kind='weekly' and r.day_of_week=extract(dow from p_day)::int)
            and exists(select 1 from public.staff_home_branch_changes c where c.staff_id=p_staff) then
            legacy.branch_id := coalesce(
                (select c.to_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff and c.effective_on<=p_day order by c.effective_on desc,c.id desc limit 1),
                (select c.from_branch_id from public.staff_home_branch_changes c where c.staff_id=p_staff order by c.effective_on,c.id limit 1));
        end if;
        return result || to_jsonb(legacy) || jsonb_build_object('source','legacy');
    end if;
    return result;
end;
$$;

create function public.reset_staff_schedule_day(p_staff uuid,p_biz uuid,p_actor uuid,p_expected_revision bigint,p_day date)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare target_branch uuid;
begin
 if not public.schedule_actor_can_manage(p_actor,p_biz) then raise exception 'SCHEDULE_FORBIDDEN'; end if;
 perform 1 from public.staff where id=p_staff and biz_id=p_biz and is_active for update;
 if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 select branch_id into target_branch from public.staff_schedule_versions
 where staff_id=p_staff and kind='week' and effective_from<=p_day
 order by effective_from desc,revision desc limit 1;
 if not found then raise exception 'SCHEDULE_WEEK_REQUIRED'; end if;
 return public.publish_staff_schedule(p_staff,p_biz,p_actor,p_expected_revision,'day',p_day,target_branch,
   '{"day":{"intervals":[],"breaks":[],"use_regular":true}}'::jsonb);
end $$;
revoke all on function public.reset_staff_schedule_day(uuid,uuid,uuid,bigint,date) from public,anon,authenticated;
grant execute on function public.reset_staff_schedule_day(uuid,uuid,uuid,bigint,date) to service_role;

-- Absence changes share the same staff lock as booking and publication.
create function public.guard_staff_absence_booking() returns trigger
language plpgsql security definer set search_path=public as $$
declare business_tz text;
begin
 if tg_op='UPDATE' and (new.staff_id<>old.staff_id or new.biz_id<>old.biz_id) then
   raise exception 'SCHEDULE_INVALID';
 end if;
 perform 1 from public.staff where id=new.staff_id and biz_id=new.biz_id for update;
 if not found then raise exception 'SCHEDULE_NOT_FOUND'; end if;
 if new.date_from is null or new.date_to is null or new.date_to<new.date_from then raise exception 'SCHEDULE_INVALID'; end if;
 select coalesce(tz,'Asia/Bishkek') into business_tz from public.businesses where id=new.biz_id;
 if exists(select 1 from public.bookings b where b.staff_id=new.staff_id and b.biz_id=new.biz_id
   and (b.status::text in ('confirmed','paid') or (b.status::text='hold' and b.expires_at>now()))
   and b.end_at>now() and b.start_at<((new.date_to+1)::timestamp at time zone business_tz)
   and b.end_at>(new.date_from::timestamp at time zone business_tz)) then
   raise exception 'SCHEDULE_BOOKING_CONFLICT';
 end if;
 return new;
end $$;
revoke all on function public.guard_staff_absence_booking() from public,anon,authenticated;
create trigger guard_staff_absence_booking before insert or update on public.staff_time_off
for each row execute function public.guard_staff_absence_booking();
commit;
