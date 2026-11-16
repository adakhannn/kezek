-- Создание таблицы для логирования операций с финансами
-- 
-- Проблемы:
-- 1. Логи операций хранятся только в консоли и теряются при перезапуске
-- 2. Нет возможности разобрать спорные ситуации задним числом
-- 3. Сложно отлаживать редкие баги без истории операций
--
-- Решения:
-- 1. Таблица для хранения логов всех ключевых операций
-- 2. Автоматическое логирование через функции БД
-- 3. Индексы для быстрого поиска по дате, сотруднику, типу операции

-- Таблица для логов операций с финансами
create table if not exists public.staff_finance_operation_logs (
    id uuid primary key default gen_random_uuid(),
    
    -- Контекст операции
    staff_id uuid not null references public.staff (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    shift_id uuid references public.staff_shifts (id) on delete set null,
    shift_date date,
    
    -- Тип операции
    operation_type text not null check (operation_type in (
        'shift_open',           -- Открытие смены
        'shift_close',          -- Закрытие смены
        'item_create',          -- Создание клиента/позиции
        'item_update',          -- Обновление клиента/позиции
        'item_delete',          -- Удаление клиента/позиции
        'items_save',           -- Сохранение списка клиентов
        'error'                 -- Ошибка операции
    )),
    
    -- Уровень логирования
    log_level text not null default 'info' check (log_level in ('debug', 'info', 'warn', 'error')),
    
    -- Сообщение
    message text not null,
    
    -- Дополнительные данные (JSONB для гибкости)
    metadata jsonb,
    
    -- Данные до операции (для отката/аудита)
    before_data jsonb,
    
    -- Данные после операции (для аудита)
    after_data jsonb,
    
    -- Информация об ошибке (если есть)
    error_message text,
    error_stack text,
    
    -- IP адрес и user agent (для безопасности)
    ip_address inet,
    user_agent text,
    
    -- Время операции
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.staff_finance_operation_logs is 'Логи операций с финансами для аудита и отладки';
comment on column public.staff_finance_operation_logs.operation_type is 'Тип операции: shift_open, shift_close, item_create, item_update, item_delete, items_save, error';
comment on column public.staff_finance_operation_logs.log_level is 'Уровень логирования: debug, info, warn, error';
comment on column public.staff_finance_operation_logs.metadata is 'Дополнительные данные операции в формате JSON';
comment on column public.staff_finance_operation_logs.before_data is 'Состояние данных до операции (для аудита)';
comment on column public.staff_finance_operation_logs.after_data is 'Состояние данных после операции (для аудита)';
comment on column public.staff_finance_operation_logs.error_message is 'Сообщение об ошибке (если операция завершилась с ошибкой)';
comment on column public.staff_finance_operation_logs.error_stack is 'Стек ошибки (если операция завершилась с ошибкой)';

-- Индексы для быстрого поиска
create index if not exists staff_finance_logs_staff_date_idx
    on public.staff_finance_operation_logs (staff_id, created_at desc);

create index if not exists staff_finance_logs_shift_idx
    on public.staff_finance_operation_logs (shift_id, created_at desc);

create index if not exists staff_finance_logs_operation_type_idx
    on public.staff_finance_operation_logs (operation_type, created_at desc);

create index if not exists staff_finance_logs_log_level_idx
    on public.staff_finance_operation_logs (log_level, created_at desc)
    where log_level in ('warn', 'error');

create index if not exists staff_finance_logs_shift_date_idx
    on public.staff_finance_operation_logs (shift_date, created_at desc);

create index if not exists staff_finance_logs_biz_date_idx
    on public.staff_finance_operation_logs (biz_id, created_at desc);

-- Функция для записи лога операции
create or replace function public.log_finance_operation(
    p_staff_id uuid,
    p_biz_id uuid,
    p_operation_type text,
    p_message text,
    p_log_level text default 'info',
    p_shift_id uuid default null,
    p_shift_date date default null,
    p_metadata jsonb default null,
    p_before_data jsonb default null,
    p_after_data jsonb default null,
    p_error_message text default null,
    p_error_stack text default null,
    p_ip_address inet default null,
    p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_log_id uuid;
begin
    -- Валидация типа операции
    if p_operation_type not in ('shift_open', 'shift_close', 'item_create', 'item_update', 'item_delete', 'items_save', 'error') then
        raise exception 'Invalid operation_type: %', p_operation_type;
    end if;
    
    -- Валидация уровня логирования
    if p_log_level not in ('debug', 'info', 'warn', 'error') then
        raise exception 'Invalid log_level: %', p_log_level;
    end if;
    
    -- Вставляем лог
    insert into public.staff_finance_operation_logs (
        staff_id,
        biz_id,
        shift_id,
        shift_date,
        operation_type,
        log_level,
        message,
        metadata,
        before_data,
        after_data,
        error_message,
        error_stack,
        ip_address,
        user_agent
    )
    values (
        p_staff_id,
        p_biz_id,
        p_shift_id,
        p_shift_date,
        p_operation_type,
        p_log_level,
        p_message,
        p_metadata,
        p_before_data,
        p_after_data,
        p_error_message,
        p_error_stack,
        p_ip_address,
        p_user_agent
    )
    returning id into v_log_id;
    
    return v_log_id;
end;
$$;

comment on function public.log_finance_operation is 'Записывает лог операции с финансами в таблицу логов. Возвращает ID созданного лога.';

-- Предоставляем права на выполнение функции
grant execute on function public.log_finance_operation(uuid, uuid, text, text, text, uuid, date, jsonb, jsonb, jsonb, text, text, inet, text) to authenticated;
grant execute on function public.log_finance_operation(uuid, uuid, text, text, text, uuid, date, jsonb, jsonb, jsonb, text, text, inet, text) to service_role;

-- Триггер для автоматического логирования открытия смены
create or replace function public.log_shift_open_trigger()
returns trigger
language plpgsql
as $$
begin
    -- Логируем только если статус изменился на 'open'
    if new.status = 'open' and (old.status is null or old.status != 'open') then
        perform public.log_finance_operation(
            new.staff_id,
            new.biz_id,
            'shift_open',
            format('Смена открыта для сотрудника %s на дату %s', new.staff_id, new.shift_date),
            'info',
            new.id,
            new.shift_date,
            jsonb_build_object(
                'opened_at', new.opened_at,
                'expected_start', new.expected_start,
                'late_minutes', new.late_minutes
            ),
            null, -- before_data
            jsonb_build_object(
                'id', new.id,
                'status', new.status,
                'opened_at', new.opened_at,
                'shift_date', new.shift_date
            ) -- after_data
        );
    end if;
    
    return new;
end;
$$;

comment on function public.log_shift_open_trigger is 'Автоматически логирует открытие смены';

drop trigger if exists log_shift_open on public.staff_shifts;
create trigger log_shift_open
after insert or update on public.staff_shifts
for each row
when (new.status = 'open')
execute function public.log_shift_open_trigger();

-- Триггер для автоматического логирования закрытия смены
create or replace function public.log_shift_close_trigger()
returns trigger
language plpgsql
as $$
begin
    -- Логируем только если статус изменился на 'closed'
    if new.status = 'closed' and old.status = 'open' then
        perform public.log_finance_operation(
            new.staff_id,
            new.biz_id,
            'shift_close',
            format('Смена закрыта для сотрудника %s на дату %s', new.staff_id, new.shift_date),
            'info',
            new.id,
            new.shift_date,
            jsonb_build_object(
                'closed_at', new.closed_at,
                'total_amount', new.total_amount,
                'consumables_amount', new.consumables_amount,
                'master_share', new.master_share,
                'salon_share', new.salon_share,
                'guaranteed_amount', new.guaranteed_amount,
                'topup_amount', new.topup_amount,
                'hours_worked', new.hours_worked
            ),
            jsonb_build_object(
                'id', old.id,
                'status', old.status,
                'opened_at', old.opened_at
            ), -- before_data
            jsonb_build_object(
                'id', new.id,
                'status', new.status,
                'closed_at', new.closed_at,
                'total_amount', new.total_amount,
                'master_share', new.master_share,
                'salon_share', new.salon_share
            ) -- after_data
        );
    end if;
    
    return new;
end;
$$;

comment on function public.log_shift_close_trigger is 'Автоматически логирует закрытие смены';

drop trigger if exists log_shift_close on public.staff_shifts;
create trigger log_shift_close
after update on public.staff_shifts
for each row
when (new.status = 'closed' and old.status = 'open')
execute function public.log_shift_close_trigger();

-- Триггер для автоматического логирования создания/удаления позиций смены
create or replace function public.log_shift_items_trigger()
returns trigger
language plpgsql
as $$
declare
    v_shift_record record;
    v_operation_type text;
    v_message text;
begin
    -- Получаем информацию о смене
    select staff_id, biz_id, shift_date, id
    into v_shift_record
    from public.staff_shifts
    where id = coalesce(new.shift_id, old.shift_id);
    
    if v_shift_record is null then
        return coalesce(new, old);
    end if;
    
    -- Определяем тип операции
    if tg_op = 'INSERT' then
        v_operation_type := 'item_create';
        v_message := format('Создана позиция смены: клиент "%s", услуга "%s", сумма %s', 
            coalesce(new.client_name, 'не указан'),
            coalesce(new.service_name, 'не указана'),
            new.service_amount
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', new.id,
                'client_name', new.client_name,
                'service_name', new.service_name,
                'service_amount', new.service_amount,
                'consumables_amount', new.consumables_amount,
                'booking_id', new.booking_id
            ),
            null, -- before_data
            jsonb_build_object(
                'id', new.id,
                'client_name', new.client_name,
                'service_amount', new.service_amount
            ) -- after_data
        );
    elsif tg_op = 'DELETE' then
        v_operation_type := 'item_delete';
        v_message := format('Удалена позиция смены: клиент "%s", услуга "%s", сумма %s', 
            coalesce(old.client_name, 'не указан'),
            coalesce(old.service_name, 'не указана'),
            old.service_amount
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', old.id,
                'client_name', old.client_name,
                'service_name', old.service_name,
                'service_amount', old.service_amount
            ),
            jsonb_build_object(
                'id', old.id,
                'client_name', old.client_name,
                'service_amount', old.service_amount
            ), -- before_data
            null -- after_data
        );
    elsif tg_op = 'UPDATE' then
        v_operation_type := 'item_update';
        v_message := format('Обновлена позиция смены: клиент "%s"', 
            coalesce(new.client_name, 'не указан')
        );
        
        perform public.log_finance_operation(
            v_shift_record.staff_id,
            v_shift_record.biz_id,
            v_operation_type,
            v_message,
            'info',
            v_shift_record.id,
            v_shift_record.shift_date,
            jsonb_build_object(
                'item_id', new.id,
                'changes', jsonb_build_object(
                    'client_name', jsonb_build_object('old', old.client_name, 'new', new.client_name),
                    'service_name', jsonb_build_object('old', old.service_name, 'new', new.service_name),
                    'service_amount', jsonb_build_object('old', old.service_amount, 'new', new.service_amount),
                    'consumables_amount', jsonb_build_object('old', old.consumables_amount, 'new', new.consumables_amount)
                )
            ),
            jsonb_build_object(
                'id', old.id,
                'client_name', old.client_name,
                'service_amount', old.service_amount
            ), -- before_data
            jsonb_build_object(
                'id', new.id,
                'client_name', new.client_name,
                'service_amount', new.service_amount
            ) -- after_data
        );
    end if;
    
    return coalesce(new, old);
end;
$$;

comment on function public.log_shift_items_trigger is 'Автоматически логирует создание, обновление и удаление позиций смены';

drop trigger if exists log_shift_items on public.staff_shift_items;
create trigger log_shift_items
after insert or update or delete on public.staff_shift_items
for each row
execute function public.log_shift_items_trigger();

-- Включаем RLS для таблицы логов
alter table public.staff_finance_operation_logs enable row level security;

-- Политики RLS: сотрудник может видеть только свои логи
drop policy if exists "Finance logs select own" on public.staff_finance_operation_logs;

create policy "Finance logs select own"
    on public.staff_finance_operation_logs
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.staff s
            where s.id = staff_id
              and s.user_id = auth.uid()
              and s.is_active = true
        )
    );

-- Политики для service_role (для обхода RLS при просмотре менеджером)
-- service_role может видеть все логи (используется в API для менеджеров)

-- Функция для очистки старых логов (опционально, для управления размером таблицы)
create or replace function public.cleanup_old_finance_logs(
    p_keep_days integer default 90
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted_count integer;
begin
    -- Удаляем логи старше указанного количества дней
    -- Оставляем только ошибки (error level) навсегда
    delete from public.staff_finance_operation_logs
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval
      and log_level != 'error';
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;

comment on function public.cleanup_old_finance_logs is 'Удаляет старые логи операций (кроме ошибок). По умолчанию сохраняет логи за последние 90 дней.';

grant execute on function public.cleanup_old_finance_logs(integer) to service_role;

