-- A draft identifies the exact shift snapshot it replaces. NULL/NULL means that
-- no shift existed; it is not a request to bypass optimistic concurrency.
begin;
-- All browser/mobile ledger writes use the checked command. Keep the existing
-- row trigger for trusted backend writers, but do not expose a revision-free
-- alternative through authenticated PostgREST INSERT/UPDATE/DELETE.
create trigger staff_shift_items_guard_finance before insert or update or delete on public.staff_shift_items
for each row execute function public.guard_direct_shift_finance_write();

alter function public.save_staff_shift_command(uuid,uuid,date,jsonb,uuid,boolean,bigint)
    rename to save_staff_shift_command_internal_v1;
revoke all on function public.save_staff_shift_command_internal_v1(uuid,uuid,date,jsonb,uuid,boolean,bigint)
    from public,anon,authenticated,service_role;

create function public.save_staff_shift_command(
    p_staff_id uuid,p_biz_id uuid,p_shift_date date,p_items jsonb,
    p_actor_id uuid default null,p_allow_create boolean default false,
    p_expected_revision bigint default null,p_expected_shift_id uuid default null
)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public as $$
declare v_shift public.staff_shifts%rowtype; v_result jsonb; v_items jsonb;
begin
    perform public.assert_finance_access(p_biz_id,p_staff_id,p_actor_id);
    -- Use the same ordering as Save and Close. The staff lock also serializes
    -- competing creation attempts when there is no shift row to lock yet.
    perform 1 from public.staff where id=p_staff_id and biz_id=p_biz_id for update;
    if not found then raise exception using errcode='42501',message='FINANCE_FORBIDDEN'; end if;
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
revoke all on function public.save_staff_shift_command(uuid,uuid,date,jsonb,uuid,boolean,bigint,uuid) from public,anon;
grant execute on function public.save_staff_shift_command(uuid,uuid,date,jsonb,uuid,boolean,bigint,uuid) to authenticated,service_role;
commit;
