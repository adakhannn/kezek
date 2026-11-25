-- R25-03: a reopened past shift was re-closed at that day's midnight, so hours and the hourly
-- guarantee grew to "midnight - opened_at" (09:00-17:00 became 15 h). The overdue-shift cron also
-- re-closed it within five minutes, while the manager was still correcting it.
--
-- Reopening a past day now remembers the original close time as the cap for the next close, and the
-- cron leaves a reopened shift alone for 12 hours. Reopening today's shift keeps the old behaviour:
-- work continues and the next close uses the current time.
--
-- staff_shifts stays closed to direct client writes (guard_direct_shift_finance_write), so the new
-- columns are written only by these SECURITY DEFINER commands.

alter table public.staff_shifts
    add column if not exists reopened_at timestamptz,
    add column if not exists reopen_close_cap timestamptz;

comment on column public.staff_shifts.reopened_at is
    'When a manager last reopened the closed shift; the overdue-shift cron waits 12 hours after it.';
comment on column public.staff_shifts.reopen_close_cap is
    'Original closed_at of a past-day shift that was reopened; the next close is not later than this.';

create or replace function public.open_staff_shift_safe(
    p_staff_id uuid,p_biz_id uuid,p_branch_id uuid,p_shift_date date,p_opened_at timestamptz,
    p_expected_start timestamptz default null,p_late_minutes integer default 0
) returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_existing public.staff_shifts%rowtype; v_today date; v_tz text;
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id);
    perform 1 from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    v_tz:=public.finance_business_timezone(p_biz_id);
    v_today:=(statement_timestamp() at time zone v_tz)::date;
    p_shift_date:=coalesce(p_shift_date,v_today);
    if p_shift_date>v_today then raise exception using errcode='40001',message='SHIFT_FUTURE_DATE'; end if;
    if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
    end if;
    select * into v_existing from public.staff_shifts where staff_id=p_staff_id and shift_date=p_shift_date for update;
    if found then
        if v_existing.biz_id is distinct from p_biz_id then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
        if v_existing.status='open' then return jsonb_build_object('ok',true,'action','already_open','shift',to_jsonb(v_existing)); end if;
        -- Reopen is a manager operation. A past day keeps its original attendance interval: the
        -- next close is capped at the earlier close time (R25-03).
        if auth.role()<>'service_role' and not public.finance_can_manage_business(auth.uid(),p_biz_id) then
            raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
        end if;
        update public.staff_shifts set status='open',
            reopen_close_cap=case when p_shift_date<v_today
                then coalesce(least(v_existing.closed_at,v_existing.reopen_close_cap),v_existing.closed_at,v_existing.reopen_close_cap)
                else null end,
            closed_at=null,
            reopened_at=statement_timestamp()
            where id=v_existing.id returning * into v_existing;
        perform public.update_shift_aggregates(p_staff_id,p_biz_id,p_shift_date,0,0,0,0,0,0);
        return jsonb_build_object('ok',true,'action','reopened','shift',to_jsonb(v_existing));
    end if;
    if p_shift_date<>v_today then raise exception using errcode='40001',message='SHIFT_DATE_REQUIRES_EXISTING_SHIFT'; end if;
    -- The caller supplies schedule/late data, but cannot invent a historical opening time.
    if p_opened_at is null or (p_opened_at at time zone v_tz)::date<>v_today then
        raise exception using errcode='40001',message='SHIFT_OPEN_TIME_MISMATCH';
    end if;
    insert into public.staff_shifts(staff_id,biz_id,branch_id,shift_date,status,opened_at,expected_start,late_minutes)
        values(p_staff_id,p_biz_id,p_branch_id,p_shift_date,'open',statement_timestamp(),p_expected_start,p_late_minutes)
        returning * into v_existing;
    return jsonb_build_object('ok',true,'action','created','shift',to_jsonb(v_existing));
end;
$$;

