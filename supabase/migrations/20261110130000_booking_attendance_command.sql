-- Attendance is a checked command. It never invents a shift ledger or a cash payment.
begin;
-- Maintenance aggregate recomputation has no user-facing caller.
revoke all on function public.initialize_shift_aggregates(uuid,uuid) from public,anon,authenticated;
grant execute on function public.initialize_shift_aggregates(uuid,uuid) to service_role;
revoke all on function public.update_booking_status_no_check(uuid,public.booking_status),
    public.update_booking_status_with_promotion(uuid,public.booking_status),
    public.apply_visit_package_to_booking(uuid),public.apply_promotion_to_booking(uuid)
    from public,anon,authenticated,service_role;

create function public.mark_booking_attendance_command(p_booking_id uuid,p_biz_id uuid,p_actor_id uuid,p_attended boolean)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public set lock_timeout='5s' as $$
declare v_booking public.bookings%rowtype; v_target public.booking_status;
    v_role text:=coalesce(nullif(current_setting('role',true),'none'),session_user);
    v_benefit jsonb; v_package boolean; v_has_ledger boolean; v_has_benefit boolean;
begin
    if v_role not in ('service_role','postgres','supabase_admin') or p_actor_id is null
        or not public.finance_can_manage_business(p_actor_id,p_biz_id) then
        raise exception using errcode='42501',message='BOOKING_FORBIDDEN';
    end if;
    if p_attended is null then raise exception using errcode='22023',message='ATTENDANCE_REQUIRED'; end if;
    -- Shared transition helper takes staff before booking, matching Save/Close.
    v_booking:=public._assert_booking_transition_access(p_booking_id);
    if v_booking.biz_id is distinct from p_biz_id then raise exception using errcode='42501',message='BOOKING_FORBIDDEN'; end if;
    v_target:=case when p_attended then 'paid'::public.booking_status else 'no_show'::public.booking_status end;
    v_has_ledger:=exists(select 1 from public.staff_shift_items where booking_id=p_booking_id);
    v_has_benefit:=v_booking.promotion_applied is not null or v_booking.subscription_applied is not null
        or exists(select 1 from public.client_visit_package_uses where booking_id=p_booking_id)
        or exists(select 1 from public.client_promotion_usage where booking_id=p_booking_id);
    if v_booking.status=v_target and (v_target='paid' or not (v_has_ledger or v_has_benefit)) then
        -- Exact replay is read-only; use the persisted benefit snapshot below.
        null;
    else
        if v_has_ledger or v_has_benefit or v_booking.status not in ('hold','confirmed') then
            raise exception using errcode='40001',message='BOOKING_FINANCIAL_REVIEW_REQUIRED';
        end if;
        if v_booking.start_at is null or v_booking.start_at>=statement_timestamp() then
            raise exception using errcode='22023',message='BOOKING_NOT_IN_PAST';
        end if;
        if v_target='paid' then
            perform public.update_booking_status_with_promotion(p_booking_id,v_target);
        else
            perform public.update_booking_status_no_check(p_booking_id,v_target);
        end if;
        select * into v_booking from public.bookings where id=p_booking_id;
        if v_booking.status<>v_target then raise exception using errcode='P0001',message='ATTENDANCE_UNCONFIRMED'; end if;
    end if;
    v_package:=v_booking.subscription_applied is not null;
    v_benefit:=coalesce(v_booking.subscription_applied,v_booking.promotion_applied);
    return jsonb_build_object('ok',true,'status',v_booking.status,
        'promotion_applied',v_booking.promotion_applied is not null and not v_package,
        'subscription_applied',v_package,
        'promotion_info',case when v_benefit is null then null else jsonb_build_object(
            'title',coalesce(v_benefit->>'plan_name_ru',v_benefit->>'promotion_title',''),
            'discount_percent',coalesce((v_benefit->>'discount_percent')::numeric,0),
            'discount_amount',coalesce((v_benefit->>'discount_amount')::numeric,0),
            'final_amount',coalesce((v_benefit->>'final_amount')::numeric,0)) end);
end;
$$;
revoke all on function public.mark_booking_attendance_command(uuid,uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.mark_booking_attendance_command(uuid,uuid,uuid,boolean) to service_role;
commit;
