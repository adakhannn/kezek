-- One database transaction for a ledger replacement and attendance/package effects.
-- Manual close uses a revision fence around the shared TypeScript financial calculation.
begin;
alter table public.staff_shifts add column if not exists ledger_revision bigint not null default 0;

-- This trigger intentionally runs as INVOKER: direct API roles cannot submit
-- computed money/status, while checked SECURITY DEFINER commands retain their owner.
-- Opening/reopening uses the checked RPC below or the trusted backend.
create or replace function public.guard_direct_shift_finance_write()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin
    if current_user in ('anon','authenticated') then
        raise exception using errcode='42501',message='SHIFT_COMMAND_REQUIRED';
    end if;
    if tg_op='DELETE' then return old; end if;
    return new;
end;
$$;
create trigger staff_shifts_guard_finance before insert or update or delete on public.staff_shifts
for each row execute function public.guard_direct_shift_finance_write();

-- Existing duplicates must be reviewed before deployment; never silently discard ledger rows.
create unique index staff_shift_items_one_booking on public.staff_shift_items(booking_id) where booking_id is not null;

create or replace function public.bump_shift_ledger_revision()
returns trigger language plpgsql set search_path=pg_catalog,public as $$
begin new.ledger_revision:=old.ledger_revision+1; return new; end;
$$;
create trigger staff_shifts_revision_before_update before update on public.staff_shifts
for each row execute function public.bump_shift_ledger_revision();

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
                or (v_booking.start_at at time zone 'Asia/Bishkek')::date is distinct from v_shift.shift_date then
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
create trigger staff_shift_items_lock_parent before insert or update or delete on public.staff_shift_items
for each row execute function public.lock_shift_for_item_write();