create or replace function public.read_staff_shift_close_snapshot(p_biz_id uuid,p_staff_id uuid,p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
    if p_biz_id is null or p_staff_id is null or p_shift_id is null then raise exception using errcode='22023',message='FINANCE_SCOPE_REQUIRED'; end if;
    select jsonb_build_object('shift',to_jsonb(sh),'staff',jsonb_build_object('percent_master',st.percent_master,'percent_salon',st.percent_salon,'hourly_rate',st.hourly_rate),
        'timezone',public.finance_business_timezone(sh.biz_id),'dayStart',sh.shift_date::timestamp at time zone public.finance_business_timezone(sh.biz_id),
        'dayHours',extract(epoch from (((sh.shift_date+1)::timestamp at time zone public.finance_business_timezone(sh.biz_id))-(sh.shift_date::timestamp at time zone public.finance_business_timezone(sh.biz_id))))/3600,
        -- The close is never later than the end of the shift day, nor than the original close of a
        -- reopened past day (R25-03).
        'closeBoundary',least((sh.shift_date+1)::timestamp at time zone public.finance_business_timezone(sh.biz_id),
            coalesce(sh.reopen_close_cap,(sh.shift_date+1)::timestamp at time zone public.finance_business_timezone(sh.biz_id))),
        'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.staff_shift_items i where i.shift_id=sh.id),'[]'::jsonb)) into v_result
    from public.staff_shifts sh join public.staff st on st.id=sh.staff_id and st.biz_id=sh.biz_id
    where sh.id=p_shift_id and sh.staff_id=p_staff_id and sh.biz_id=p_biz_id;
    if v_result is null then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    return v_result;
end;
$$;

create or replace function public.claim_overdue_staff_shifts(p_claim_token uuid,p_limit integer default 25,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_ids uuid[]; v_rows jsonb; v_more boolean; v_configuration_errors jsonb;
begin
    if p_claim_token is null or p_now is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='CLOSE_BATCH_INVALID'; end if;
    -- Old failures rotate behind never-attempted work; the lease prevents two
    -- schedulers claiming the same shift after the short row-lock transaction ends.
    -- A shift a manager reopened is left to them for 12 hours (R25-03).
    select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from (
        select sh.id from public.staff_shifts sh join public.businesses b on b.id=sh.biz_id
        join pg_catalog.pg_timezone_names tz on tz.name=coalesce(nullif(btrim(b.tz),''),'Asia/Bishkek')
        left join public.staff_shift_close_attempts a on a.shift_id=sh.id
        where sh.status='open' and sh.shift_date<(p_now at time zone tz.name)::date
            and (sh.reopened_at is null or sh.reopened_at<=p_now-interval '12 hours')
            and (a.shift_id is null or a.lease_until<=p_now)
        order by coalesce(a.attempted_at,'-infinity'::timestamptz),sh.shift_date,sh.id
        limit p_limit for update of sh skip locked
    ) selected;
    insert into public.staff_shift_close_attempts(shift_id,attempted_at,lease_until,claim_token)
        select unnest(v_ids),p_now,p_now+interval '5 minutes',p_claim_token
        on conflict(shift_id) do update set attempted_at=excluded.attempted_at,lease_until=excluded.lease_until,claim_token=excluded.claim_token;
    select coalesce(jsonb_agg(public.read_staff_shift_close_snapshot(sh.biz_id,sh.staff_id,sh.id) order by sh.shift_date,sh.id),'[]'::jsonb)
        into v_rows from public.staff_shifts sh where sh.id=any(v_ids);
    select exists(select 1 from public.staff_shifts sh join public.businesses b on b.id=sh.biz_id
        join pg_catalog.pg_timezone_names tz on tz.name=coalesce(nullif(btrim(b.tz),''),'Asia/Bishkek') where sh.status='open'
        and sh.shift_date<(p_now at time zone tz.name)::date
        and (sh.reopened_at is null or sh.reopened_at<=p_now-interval '12 hours')
        and not(sh.id=any(v_ids))) into v_more;
    select coalesce(jsonb_agg(message),'[]'::jsonb) into v_configuration_errors from (
        select distinct b.id::text||': invalid_business_timezone' as message from public.businesses b join public.staff_shifts sh on sh.biz_id=b.id
        where sh.status='open' and not exists(select 1 from pg_catalog.pg_timezone_names where name=coalesce(nullif(btrim(b.tz),''),'Asia/Bishkek')) limit 25
    ) invalid;
    v_more:=v_more or jsonb_array_length(v_configuration_errors)>0;
    return jsonb_build_object('rows',v_rows,'hasMore',v_more,'configurationErrors',v_configuration_errors);
end;
$$;

-- CREATE OR REPLACE resets the function's SET options; restore the bounds from 20261110114000.
alter function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) set statement_timeout='10s';
alter function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) set lock_timeout='2s';

-- Privileges are unchanged by CREATE OR REPLACE; restated for a reader of this file.
revoke all on function public.read_staff_shift_close_snapshot(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_staff_shift_close_snapshot(uuid,uuid,uuid) to service_role;
revoke all on function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) to service_role;
