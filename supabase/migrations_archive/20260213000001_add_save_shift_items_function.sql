-- Функция для атомарного сохранения items в транзакции
-- Вынесена в отдельную миграцию для совместимости с Supabase CLI

create or replace function public.save_shift_items_atomic(
    p_shift_id uuid,
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
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
