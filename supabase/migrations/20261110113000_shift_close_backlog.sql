-- Complete ledger reads and fair, bounded automatic closure. No financial operation is
-- performed merely by claiming work; manual Save/Close keep their revision fences.
begin;
create function public.finance_business_timezone(p_biz_id uuid) returns text
language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_tz text;
begin
    select coalesce(nullif(btrim(tz),''),'Asia/Bishkek') into v_tz from public.businesses where id=p_biz_id;
    if v_tz is null then raise exception using errcode='42501',message='FINANCE_BUSINESS_NOT_FOUND'; end if;
    perform now() at time zone v_tz; -- Invalid configured timezone fails, never silently changes a financial day.
    return v_tz;
end;
$$;
revoke all on function public.finance_business_timezone(uuid) from public,anon,authenticated;
grant execute on function public.finance_business_timezone(uuid) to service_role;

-- Replace the fixed 24-hour cap with the actual local calendar-day duration.
-- Existing finite nonnegative data remains checked; future writes additionally
-- enforce the date-specific maximum through a trusted trigger.
alter table public.staff_shifts drop constraint if exists staff_shifts_hours_worked_range;
alter table public.staff_shifts add constraint staff_shifts_hours_worked_range check(hours_worked is null or (hours_worked>=0 and hours_worked<'Infinity'::numeric));
create function public.guard_shift_day_hours() returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_tz text; v_hours numeric;
begin
    if new.hours_worked is not null then
        v_tz:=public.finance_business_timezone(new.biz_id);
        v_hours:=extract(epoch from (((new.shift_date+1)::timestamp at time zone v_tz)-(new.shift_date::timestamp at time zone v_tz)))/3600;
        if new.hours_worked<0 or new.hours_worked>v_hours or new.hours_worked::text in ('NaN','Infinity','-Infinity') then
            raise exception using errcode='23514',message='SHIFT_HOURS_OUTSIDE_LOCAL_DAY';
        end if;
    end if;
    return new;
end;
$$;
create trigger staff_shifts_guard_day_hours before insert or update of hours_worked,shift_date,biz_id on public.staff_shifts
for each row execute function public.guard_shift_day_hours();

create or replace function public.lock_shift_for_item_write()
returns trigger language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_shift_id uuid; v_shift record; v_booking record;
begin
    if tg_op='UPDATE' and new.shift_id is distinct from old.shift_id then
        raise exception using errcode='42501',message='SHIFT_ITEM_SCOPE';
    end if;
    v_shift_id:=case when tg_op='DELETE' then old.shift_id else new.shift_id end;
    select * into v_shift from public.staff_shifts where id=v_shift_id for update;
    if found then
        perform public.assert_finance_access(v_shift.biz_id,v_shift.staff_id);
        if v_shift.status<>'open' then raise exception using errcode='40001',message='SHIFT_CLOSED'; end if;
        if tg_op<>'DELETE' and new.booking_id is not null then
            select * into v_booking from public.bookings where id=new.booking_id for update;
            if not found or v_booking.biz_id is distinct from v_shift.biz_id or v_booking.staff_id is distinct from v_shift.staff_id
                or (v_booking.start_at at time zone public.finance_business_timezone(v_shift.biz_id))::date is distinct from v_shift.shift_date then
                raise exception using errcode='42501',message='SHIFT_BOOKING_SCOPE';
            end if;
            if v_booking.status='cancelled' then raise exception using errcode='22023',message='SHIFT_BOOKING_CANCELLED'; end if;
        end if;
        -- Every writer, including legacy SQL and direct table writes, participates in the fence.
        update public.staff_shifts set ledger_revision=ledger_revision where id=v_shift_id;
    end if;
    if tg_op='DELETE' then return old; end if;
    return new;
end;
$$;

