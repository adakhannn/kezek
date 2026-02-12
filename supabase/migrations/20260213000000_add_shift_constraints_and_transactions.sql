-- Добавление CHECK-ограничений и обеспечение транзакционности операций
-- 
-- Проблемы:
-- 1. Нет ограничений на уровне БД для проверки валидности данных
-- 2. Операции сохранения items не атомарны
-- 3. Нет защиты от некорректных значений сумм
--
-- Решения:
-- 1. Добавить CHECK-ограничения на неотрицательные суммы и максимальные значения
-- 2. Создать функцию для атомарного сохранения items
-- 3. Убедиться, что все операции выполняются в транзакциях

-- ============================================================================
-- CHECK-ограничения для таблицы staff_shifts
-- ============================================================================

-- Проверка неотрицательных сумм
alter table public.staff_shifts
add constraint staff_shifts_total_amount_nonnegative
    check (total_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_consumables_amount_nonnegative
    check (consumables_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_master_share_nonnegative
    check (master_share >= 0);

alter table public.staff_shifts
add constraint staff_shifts_salon_share_nonnegative
    check (salon_share >= 0);

alter table public.staff_shifts
add constraint staff_shifts_guaranteed_amount_nonnegative
    check (guaranteed_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_topup_amount_nonnegative
    check (topup_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_late_minutes_nonnegative
    check (late_minutes >= 0);

-- Проверка максимальных значений (защита от переполнения)
-- Максимальная сумма: 999,999,999,999.99 (12 цифр, 2 знака после запятой)
alter table public.staff_shifts
add constraint staff_shifts_total_amount_max
    check (total_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_consumables_amount_max
    check (consumables_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_master_share_max
    check (master_share <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_salon_share_max
    check (salon_share <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_guaranteed_amount_max
    check (guaranteed_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_topup_amount_max
    check (topup_amount <= 999999999999.99);

-- Проверка процентов (должны быть в диапазоне 0-100)
alter table public.staff_shifts
add constraint staff_shifts_percent_master_range
    check (percent_master >= 0 and percent_master <= 100);

alter table public.staff_shifts
add constraint staff_shifts_percent_salon_range
    check (percent_salon >= 0 and percent_salon <= 100);

-- Проверка часов работы (неотрицательное значение, максимум 24 часа в день)
alter table public.staff_shifts
add constraint staff_shifts_hours_worked_range
    check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 24));

-- Проверка hourly_rate (неотрицательное значение)
alter table public.staff_shifts
add constraint staff_shifts_hourly_rate_nonnegative
    check (hourly_rate is null or hourly_rate >= 0);

-- Проверка логики: если смена закрыта, должна быть указана closed_at
alter table public.staff_shifts
add constraint staff_shifts_closed_at_required
    check (status != 'closed' or closed_at is not null);

-- Проверка логики: если смена открыта, должна быть указана opened_at
alter table public.staff_shifts
add constraint staff_shifts_opened_at_required
    check (status != 'open' or opened_at is not null);

-- ============================================================================
-- CHECK-ограничения для таблицы staff_shift_items
-- ============================================================================

-- Проверка неотрицательных сумм
alter table public.staff_shift_items
add constraint staff_shift_items_service_amount_nonnegative
    check (service_amount >= 0);

alter table public.staff_shift_items
add constraint staff_shift_items_consumables_amount_nonnegative
    check (consumables_amount >= 0);

-- Проверка максимальных значений
alter table public.staff_shift_items
add constraint staff_shift_items_service_amount_max
    check (service_amount <= 999999999999.99);

alter table public.staff_shift_items
add constraint staff_shift_items_consumables_amount_max
    check (consumables_amount <= 999999999999.99);

-- Проверка длины текстовых полей (защита от слишком длинных значений)
alter table public.staff_shift_items
add constraint staff_shift_items_client_name_length
    check (client_name is null or length(client_name) <= 500);

alter table public.staff_shift_items
add constraint staff_shift_items_service_name_length
    check (service_name is null or length(service_name) <= 500);

alter table public.staff_shift_items
add constraint staff_shift_items_note_length
    check (note is null or length(note) <= 2000);

-- ============================================================================
-- Функция для атомарного сохранения items в транзакции
-- ============================================================================

create or replace function public.save_shift_items_atomic(
    p_shift_id uuid,
    p_items jsonb
)
returns jsonb
language plpgsql
as $$
declare
    v_shift_status text;
    v_result jsonb;
    v_item jsonb;
    v_inserted_count integer := 0;
    v_deleted_count integer := 0;
begin
    -- Проверяем, что смена существует и открыта
    select status
    into v_shift_status
    from public.staff_shifts
    where id = p_shift_id
    for update;  -- Блокируем строку для обновления
    
    if v_shift_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;
    
    if v_shift_status != 'open' then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена должна быть открыта для сохранения позиций'
        );
    end if;
    
    -- Удаляем все существующие позиции для этой смены
    delete from public.staff_shift_items
    where shift_id = p_shift_id;
    
    get diagnostics v_deleted_count = row_count;
    
    -- Вставляем новые позиции
    if p_items is not null and jsonb_array_length(p_items) > 0 then
        insert into public.staff_shift_items (
            shift_id,
            client_name,
            service_name,
            service_amount,
            consumables_amount,
            booking_id,
            note,
            created_at
        )
        select
            p_shift_id,
            (item->>'clientName')::text,
            (item->>'serviceName')::text,
            coalesce(((item->>'serviceAmount')::numeric), 0),
            coalesce(((item->>'consumablesAmount')::numeric), 0),
            case when (item->>'bookingId')::text = '' then null else (item->>'bookingId')::uuid end,
            (item->>'note')::text,
            coalesce(
                ((item->>'createdAt')::timestamptz),
                timezone('utc'::text, now())
            )
        from jsonb_array_elements(p_items) as item
        where
            -- Сохраняем только если есть данные
            coalesce(((item->>'serviceAmount')::numeric), 0) > 0
            or coalesce(((item->>'consumablesAmount')::numeric), 0) > 0
            or (item->>'bookingId')::text is not null
            or ((item->>'clientName')::text is not null and (item->>'clientName')::text != '');
        
        get diagnostics v_inserted_count = row_count;
    end if;
    
    -- Возвращаем результат
    return jsonb_build_object(
        'ok', true,
        'deleted_count', v_deleted_count,
        'inserted_count', v_inserted_count
    );
    
exception
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при сохранении позиций: ' || sqlerrm
        );
end;
$$;

comment on function public.save_shift_items_atomic is 'Атомарно сохраняет позиции смены в транзакции. Удаляет старые позиции и вставляет новые. Проверяет, что смена открыта.';

-- Предоставляем права на выполнение функции
grant execute on function public.save_shift_items_atomic(uuid, jsonb) to authenticated;
grant execute on function public.save_shift_items_atomic(uuid, jsonb) to service_role;

-- ============================================================================
-- Комментарии к ограничениям
-- ============================================================================

comment on constraint staff_shifts_total_amount_nonnegative on public.staff_shifts is 'Сумма выручки не может быть отрицательной';
comment on constraint staff_shifts_consumables_amount_nonnegative on public.staff_shifts is 'Сумма расходников не может быть отрицательной';
comment on constraint staff_shifts_master_share_nonnegative on public.staff_shifts is 'Доля мастера не может быть отрицательной';
comment on constraint staff_shifts_salon_share_nonnegative on public.staff_shifts is 'Доля салона не может быть отрицательной';
comment on constraint staff_shifts_guaranteed_amount_nonnegative on public.staff_shifts is 'Гарантированная сумма не может быть отрицательной';
comment on constraint staff_shifts_topup_amount_nonnegative on public.staff_shifts is 'Доплата не может быть отрицательной';
comment on constraint staff_shifts_late_minutes_nonnegative on public.staff_shifts is 'Минуты опоздания не могут быть отрицательными';
comment on constraint staff_shifts_total_amount_max on public.staff_shifts is 'Максимальная сумма выручки: 999,999,999,999.99';
comment on constraint staff_shifts_percent_master_range on public.staff_shifts is 'Процент мастера должен быть в диапазоне 0-100';
comment on constraint staff_shifts_percent_salon_range on public.staff_shifts is 'Процент салона должен быть в диапазоне 0-100';
comment on constraint staff_shifts_hours_worked_range on public.staff_shifts is 'Часы работы должны быть в диапазоне 0-24';
comment on constraint staff_shifts_closed_at_required on public.staff_shifts is 'Закрытая смена должна иметь дату закрытия';
comment on constraint staff_shifts_opened_at_required on public.staff_shifts is 'Открытая смена должна иметь дату открытия';

comment on constraint staff_shift_items_service_amount_nonnegative on public.staff_shift_items is 'Сумма услуги не может быть отрицательной';
comment on constraint staff_shift_items_consumables_amount_nonnegative on public.staff_shift_items is 'Сумма расходников не может быть отрицательной';
comment on constraint staff_shift_items_service_amount_max on public.staff_shift_items is 'Максимальная сумма услуги: 999,999,999,999.99';
comment on constraint staff_shift_items_client_name_length on public.staff_shift_items is 'Имя клиента не может быть длиннее 500 символов';
comment on constraint staff_shift_items_service_name_length on public.staff_shift_items is 'Название услуги не может быть длиннее 500 символов';
comment on constraint staff_shift_items_note_length on public.staff_shift_items is 'Примечание не может быть длиннее 2000 символов';