create or replace function public.save_staff_shift_command(
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
            or (v_booking.start_at at time zone 'Asia/Bishkek')::date is distinct from p_shift_date then
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
revoke all on function public.save_staff_shift_command(uuid,uuid,date,jsonb,uuid,boolean,bigint) from public,anon;
grant execute on function public.save_staff_shift_command(uuid,uuid,date,jsonb,uuid,boolean,bigint) to authenticated,service_role;

-- Rebuild affected periods from persisted final shares: repeated close/reopen cannot
-- increment a period twice, and salon_share already includes the guarantee top-up.
create or replace function public.update_shift_aggregates(
    p_staff_id uuid,p_biz_id uuid,p_shift_date date,p_total_amount numeric,
    p_master_share numeric,p_salon_share numeric,p_late_minutes integer,
    p_guaranteed_amount numeric default 0,p_topup_amount numeric default 0
)
returns void language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_period text; v_start date; v_end date; v_key text;
begin
    perform 1 from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    foreach v_period in array array['day','month','year'] loop
        v_start:=date_trunc(v_period,p_shift_date::timestamp)::date;
        v_end:=(v_start+case v_period when 'day' then interval '1 day' when 'month' then interval '1 month' else interval '1 year' end)::date;
        v_key:=to_char(p_shift_date,case v_period when 'day' then 'YYYY-MM-DD' when 'month' then 'YYYY-MM' else 'YYYY' end);
        insert into public.staff_shift_aggregates(staff_id,biz_id,period_type,period_value,shifts_count,total_amount,total_master,total_salon,total_late_minutes,updated_at)
        select p_staff_id,p_biz_id,v_period,v_key,count(*),coalesce(sum(total_amount),0),
            coalesce(sum(master_share),0),coalesce(sum(salon_share),0),coalesce(sum(late_minutes),0),now()
        from public.staff_shifts where staff_id=p_staff_id and biz_id=p_biz_id and status='closed' and shift_date>=v_start and shift_date<v_end
        on conflict(staff_id,period_type,period_value) do update set biz_id=excluded.biz_id,shifts_count=excluded.shifts_count,
            total_amount=excluded.total_amount,total_master=excluded.total_master,total_salon=excluded.total_salon,
            total_late_minutes=excluded.total_late_minutes,updated_at=excluded.updated_at;
    end loop;
end;
$$;
revoke all on function public.update_shift_aggregates(uuid,uuid,date,numeric,numeric,numeric,integer,numeric,numeric) from public,anon,authenticated;
grant execute on function public.update_shift_aggregates(uuid,uuid,date,numeric,numeric,numeric,integer,numeric,numeric) to service_role;

-- The previous open function is INVOKER and would otherwise hit the direct-write
-- guard during reopen. Preserve its response contract behind checked ownership.
alter function public.open_staff_shift_safe(uuid,uuid,uuid,date,timestamptz,timestamptz,integer) rename to open_staff_shift_safe_impl_20261109;
revoke all on function public.open_staff_shift_safe_impl_20261109(uuid,uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon,authenticated;
create function public.open_staff_shift_safe(
    p_staff_id uuid,p_biz_id uuid,p_branch_id uuid,p_shift_date date,p_opened_at timestamptz,
    p_expected_start timestamptz default null,p_late_minutes integer default 0
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_existing public.staff_shifts%rowtype; v_result jsonb;
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id);
    perform 1 from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    if not found or p_shift_date is null or p_opened_at is null then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    if p_branch_id is not null and not exists(select 1 from public.branches where id=p_branch_id and biz_id=p_biz_id) then
        raise exception using errcode='42501',message='FINANCE_FORBIDDEN';
    end if;
    select * into v_existing from public.staff_shifts where staff_id=p_staff_id and shift_date=p_shift_date for update;
    if found and v_existing.biz_id is distinct from p_biz_id then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
    v_result:=public.open_staff_shift_safe_impl_20261109(p_staff_id,p_biz_id,p_branch_id,p_shift_date,p_opened_at,p_expected_start,p_late_minutes);
    if v_result->>'ok' is distinct from 'true' then raise exception using errcode='P0001',message='SHIFT_OPEN_FAILED'; end if;
    if v_result->>'action'='reopened' then perform public.update_shift_aggregates(p_staff_id,p_biz_id,p_shift_date,0,0,0,0,0,0); end if;
    return v_result;
end;
$$;
revoke all on function public.open_staff_shift_safe(uuid,uuid,uuid,date,timestamptz,timestamptz,integer) from public,anon;
grant execute on function public.open_staff_shift_safe(uuid,uuid,uuid,date,timestamptz,timestamptz,integer) to authenticated,service_role;

-- The old close accepts computed amounts and must never be an untrusted client RPC.
revoke all on function public.close_staff_shift_safe(uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.close_staff_shift_safe(uuid,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,numeric,timestamptz) to service_role;

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
    if exists(select 1 from public.staff_shift_items where shift_id=p_shift_id) then
        select sum(service_amount),sum(consumables_amount) into v_total,v_consumables from public.staff_shift_items where shift_id=p_shift_id;
        if v_total is distinct from (p_calculation->>'totalAmount')::numeric or v_consumables is distinct from (p_calculation->>'totalConsumables')::numeric then
            raise exception using errcode='40001',message='SHIFT_STALE';
        end if;
    end if;
    -- Validate every persisted relationship under the same transaction before finalizing.
    if exists(select 1 from public.staff_shift_items i left join public.bookings b on b.id=i.booking_id
        where i.shift_id=p_shift_id and i.booking_id is not null and (b.id is null or b.biz_id<>v_shift.biz_id
            or b.staff_id<>v_shift.staff_id or (b.start_at at time zone 'Asia/Bishkek')::date<>v_shift.shift_date)) then
        raise exception using errcode='42501',message='SHIFT_BOOKING_SCOPE';
    end if;
    for v_booking in select b.* from public.bookings b where (b.biz_id=v_shift.biz_id and b.staff_id=v_shift.staff_id
        and (b.start_at at time zone 'Asia/Bishkek')::date=v_shift.shift_date)
        or exists(select 1 from public.staff_shift_items i where i.shift_id=p_shift_id and i.booking_id=b.id)
        order by b.id for update loop
        if p_actor_id is null and v_booking.status in ('paid','confirmed')
            and not exists(select 1 from public.staff_shift_items where shift_id=p_shift_id) then
            raise exception using errcode='40001',message='SHIFT_NEEDS_REVIEW';
        end if;
        if exists(select 1 from public.staff_shift_items where shift_id=p_shift_id and booking_id=v_booking.id) then
            if v_booking.status='cancelled' then raise exception using errcode='22023',message='SHIFT_BOOKING_CANCELLED'; end if;
            if v_booking.biz_id is distinct from v_shift.biz_id or v_booking.staff_id is distinct from v_shift.staff_id
                or (v_booking.start_at at time zone 'Asia/Bishkek')::date is distinct from v_shift.shift_date then
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
revoke all on function public.close_staff_shift_command(uuid,uuid,bigint,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.close_staff_shift_command(uuid,uuid,bigint,jsonb,jsonb) to service_role;
commit;
