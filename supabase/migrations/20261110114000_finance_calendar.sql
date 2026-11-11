-- Finance calendar is authoritative in the business timezone. No application/server TZ guesses.
begin;
create or replace function public.read_staff_finance_calendar(
    p_biz_id uuid,p_staff_id uuid,p_date date default null,p_instant timestamptz default null
) returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_tz text; v_date date; v_start timestamptz; v_end timestamptz;
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id);
    v_tz:=public.finance_business_timezone(p_biz_id);
    v_date:=coalesce(p_date,(coalesce(p_instant,statement_timestamp()) at time zone v_tz)::date);
    v_start:=v_date::timestamp at time zone v_tz;
    v_end:=(v_date+1)::timestamp at time zone v_tz;
    return jsonb_build_object('date',v_date,'todayDate',(statement_timestamp() at time zone v_tz)::date,
        'timezone',v_tz,'dayStart',v_start,'dayEnd',v_end,'dayHours',extract(epoch from v_end-v_start)/3600);
end;
$$;
revoke all on function public.read_staff_finance_calendar(uuid,uuid,date,timestamptz) from public,anon;
grant execute on function public.read_staff_finance_calendar(uuid,uuid,date,timestamptz) to authenticated,service_role;

create or replace function public.save_staff_shift_command(
    p_staff_id uuid,p_biz_id uuid,p_shift_date date,p_items jsonb,
    p_actor_id uuid default null,p_allow_create boolean default false,
    p_expected_revision bigint default null,p_expected_shift_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_shift public.staff_shifts%rowtype; v_result jsonb; v_items jsonb; v_today date; v_date date;
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id,p_actor_id);
    -- Use the same ordering as Save and Close. The staff lock also serializes
    -- competing creation attempts when there is no shift row to lock yet.
    perform 1 from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    v_today:=(statement_timestamp() at time zone public.finance_business_timezone(p_biz_id))::date;
    if p_expected_shift_id is not null then
        select shift_date into v_date from public.staff_shifts where id=p_expected_shift_id and staff_id=p_staff_id and biz_id=p_biz_id;
        if not found or (p_shift_date is not null and p_shift_date<>v_date) then
            raise exception using errcode='40001',message='SHIFT_DATE_MISMATCH';
        end if;
        p_shift_date:=v_date;
    else
        p_shift_date:=coalesce(p_shift_date,v_today);
    end if;
    select * into v_shift from public.staff_shifts
        where staff_id=p_staff_id and shift_date=p_shift_date for update;
    if found then
        if v_shift.biz_id is distinct from p_biz_id then
            raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
        end if;
        if v_shift.status<>'open' then raise exception using errcode='40001',message='SHIFT_CLOSED'; end if;
        if p_expected_shift_id is distinct from v_shift.id or
            p_expected_revision is distinct from v_shift.ledger_revision then
            raise exception using errcode='40001',message='SHIFT_STALE';
        end if;
    elsif p_expected_shift_id is not null or p_expected_revision is not null then
        raise exception using errcode='40001',message='SHIFT_STALE';
    end if;
    if p_shift_date>v_today or (v_shift.id is null and p_shift_date<>v_today) then
        raise exception using errcode='40001',message='SHIFT_DATE_REQUIRES_EXISTING_SHIFT';
    end if;
    v_result:=public.save_staff_shift_command_internal_v1(
        p_staff_id,p_biz_id,p_shift_date,p_items,p_actor_id,p_allow_create,p_expected_revision);
    -- The inner command still owns its locks. Return persisted IDs and effective
    -- promotion/package amounts from this transaction, never a later HTTP read.
    select coalesce(jsonb_agg(jsonb_build_object(
        'id',id,'clientName',coalesce(client_name,''),'serviceName',coalesce(service_name,''),
        'serviceAmount',service_amount,'consumablesAmount',consumables_amount,
        'bookingId',booking_id,'note',note,'createdAt',created_at
    ) order by created_at desc,id),'[]'::jsonb) into v_items
    from public.staff_shift_items where shift_id=(v_result->>'shift_id')::uuid;
    return v_result||jsonb_build_object('items',v_items);
end;
$$;

-- The private legacy implementation must not remain callable around the calendar rule.
revoke all on function public.open_staff_shift_safe_impl_20261109(uuid,uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon,authenticated,service_role;
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
        -- Reopen is a manager operation. It preserves the original attendance interval.
        if auth.role()<>'service_role' and not public.finance_can_manage_business(auth.uid(),p_biz_id) then
            raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
        end if;
        update public.staff_shifts set status='open',closed_at=null where id=v_existing.id returning * into v_existing;
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
-- Bound database work as well as HTTP waits. A client timeout is still an unknown outcome.
alter function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) set statement_timeout='10s';
alter function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) set lock_timeout='2s';
alter function public.close_staff_shift_command(uuid,uuid,bigint,jsonb,jsonb) set statement_timeout='10s';
alter function public.close_staff_shift_command(uuid,uuid,bigint,jsonb,jsonb) set lock_timeout='2s';
alter function public.release_staff_shift_claims(uuid,uuid[]) set statement_timeout='3s';
alter function public.release_staff_shift_claims(uuid,uuid[]) set lock_timeout='1s';
commit;
