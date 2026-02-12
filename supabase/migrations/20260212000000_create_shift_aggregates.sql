-- Создание таблицы для предрасчитанных агрегатов статистики по сменам
-- 
-- Проблемы:
-- 1. Статистика вычисляется на лету при каждом открытии страницы
-- 2. При большом количестве смен вычисления становятся медленными
-- 3. Нет кэширования агрегированных данных
--
-- Решения:
-- 1. Таблица для хранения дневных, месячных и годовых агрегатов
-- 2. Автоматическое обновление агрегатов при закрытии смены
-- 3. Индексы для быстрого поиска агрегатов

-- Таблица для агрегированных статистик по сменам
create table if not exists public.staff_shift_aggregates (
    id uuid primary key default gen_random_uuid(),
    staff_id uuid not null references public.staff (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    
    -- Период агрегации: 'day', 'month', 'year'
    period_type text not null check (period_type in ('day', 'month', 'year')),
    
    -- Дата/месяц/год периода (формат зависит от period_type)
    -- Для 'day': YYYY-MM-DD
    -- Для 'month': YYYY-MM
    -- Для 'year': YYYY
    period_value text not null,
    
    -- Агрегированные метрики
    shifts_count integer not null default 0,
    total_amount numeric(12, 2) not null default 0,
    total_master numeric(12, 2) not null default 0,
    total_salon numeric(12, 2) not null default 0,
    total_late_minutes integer not null default 0,
    
    -- Время последнего обновления
    updated_at timestamptz not null default timezone('utc'::text, now()),
    
    -- Уникальность: один агрегат на сотрудника, период и тип
    unique (staff_id, period_type, period_value)
);

comment on table public.staff_shift_aggregates is 'Предрасчитанные агрегаты статистики по сменам сотрудников для оптимизации запросов';
comment on column public.staff_shift_aggregates.period_type is 'Тип периода: day (день), month (месяц), year (год)';
comment on column public.staff_shift_aggregates.period_value is 'Значение периода: YYYY-MM-DD для дня, YYYY-MM для месяца, YYYY для года';
comment on column public.staff_shift_aggregates.shifts_count is 'Количество закрытых смен в периоде';
comment on column public.staff_shift_aggregates.total_amount is 'Общая выручка за период';
comment on column public.staff_shift_aggregates.total_master is 'Общая сумма сотрудника (max(guaranteed_amount, master_share)) за период';
comment on column public.staff_shift_aggregates.total_salon is 'Общая сумма бизнеса (salon_share - topup_amount) за период';
comment on column public.staff_shift_aggregates.total_late_minutes is 'Суммарное опоздание в минутах за период';

-- Индексы для быстрого поиска
create index if not exists staff_shift_aggregates_staff_period_idx
    on public.staff_shift_aggregates (staff_id, period_type, period_value);

create index if not exists staff_shift_aggregates_biz_period_idx
    on public.staff_shift_aggregates (biz_id, period_type, period_value);

create index if not exists staff_shift_aggregates_updated_at_idx
    on public.staff_shift_aggregates (updated_at);

-- Функция для обновления агрегатов при закрытии смены
create or replace function public.update_shift_aggregates(
    p_staff_id uuid,
    p_biz_id uuid,
    p_shift_date date,
    p_total_amount numeric,
    p_master_share numeric,
    p_salon_share numeric,
    p_late_minutes integer,
    p_guaranteed_amount numeric default 0,
    p_topup_amount numeric default 0
)
returns void
language plpgsql
as $$
declare
    v_day_value text;
    v_month_value text;
    v_year_value text;
    v_final_master numeric;
    v_final_salon numeric;
begin
    -- Вычисляем значения периодов
    v_day_value := to_char(p_shift_date, 'YYYY-MM-DD');
    v_month_value := to_char(p_shift_date, 'YYYY-MM');
    v_year_value := to_char(p_shift_date, 'YYYY');
    
    -- Вычисляем финальные суммы (как в useShiftStats)
    -- totalMaster = max(guaranteed_amount, master_share)
    v_final_master := greatest(p_guaranteed_amount, p_master_share);
    -- totalSalon = salon_share - topup_amount
    v_final_salon := p_salon_share - p_topup_amount;
    
    -- Обновляем дневной агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'day',
        v_day_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
    
    -- Обновляем месячный агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'month',
        v_month_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
    
    -- Обновляем годовой агрегат
    insert into public.staff_shift_aggregates (
        staff_id,
        biz_id,
        period_type,
        period_value,
        shifts_count,
        total_amount,
        total_master,
        total_salon,
        total_late_minutes,
        updated_at
    )
    values (
        p_staff_id,
        p_biz_id,
        'year',
        v_year_value,
        1,
        p_total_amount,
        v_final_master,
        v_final_salon,
        p_late_minutes,
        timezone('utc'::text, now())
    )
    on conflict (staff_id, period_type, period_value)
    do update set
        shifts_count = staff_shift_aggregates.shifts_count + 1,
        total_amount = staff_shift_aggregates.total_amount + p_total_amount,
        total_master = staff_shift_aggregates.total_master + v_final_master,
        total_salon = staff_shift_aggregates.total_salon + v_final_salon,
        total_late_minutes = staff_shift_aggregates.total_late_minutes + p_late_minutes,
        updated_at = timezone('utc'::text, now());
end;
$$;

comment on function public.update_shift_aggregates is 'Обновляет агрегированные статистики при закрытии смены. Обновляет дневные, месячные и годовые агрегаты.';

-- Модифицируем функцию close_staff_shift_safe для автоматического обновления агрегатов
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
    v_shift_record record;
begin
    -- Блокируем строку для обновления
    select status, staff_id, biz_id, shift_date, late_minutes
    into v_existing_status, v_shift_record.staff_id, v_shift_record.biz_id, v_shift_record.shift_date, v_shift_record.late_minutes
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

    -- Обновляем агрегаты статистики
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

comment on function public.close_staff_shift_safe is 'Безопасное закрытие смены с защитой от race conditions и автоматическим обновлением агрегатов статистики.';

-- Включаем RLS для таблицы агрегатов
alter table public.staff_shift_aggregates enable row level security;

-- Политики RLS: сотрудник может видеть только свои агрегаты
drop policy if exists "Staff shift aggregates select own" on public.staff_shift_aggregates;

create policy "Staff shift aggregates select own"
    on public.staff_shift_aggregates
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
-- service_role может видеть все агрегаты (используется в API для менеджеров)

-- Функция для инициализации агрегатов из существующих закрытых смен
-- Используется для первоначального заполнения таблицы агрегатов
create or replace function public.initialize_shift_aggregates(
    p_staff_id uuid default null,
    p_biz_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer := 0;
    v_shift record;
    v_final_master numeric;
    v_final_salon numeric;
begin
    -- Пересчитываем агрегаты для всех закрытых смен
    -- Если указан p_staff_id, пересчитываем только для этого сотрудника
    -- Если указан p_biz_id, пересчитываем только для этого бизнеса
    for v_shift in
        select 
            s.id,
            s.staff_id,
            s.biz_id,
            s.shift_date,
            s.total_amount,
            s.master_share,
            s.salon_share,
            s.late_minutes,
            coalesce(s.guaranteed_amount, 0) as guaranteed_amount,
            coalesce(s.topup_amount, 0) as topup_amount
        from public.staff_shifts s
        where s.status = 'closed'
          and (p_staff_id is null or s.staff_id = p_staff_id)
          and (p_biz_id is null or s.biz_id = p_biz_id)
        order by s.shift_date
    loop
        -- Вычисляем финальные суммы (как в useShiftStats)
        v_final_master := greatest(v_shift.guaranteed_amount, v_shift.master_share);
        v_final_salon := v_shift.salon_share - v_shift.topup_amount;
        
        -- Обновляем агрегаты
        perform public.update_shift_aggregates(
            v_shift.staff_id,
            v_shift.biz_id,
            v_shift.shift_date,
            v_shift.total_amount,
            v_shift.master_share,
            v_shift.salon_share,
            coalesce(v_shift.late_minutes, 0),
            v_shift.guaranteed_amount,
            v_shift.topup_amount
        );
        
        v_count := v_count + 1;
    end loop;
    
    return v_count;
end;
$$;

comment on function public.initialize_shift_aggregates is 'Инициализирует агрегаты статистики из существующих закрытых смен. Можно указать staff_id или biz_id для ограничения области пересчета.';

-- Предоставляем права на выполнение функции
grant execute on function public.initialize_shift_aggregates(uuid, uuid) to service_role;
grant execute on function public.update_shift_aggregates(uuid, uuid, date, numeric, numeric, numeric, integer, numeric, numeric) to service_role;

