-- Защита от race conditions при открытии/закрытии смен
-- 
-- Проблемы:
-- 1. Два одновременных запроса могут создать дубликаты смен
-- 2. Смена может быть закрыта дважды (вручную и через cron)
-- 3. При переоткрытии закрытой смены может произойти потеря данных
--
-- Решения:
-- 1. Уникальный индекс на (staff_id, shift_date)
-- 2. SQL функции с блокировками (SELECT FOR UPDATE) для атомарных операций
-- 3. Проверка статуса в WHERE условиях UPDATE

-- 1. Уникальный индекс для предотвращения дубликатов
create unique index if not exists staff_shifts_staff_date_unique_idx
    on public.staff_shifts (staff_id, shift_date);

comment on index staff_shifts_staff_date_unique_idx is 'Предотвращает создание дубликатов смен для одного сотрудника на одну дату';

-- 2. Функция для безопасного открытия смены (с блокировкой)
create or replace function public.open_staff_shift_safe(
    p_staff_id uuid,
    p_biz_id uuid,
    p_branch_id uuid,
    p_shift_date date,
    p_opened_at timestamptz,
    p_expected_start timestamptz default null,
    p_late_minutes integer default 0
)
returns jsonb
language plpgsql
as $$
declare
    v_existing_id uuid;
    v_existing_status text;
    v_result jsonb;
begin
    -- Блокируем строку для данного сотрудника и даты (если существует)
    -- Используем SELECT FOR UPDATE для предотвращения race conditions
    select id, status
    into v_existing_id, v_existing_status
    from public.staff_shifts
    where staff_id = p_staff_id
      and shift_date = p_shift_date
    for update;

    -- Если смена уже существует
    if v_existing_id is not null then
        -- Если уже открыта - возвращаем существующую
        if v_existing_status = 'open' then
            select row_to_json(s)::jsonb
            into v_result
            from public.staff_shifts s
            where s.id = v_existing_id;
            
            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_open'
            );
        end if;

        -- Если закрыта - переоткрываем (сохраняем opened_at и late_minutes)
        update public.staff_shifts
        set status = 'open',
            closed_at = null,
            total_amount = 0,
            consumables_amount = 0,
            master_share = 0,
            salon_share = 0,
            guaranteed_amount = 0,
            topup_amount = 0,
            hours_worked = null
        where id = v_existing_id
          and status = 'closed';  -- Проверяем статус в WHERE для безопасности

        -- Проверяем, что обновление прошло успешно
        if not found then
            return jsonb_build_object(
                'ok', false,
                'error', 'Смена была изменена другим запросом. Попробуйте снова.'
            );
        end if;

        -- Возвращаем обновленную смену
        select row_to_json(s)::jsonb
        into v_result
        from public.staff_shifts s
        where s.id = v_existing_id;
        
        return jsonb_build_object(
            'ok', true,
            'shift', v_result,
            'action', 'reopened'
        );
    end if;

    -- Смена не существует - создаем новую
    insert into public.staff_shifts (
        staff_id,
        biz_id,
        branch_id,
        shift_date,
        opened_at,
        expected_start,
        late_minutes,
        status
    )
    values (
        p_staff_id,
        p_biz_id,
        p_branch_id,
        p_shift_date,
        p_opened_at,
        p_expected_start,
        p_late_minutes,
        'open'
    )
    returning row_to_json(staff_shifts)::jsonb into v_result;

    return jsonb_build_object(
        'ok', true,
        'shift', v_result,
        'action', 'created'
    );

exception
    when unique_violation then
        -- Если все же произошло нарушение уникальности (очень редкий случай)
        -- Возвращаем существующую смену
        select row_to_json(s)::jsonb
        into v_result
        from public.staff_shifts s
        where s.staff_id = p_staff_id
          and s.shift_date = p_shift_date;
        
        if v_result is not null then
            return jsonb_build_object(
                'ok', true,
                'shift', v_result,
                'action', 'already_exists'
            );
        end if;
        
        return jsonb_build_object(
            'ok', false,
            'error', 'Не удалось создать смену из-за конфликта. Попробуйте снова.'
        );
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при открытии смены: ' || sqlerrm
        );
end;
$$;

comment on function public.open_staff_shift_safe is 'Безопасное открытие смены с защитой от race conditions. Использует SELECT FOR UPDATE для блокировки.';

-- 3. Функция для безопасного закрытия смены (с блокировкой и проверкой статуса)
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
begin
    -- Блокируем строку для обновления
    select status
    into v_existing_status
    from public.staff_shifts
    where id = p_shift_id
    for update;

    -- Проверяем, что смена существует
    if v_existing_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;

    -- Проверяем, что смена открыта
    if v_existing_status != 'open' then
        -- Если уже закрыта, возвращаем существующую смену
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

    -- Обновляем смену с проверкой статуса в WHERE
    update public.staff_shifts
    set total_amount = p_total_amount,
        consumables_amount = p_consumables_amount,
        percent_master = p_percent_master,
        percent_salon = p_percent_salon,
        master_share = p_master_share,
        salon_share = p_salon_share,
        hours_worked = p_hours_worked,
        hourly_rate = p_hourly_rate,
        guaranteed_amount = p_guaranteed_amount,
        topup_amount = p_topup_amount,
        status = 'closed',
        closed_at = coalesce(p_closed_at, timezone('utc'::text, now()))
    where id = p_shift_id
      and status = 'open';  -- Критично: проверяем статус в WHERE

    -- Проверяем, что обновление прошло успешно
    if not found then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена была изменена другим запросом. Попробуйте снова.'
        );
    end if;

    -- Возвращаем обновленную смену
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

comment on function public.close_staff_shift_safe is 'Безопасное закрытие смены с защитой от race conditions. Использует SELECT FOR UPDATE и проверку статуса в WHERE.';

