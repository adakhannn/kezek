-- Closed-shift hours are a versioned financial command, not a generic row update.
begin;
create or replace function public.finance_is_platform_admin(p_actor_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
    select p_actor_id is not null and (
        exists(select 1 from public.user_global_roles u join public.roles r on r.id=u.role_id
            where u.user_id=p_actor_id and r.scope='platform' and r.key='super_admin')
        or exists(select 1 from public.super_admins_legacy s where s.user_id=p_actor_id)
        -- Current admin issuance and user_roles_with_user view still use this legacy store.
        or exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id
            where u.user_id=p_actor_id and u.biz_id is null and r.key='super_admin')
    );
$$;
revoke all on function public.finance_is_platform_admin(uuid) from public,anon,authenticated,service_role;
create or replace function public.finance_can_manage_business(p_actor_id uuid,p_biz_id uuid)
returns boolean language sql stable security definer set search_path=pg_catalog,public as $$
    select p_actor_id is not null and (
        exists(select 1 from public.businesses b where b.id=p_biz_id and b.owner_id=p_actor_id)
        or exists(select 1 from public.user_roles u join public.roles r on r.id=u.role_id
            where u.user_id=p_actor_id and u.biz_id=p_biz_id and r.key in ('owner','admin','manager'))
        or public.finance_is_platform_admin(p_actor_id)
    );
$$;

create or replace function public.read_finance_report_snapshot(
    p_biz_id uuid,p_date_from date,p_date_to date,p_staff_id uuid default null,p_branch_id uuid default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_tz text;
begin
    if p_biz_id is null or p_date_from is null or p_date_to is null or p_date_to-p_date_from not between 0 and 365 then
        raise exception using errcode='22023',message='REPORT_SCOPE_OR_RANGE_INVALID';
    end if;
    if p_staff_id is not null and not exists(select 1 from public.staff where id=p_staff_id and biz_id=p_biz_id)
       or p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='REPORT_SCOPE_INVALID';
    end if;
    if exists(select 1 from public.staff_shifts sh left join public.staff st on st.id=sh.staff_id and st.biz_id=p_biz_id
        where sh.biz_id=p_biz_id and sh.shift_date between p_date_from and p_date_to
        and (p_staff_id is null or sh.staff_id=p_staff_id) and (p_branch_id is null or sh.branch_id=p_branch_id) and st.id is null) then
        raise exception using errcode='23514',message='REPORT_STAFF_REFERENCE_INVALID';
    end if;
    v_tz:=public.finance_business_timezone(p_biz_id);
    return (with selected_shifts as materialized (
    select s.* from public.staff_shifts s
    where s.biz_id=p_biz_id and s.shift_date between p_date_from and p_date_to
      and (p_staff_id is null or s.staff_id=p_staff_id)
      and (p_branch_id is null or s.branch_id=p_branch_id)
), selected_staff as materialized (
    select s.id,s.full_name,s.is_active,s.hourly_rate,s.percent_master,s.percent_salon,s.branch_id
    from public.staff s where s.biz_id=p_biz_id and (p_staff_id is null or s.id=p_staff_id)
      and (p_branch_id is null or s.branch_id=p_branch_id or exists(select 1 from selected_shifts sh where sh.staff_id=s.id))
), closed as (
    select staff_id,count(*) as closed_shifts,coalesce(sum(total_amount),0) as total_amount,
        coalesce(sum(master_share),0) as total_master,coalesce(sum(salon_share),0) as total_salon,
        coalesce(sum(consumables_amount),0) as total_consumables,coalesce(sum(late_minutes),0) as total_late_minutes
    from selected_shifts where status='closed' group by staff_id
), details as (
    select s.*,v_tz as timezone,
        s.shift_date::timestamp at time zone v_tz as day_start,
        (s.shift_date+1)::timestamp at time zone v_tz as day_end,
        extract(epoch from ((s.shift_date+1)::timestamp at time zone v_tz)-(s.shift_date::timestamp at time zone v_tz))/3600 as day_hours,
        jsonb_build_object('hourly_rate',st.hourly_rate,'percent_master',st.percent_master,'percent_salon',st.percent_salon) as staff,
        coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at,i.id) from public.staff_shift_items i where i.shift_id=s.id),'[]'::jsonb) as items
    from selected_shifts s join selected_staff st on st.id=s.staff_id
    where p_staff_id is not null or s.status='open'
)
select jsonb_build_object(
    'branches',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.name) order by b.name,b.id) from public.branches b where b.biz_id=p_biz_id),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(to_jsonb(st) order by st.full_name,st.id) from selected_staff st),'[]'::jsonb),
    'closedStats',coalesce((select jsonb_agg(to_jsonb(c) order by c.staff_id) from closed c),'[]'::jsonb),
    'shifts',coalesce((select jsonb_agg(to_jsonb(d) order by d.shift_date desc,d.id) from details d),'[]'::jsonb)
));
end;
$$;