create or replace function public.save_staff_shift_command_internal_v1(
    p_staff_id uuid,p_biz_id uuid,p_shift_date date,p_items jsonb,
    p_actor_id uuid default null,p_allow_create boolean default false,p_expected_revision bigint default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare
    v_actor uuid; v_staff record; v_shift public.staff_shifts%rowtype;
    v_item jsonb; v_items jsonb:='[]'; v_id uuid; v_booking_id uuid; v_booking record;
    v_amount numeric; v_consumables numeric; v_total numeric; v_total_consumables numeric;
    v_pm numeric; v_ps numeric; v_sum numeric; v_master numeric; v_name text; v_service text;
    v_ids uuid[]:='{}'; v_booking_ids uuid[]:='{}'; v_position integer:=0; v_existing_count integer; v_written integer;
begin
    v_actor:=case when auth.role()='service_role' then p_actor_id else auth.uid() end;
    if v_actor is null then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform public.assert_finance_access(p_biz_id,p_staff_id,p_actor_id);
    if p_shift_date is null or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items)>1000 then
        raise exception using errcode='22023',message='SHIFT_ITEMS_INVALID';
    end if;
    -- The same lock order is used by close: staff, shift, sorted bookings, package.
    select * into v_staff from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    select * into v_shift from public.staff_shifts where staff_id=p_staff_id and shift_date=p_shift_date for update;
    if not found then
        if not p_allow_create or not public.finance_can_manage_business(v_actor,p_biz_id) then
            raise exception using errcode='22023',message='SHIFT_NOT_OPEN';
        end if;
        insert into public.staff_shifts(staff_id,biz_id,branch_id,shift_date,status,opened_at)
        values(p_staff_id,p_biz_id,v_staff.branch_id,p_shift_date,'open',now())
        on conflict(staff_id,shift_date) do nothing;
        select * into v_shift from public.staff_shifts where staff_id=p_staff_id and shift_date=p_shift_date for update;
    end if;
    if v_shift.biz_id is distinct from p_biz_id then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    if v_shift.status<>'open' then raise exception using errcode='40001',message='SHIFT_CLOSED'; end if;
    if p_expected_revision is not null and v_shift.ledger_revision<>p_expected_revision then
        raise exception using errcode='40001',message='SHIFT_STALE';
    end if;

    -- Validate all supplied identities and amounts before any booking/ledger mutation.
    for v_item in select value from jsonb_array_elements(p_items) loop
        if jsonb_typeof(v_item)<>'object' then raise exception using errcode='22023',message='SHIFT_ITEMS_INVALID'; end if;
        v_id:=coalesce(nullif(v_item->>'id','')::uuid,nullif(v_item->>'clientId','')::uuid,gen_random_uuid());
        if v_id=any(v_ids) then raise exception using errcode='22023',message='SHIFT_ITEM_DUPLICATE'; end if;
        v_ids:=array_append(v_ids,v_id);
        if exists(select 1 from public.staff_shift_items where id=v_id and shift_id<>v_shift.id)
            or (nullif(v_item->>'id','') is not null and not exists(select 1 from public.staff_shift_items where id=v_id and shift_id=v_shift.id)) then
            raise exception using errcode='42501',message='SHIFT_ITEM_SCOPE';
        end if;
        v_booking_id:=nullif(v_item->>'bookingId','')::uuid;
        if v_booking_id is not null then
            if v_booking_id=any(v_booking_ids) then raise exception using errcode='22023',message='SHIFT_BOOKING_DUPLICATE'; end if;
            v_booking_ids:=array_append(v_booking_ids,v_booking_id);
        end if;
        v_amount:=coalesce((v_item->>'serviceAmount')::numeric,0);
        v_consumables:=coalesce((v_item->>'consumablesAmount')::numeric,0);
        v_name:=nullif(btrim(v_item->>'clientName'),''); v_service:=nullif(btrim(v_item->>'serviceName'),'');
        if v_amount::text in ('NaN','Infinity','-Infinity') or v_consumables::text in ('NaN','Infinity','-Infinity')
            or v_amount<0 or v_consumables<0 or v_amount>100000000 or v_consumables>100000000
            or length(v_name)>200 or length(v_service)>200 then raise exception using errcode='22023',message='SHIFT_ITEMS_INVALID'; end if;
        if v_amount>0 or v_consumables>0 or v_booking_id is not null or v_name is not null
            or exists(select 1 from public.staff_shift_items where id=v_id and shift_id=v_shift.id) then
            v_items:=v_items||jsonb_build_array(jsonb_build_object('id',v_id,'booking_id',v_booking_id,
                'client_name',v_name,'service_name',v_service,'service_amount',v_amount,'consumables_amount',v_consumables,
                'created_at',now()+v_position*interval '1 millisecond'));
        end if;
        v_position:=v_position+1;
    end loop;
    for v_booking_id in select unnest(v_booking_ids) order by 1 loop
        select * into v_booking from public.bookings where id=v_booking_id for update;
        if not found or v_booking.biz_id is distinct from p_biz_id or v_booking.staff_id is distinct from p_staff_id
            or (v_booking.start_at at time zone public.finance_business_timezone(p_biz_id))::date is distinct from p_shift_date then
            raise exception using errcode='42501',message='SHIFT_BOOKING_SCOPE';
        end if;
        if v_booking.status='cancelled' then raise exception using errcode='22023',message='SHIFT_BOOKING_CANCELLED'; end if;
    end loop;
    select count(*) into v_existing_count from public.staff_shift_items where shift_id=v_shift.id;
    if v_existing_count>10 and jsonb_array_length(v_items)=0 then
        raise exception using errcode='22023',message='SHIFT_CLEAR_REQUIRES_REVIEW';
    end if;
    for v_booking_id in select unnest(v_booking_ids) order by 1 loop
        if exists(select 1 from public.bookings where id=v_booking_id and status not in ('paid','no_show') and start_at<=now()) then
            perform public.update_booking_status_with_promotion(v_booking_id,'paid');
        end if;
    end loop;

    delete from public.staff_shift_items s where s.shift_id=v_shift.id
        and not exists(select 1 from jsonb_array_elements(v_items) i where (i->>'id')::uuid=s.id);
    insert into public.staff_shift_items(id,shift_id,client_name,service_name,service_amount,consumables_amount,booking_id,created_at)
    select i.id,v_shift.id,i.client_name,i.service_name,
        coalesce((coalesce(b.subscription_applied,b.promotion_applied)->>'final_amount')::numeric,i.service_amount),
        i.consumables_amount,i.booking_id,i.created_at
    from jsonb_to_recordset(v_items) as i(id uuid,client_name text,service_name text,service_amount numeric,consumables_amount numeric,booking_id uuid,created_at timestamptz)
    left join public.bookings b on b.id=i.booking_id
    on conflict(id) do update set client_name=excluded.client_name,service_name=excluded.service_name,
        service_amount=excluded.service_amount,consumables_amount=excluded.consumables_amount,booking_id=excluded.booking_id
    where public.staff_shift_items.shift_id=v_shift.id;
    get diagnostics v_written=row_count;
    if v_written<>jsonb_array_length(v_items) then raise exception using errcode='42501',message='SHIFT_ITEM_SCOPE'; end if;

    select coalesce(sum(service_amount),0),coalesce(sum(consumables_amount),0) into v_total,v_total_consumables
        from public.staff_shift_items where shift_id=v_shift.id;
    v_pm:=coalesce(v_staff.percent_master,60); v_ps:=coalesce(v_staff.percent_salon,40);
    if v_pm<0 or v_pm::text in ('NaN','Infinity','-Infinity') then v_pm:=60; end if;
    if v_ps<0 or v_ps::text in ('NaN','Infinity','-Infinity') then v_ps:=40; end if;
    v_sum:=case when v_pm+v_ps=0 then 100 else v_pm+v_ps end;
    v_master:=round(v_total*v_pm/v_sum);
    update public.staff_shifts set total_amount=v_total,consumables_amount=v_total_consumables,
        percent_master=v_pm*100/v_sum,percent_salon=v_ps*100/v_sum,
        master_share=v_master,salon_share=v_total-v_master+v_total_consumables
        where id=v_shift.id returning * into v_shift;
    return jsonb_build_object('ok',true,'shift_id',v_shift.id,'revision',v_shift.ledger_revision);
