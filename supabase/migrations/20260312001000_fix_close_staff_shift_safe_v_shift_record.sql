-- Fix close_staff_shift_safe: ensure v_shift_record is fully initialized
-- and safe to use in update_shift_aggregates.

create or replace function public.close_staff_shift_safe(
    p_shift_id uuid,
    p_total_amount numeric default 0,
    p_consumables_amount numeric default 0,
    p_percent_master numeric default 60,
    p_percent_salon numeric default 40,
    p_master_share numeric default 0,
    p_salon_share numeric default 0,
    p_hours_worked numeric default null,
    p_hourly_rate numeric default null,
    p_guaranteed_amount numeric default 0,
    p_topup_amount numeric default 0,
    p_closed_at timestamptz default null
)
returns jsonb
language plpgsql
as $$
declare
    v_existing_status text;
    v_result jsonb;
    v_shift_record public.staff_shifts%rowtype;
begin
    -- Lock row and load full shift record
    select *
    into v_shift_record
    from public.staff_shifts
    where id = p_shift_id
    for update;

    v_existing_status := v_shift_record.status;

    -- Shift not found
    if v_existing_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;

    -- Shift already closed or has unexpected status
    if v_existing_status != 'open' then
        if v_existing_status = 'closed' then
            select row_to_json(s)::jsonb
            into v_result
            from public.staff_shifts s
            where s.id = p_shift_id;

            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_closed'
            );
        end if;

        return jsonb_build_object(
            'ok', false,
            'error', 'Смена имеет неожиданный статус: ' || v_existing_status
        );
    end if;

    -- Update shift with optimistic check on status
    update public.staff_shifts
    set total_amount       = p_total_amount,
        consumables_amount = p_consumables_amount,
        percent_master     = p_percent_master,
        percent_salon      = p_percent_salon,
        master_share       = p_master_share,
        salon_share        = p_salon_share,
        hours_worked       = p_hours_worked,
        hourly_rate        = p_hourly_rate,
        guaranteed_amount  = p_guaranteed_amount,
        topup_amount       = p_topup_amount,
        status             = 'closed',
        closed_at          = coalesce(p_closed_at, timezone('utc'::text, now()))
    where id = p_shift_id
      and status = 'open';

    if not found then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена была изменена другим запросом. Попробуйте снова.'
        );
    end if;

    -- Update aggregates using fully initialized v_shift_record
    perform public.update_shift_aggregates(
        v_shift_record.staff_id,
        v_shift_record.biz_id,
        v_shift_record.shift_date,
        p_total_amount,
        p_master_share,
        p_salon_share,
        coalesce(v_shift_record.late_minutes, 0),
        p_guaranteed_amount,
        p_topup_amount
    );

    -- Return updated shift
    select row_to_json(s)::jsonb
    into v_result
    from public.staff_shifts s
    where s.id = p_shift_id;

    return jsonb_build_object(
        'ok', true,
        'shift', v_result,
        'action', 'closed'
    );

exception
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при закрытии смены: ' || sqlerrm
        );
end;
$$;

comment on function public.close_staff_shift_safe is
    'Безопасное закрытие смены с защитой от race conditions и автоматическим обновлением агрегатов статистики.';