-- Only an already-authorized server business scope can request a default reporting day.
create function public.read_business_finance_calendar(p_biz_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_tz text:=public.finance_business_timezone(p_biz_id);
begin
    return jsonb_build_object('todayDate',(statement_timestamp() at time zone v_tz)::date,'timezone',v_tz);
end;
$$;
revoke all on function public.read_business_finance_calendar(uuid) from public,anon,authenticated;
grant execute on function public.read_business_finance_calendar(uuid) to service_role;

create function public.read_staff_shift_adjustment_snapshot(p_shift_id uuid,p_biz_id uuid,p_actor_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_shift public.staff_shifts%rowtype; v_tz text;
    v_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
    if v_role not in ('service_role','postgres','supabase_admin') or p_actor_id is null
        or not public.finance_can_manage_business(p_actor_id,p_biz_id) then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    select * into v_shift from public.staff_shifts where id=p_shift_id and biz_id=p_biz_id;
    if not found then raise exception using errcode='P0002',message='SHIFT_NOT_FOUND'; end if;
    v_tz:=public.finance_business_timezone(p_biz_id);
    return jsonb_build_object('shift',to_jsonb(v_shift),'timezone',v_tz,'dayHours',
        extract(epoch from ((v_shift.shift_date+1)::timestamp at time zone v_tz)-(v_shift.shift_date::timestamp at time zone v_tz))/3600);
end;
$$;
revoke all on function public.read_staff_shift_adjustment_snapshot(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_staff_shift_adjustment_snapshot(uuid,uuid,uuid) to service_role;

create function public.adjust_closed_shift_hours_command(p_shift_id uuid,p_biz_id uuid,p_actor_id uuid,p_expected_revision bigint,p_hours_worked numeric,p_calculation jsonb)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare v_shift public.staff_shifts%rowtype; v_tz text; v_day_hours numeric; v_key text;
    v_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
begin
    if v_role not in ('service_role','postgres','supabase_admin') or p_actor_id is null
        or not public.finance_can_manage_business(p_actor_id,p_biz_id) then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform st.id from public.staff st join public.staff_shifts sh on sh.staff_id=st.id
        where sh.id=p_shift_id and sh.biz_id=p_biz_id and st.biz_id=p_biz_id for update of st;
    if not found then raise exception using errcode='P0002',message='SHIFT_NOT_FOUND'; end if;
    select * into v_shift from public.staff_shifts where id=p_shift_id and biz_id=p_biz_id for update;
    if v_shift.status<>'closed' or p_expected_revision is distinct from v_shift.ledger_revision then
        raise exception using errcode='40001',message='SHIFT_STALE_OR_REOPENED';
    end if;
    v_tz:=public.finance_business_timezone(p_biz_id);
    v_day_hours:=extract(epoch from ((v_shift.shift_date+1)::timestamp at time zone v_tz)-(v_shift.shift_date::timestamp at time zone v_tz))/3600;
    if p_hours_worked is null or p_hours_worked::text in ('NaN','Infinity','-Infinity') or p_hours_worked<0 or p_hours_worked>v_day_hours then
        raise exception using errcode='22023',message='SHIFT_HOURS_OUTSIDE_LOCAL_DAY';
    end if;
    if jsonb_typeof(p_calculation) is distinct from 'object' then raise exception using errcode='22023',message='SHIFT_CALCULATION_REQUIRED'; end if;
    foreach v_key in array array['totalAmount','totalConsumables','guaranteedAmount','topupAmount','finalMasterShare','finalSalonShare'] loop
        if jsonb_typeof(p_calculation->v_key) is distinct from 'number' or (p_calculation->>v_key)::numeric<0
            or (p_calculation->>v_key)::numeric::text in ('NaN','Infinity','-Infinity') then raise exception using errcode='22023',message='SHIFT_CALCULATION_INVALID'; end if;
    end loop;
    -- Trusted backend uses core-domain with the persisted inputs read at this revision.
    -- Every shift UPDATE and every ledger write bumps revision, so that input snapshot cannot silently change.
    if (p_calculation->>'totalAmount')::numeric is distinct from coalesce(v_shift.total_amount,0)
        or (p_calculation->>'totalConsumables')::numeric is distinct from coalesce(v_shift.consumables_amount,0) then
        raise exception using errcode='40001',message='SHIFT_CALCULATION_CHANGED';
    end if;
    update public.staff_shifts set hours_worked=p_hours_worked,
        guaranteed_amount=(p_calculation->>'guaranteedAmount')::numeric,topup_amount=(p_calculation->>'topupAmount')::numeric,
        master_share=(p_calculation->>'finalMasterShare')::numeric,salon_share=(p_calculation->>'finalSalonShare')::numeric
        where id=p_shift_id returning * into v_shift;
    perform public.update_shift_aggregates(v_shift.staff_id,v_shift.biz_id,v_shift.shift_date,0,0,0,0,0,0);
    return jsonb_build_object('ok',true,'shift',to_jsonb(v_shift));
end;
$$;
revoke all on function public.adjust_closed_shift_hours_command(uuid,uuid,uuid,bigint,numeric,jsonb) from public,anon,authenticated;
grant execute on function public.adjust_closed_shift_hours_command(uuid,uuid,uuid,bigint,numeric,jsonb) to service_role;
commit;