end;
$$;
-- Renaming the private implementation must never restore public execute.
revoke all on function public.save_staff_shift_command_internal_v1(uuid,uuid,date,jsonb,uuid,boolean,bigint) from public,anon,authenticated,service_role;

create or replace function public.close_staff_shift_command(
    p_shift_id uuid,p_actor_id uuid,p_expected_revision bigint,p_expected_settings jsonb,p_calculation jsonb
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_shift public.staff_shifts%rowtype; v_staff record; v_booking record; v_result jsonb; v_total numeric; v_consumables numeric;
begin
    -- Only the trusted backend may submit a result computed by core-domain.
    if auth.role() is distinct from 'service_role' then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    select s.* into v_staff from public.staff s join public.staff_shifts sh on sh.staff_id=s.id where sh.id=p_shift_id for update of s;
    select * into v_shift from public.staff_shifts where id=p_shift_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    perform public.assert_finance_access(v_shift.biz_id,v_shift.staff_id,p_actor_id);
    if v_shift.status='closed' then return jsonb_build_object('ok',true,'action','already_closed','shift',to_jsonb(v_shift)); end if;
    if v_shift.status<>'open' then raise exception using errcode='40001',message='SHIFT_CLOSED'; end if;
    if p_expected_revision is null or v_shift.ledger_revision<>p_expected_revision then
        raise exception using errcode='40001',message='SHIFT_STALE';
    end if;
    if jsonb_build_object('percent_master',v_staff.percent_master,'percent_salon',v_staff.percent_salon,'hourly_rate',v_staff.hourly_rate)
        is distinct from p_expected_settings then raise exception using errcode='40001',message='SHIFT_SETTINGS_CHANGED'; end if;
    if jsonb_typeof(p_calculation) is distinct from 'object' then raise exception using errcode='22023',message='SHIFT_CALCULATION_INVALID'; end if;
    if (p_calculation->>'closedAt')::timestamptz < (v_shift.shift_date::timestamp at time zone public.finance_business_timezone(v_shift.biz_id))
        or (p_calculation->>'closedAt')::timestamptz > ((v_shift.shift_date+1)::timestamp at time zone public.finance_business_timezone(v_shift.biz_id))
        or (v_shift.opened_at is not null and (v_shift.opened_at < (v_shift.shift_date::timestamp at time zone public.finance_business_timezone(v_shift.biz_id))
            or v_shift.opened_at > (p_calculation->>'closedAt')::timestamptz)) then
        raise exception using errcode='22023',message='SHIFT_TIME_OUTSIDE_LOCAL_DAY';
    end if;
    if exists(select 1 from public.staff_shift_items where shift_id=p_shift_id) then
        select sum(service_amount),sum(consumables_amount) into v_total,v_consumables from public.staff_shift_items where shift_id=p_shift_id;
        if v_total is distinct from (p_calculation->>'totalAmount')::numeric or v_consumables is distinct from (p_calculation->>'totalConsumables')::numeric then
            raise exception using errcode='40001',message='SHIFT_STALE';
        end if;
    end if;
    -- Validate every persisted relationship under the same transaction before finalizing.
    if exists(select 1 from public.staff_shift_items i left join public.bookings b on b.id=i.booking_id
        where i.shift_id=p_shift_id and i.booking_id is not null and (b.id is null or b.biz_id<>v_shift.biz_id
            or b.staff_id<>v_shift.staff_id or (b.start_at at time zone public.finance_business_timezone(v_shift.biz_id))::date<>v_shift.shift_date)) then
        raise exception using errcode='42501',message='SHIFT_BOOKING_SCOPE';
    end if;
    for v_booking in select b.* from public.bookings b where (b.biz_id=v_shift.biz_id and b.staff_id=v_shift.staff_id
        and (b.start_at at time zone public.finance_business_timezone(v_shift.biz_id))::date=v_shift.shift_date)
        or exists(select 1 from public.staff_shift_items i where i.shift_id=p_shift_id and i.booking_id=b.id)
        order by b.id for update loop
        if p_actor_id is null and v_booking.status in ('paid','confirmed')
            and not exists(select 1 from public.staff_shift_items where shift_id=p_shift_id) then
            raise exception using errcode='40001',message='SHIFT_NEEDS_REVIEW';
        end if;
        if exists(select 1 from public.staff_shift_items where shift_id=p_shift_id and booking_id=v_booking.id) then
            if v_booking.status='cancelled' then raise exception using errcode='22023',message='SHIFT_BOOKING_CANCELLED'; end if;
            if v_booking.biz_id is distinct from v_shift.biz_id or v_booking.staff_id is distinct from v_shift.staff_id
                or (v_booking.start_at at time zone public.finance_business_timezone(v_shift.biz_id))::date is distinct from v_shift.shift_date then
                raise exception using errcode='42501',message='SHIFT_BOOKING_SCOPE';
            end if;
            if v_booking.status not in ('paid','no_show') then perform public.update_booking_status_with_promotion(v_booking.id,'paid'); end if;
        elsif v_booking.status='hold' then
            perform public.update_booking_status_no_check(v_booking.id,'no_show');
        end if;
    end loop;
    if exists(select 1 from public.staff_shift_items i join public.bookings b on b.id=i.booking_id where i.shift_id=p_shift_id
        and coalesce(b.subscription_applied,b.promotion_applied)->>'final_amount' is not null
        and i.service_amount is distinct from (coalesce(b.subscription_applied,b.promotion_applied)->>'final_amount')::numeric) then
        raise exception using errcode='40001',message='SHIFT_PRICING_CHANGED';
    end if;
    v_result:=public.close_staff_shift_safe(p_shift_id,
        (p_calculation->>'totalAmount')::numeric,(p_calculation->>'totalConsumables')::numeric,
        (p_calculation->>'normalizedPercentMaster')::numeric,(p_calculation->>'normalizedPercentSalon')::numeric,
        (p_calculation->>'finalMasterShare')::numeric,(p_calculation->>'finalSalonShare')::numeric,
        (p_calculation->>'hoursWorked')::numeric,(p_calculation->>'hourlyRate')::numeric,
        (p_calculation->>'guaranteedAmount')::numeric,(p_calculation->>'topupAmount')::numeric,
        (p_calculation->>'closedAt')::timestamptz);
    -- The legacy function catches SQL exceptions. Re-raise so earlier attendance/package writes roll back too.
    if v_result->>'ok' is distinct from 'true' then raise exception using errcode='P0001',message='SHIFT_CLOSE_FAILED'; end if;
    return v_result;
end;
$$;

create function public.read_staff_shift_close_snapshot(p_biz_id uuid,p_staff_id uuid,p_shift_id uuid)
returns jsonb language plpgsql stable security definer set search_path=pg_catalog,public as $$
declare v_result jsonb;
begin
    if p_biz_id is null or p_staff_id is null or p_shift_id is null then raise exception using errcode='22023',message='FINANCE_SCOPE_REQUIRED'; end if;
    select jsonb_build_object('shift',to_jsonb(sh),'staff',jsonb_build_object('percent_master',st.percent_master,'percent_salon',st.percent_salon,'hourly_rate',st.hourly_rate),
        'timezone',public.finance_business_timezone(sh.biz_id),'dayStart',sh.shift_date::timestamp at time zone public.finance_business_timezone(sh.biz_id),
        'dayHours',extract(epoch from (((sh.shift_date+1)::timestamp at time zone public.finance_business_timezone(sh.biz_id))-(sh.shift_date::timestamp at time zone public.finance_business_timezone(sh.biz_id))))/3600,'closeBoundary',(sh.shift_date+1)::timestamp at time zone public.finance_business_timezone(sh.biz_id),
        'items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.staff_shift_items i where i.shift_id=sh.id),'[]'::jsonb)) into v_result
    from public.staff_shifts sh join public.staff st on st.id=sh.staff_id and st.biz_id=sh.biz_id
    where sh.id=p_shift_id and sh.staff_id=p_staff_id and sh.biz_id=p_biz_id;
    if v_result is null then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    return v_result;
end;
$$;
revoke all on function public.read_staff_shift_close_snapshot(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.read_staff_shift_close_snapshot(uuid,uuid,uuid) to service_role;

create table public.staff_shift_close_attempts (
    shift_id uuid primary key references public.staff_shifts(id) on delete cascade,
    attempted_at timestamptz not null,
    lease_until timestamptz not null,
    claim_token uuid not null
);
alter table public.staff_shift_close_attempts enable row level security;
revoke all on public.staff_shift_close_attempts from public,anon,authenticated;
create index staff_shift_close_attempts_lease on public.staff_shift_close_attempts(lease_until,attempted_at);

create function public.claim_overdue_staff_shifts(p_claim_token uuid,p_limit integer default 25,p_now timestamptz default now())
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_ids uuid[]; v_rows jsonb; v_more boolean; v_configuration_errors jsonb;
begin
    if p_claim_token is null or p_now is null or p_limit not between 1 and 100 then raise exception using errcode='22023',message='CLOSE_BATCH_INVALID'; end if;
    -- Old failures rotate behind never-attempted work; the lease prevents two
    -- schedulers claiming the same shift after the short row-lock transaction ends.
    select coalesce(array_agg(id),'{}'::uuid[]) into v_ids from (
        select sh.id from public.staff_shifts sh join public.businesses b on b.id=sh.biz_id
        join pg_catalog.pg_timezone_names tz on tz.name=coalesce(nullif(btrim(b.tz),''),'Asia/Bishkek')
        left join public.staff_shift_close_attempts a on a.shift_id=sh.id
        where sh.status='open' and sh.shift_date<(p_now at time zone tz.name)::date
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
        and sh.shift_date<(p_now at time zone tz.name)::date and not(sh.id=any(v_ids))) into v_more;
    select coalesce(jsonb_agg(message),'[]'::jsonb) into v_configuration_errors from (
        select distinct b.id::text||': invalid_business_timezone' as message from public.businesses b join public.staff_shifts sh on sh.biz_id=b.id
        where sh.status='open' and not exists(select 1 from pg_catalog.pg_timezone_names where name=coalesce(nullif(btrim(b.tz),''),'Asia/Bishkek')) limit 25
    ) invalid;
    v_more:=v_more or jsonb_array_length(v_configuration_errors)>0;
    return jsonb_build_object('rows',v_rows,'hasMore',v_more,'configurationErrors',v_configuration_errors);
end;
$$;
revoke all on function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.claim_overdue_staff_shifts(uuid,integer,timestamptz) to service_role;

create function public.release_staff_shift_claims(p_claim_token uuid,p_shift_ids uuid[])
returns void language sql security definer set search_path=pg_catalog,public as $$
    update public.staff_shift_close_attempts set lease_until=now() where claim_token=p_claim_token and shift_id=any(p_shift_ids);
$$;
revoke all on function public.release_staff_shift_claims(uuid,uuid[]) from public,anon,authenticated;
grant execute on function public.release_staff_shift_claims(uuid,uuid[]) to service_role;
-- Finance editor read: revision and the entire ledger come from one SQL snapshot.
-- INVOKER retains authenticated table RLS; a non-visible shift returns null.
create function public.read_staff_shift_snapshot(p_biz_id uuid,p_staff_id uuid,p_shift_date date)
returns jsonb language plpgsql stable security invoker set search_path=pg_catalog,public as $$
begin
    if p_biz_id is null or p_staff_id is null or p_shift_date is null then raise exception using errcode='22023',message='FINANCE_SCOPE_REQUIRED'; end if;
    return (select to_jsonb(sh)||jsonb_build_object('staff_shift_items',coalesce((select jsonb_agg(to_jsonb(i) order by i.created_at desc,i.id)
        from public.staff_shift_items i where i.shift_id=sh.id),'[]'::jsonb))
        from public.staff_shifts sh where sh.biz_id=p_biz_id and sh.staff_id=p_staff_id and sh.shift_date=p_shift_date);
end;
$$;
revoke all on function public.read_staff_shift_snapshot(uuid,uuid,date) from public,anon;
grant execute on function public.read_staff_shift_snapshot(uuid,uuid,date) to authenticated,service_role;

commit;
