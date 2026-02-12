-- Создание таблицы для хранения метрик API запросов
-- 
-- Проблемы:
-- 1. Метрики хранятся только в памяти и теряются при перезапуске
-- 2. Нет долгосрочного хранения для анализа трендов
-- 3. Нет отслеживания HTTP статусов (4xx/5xx)
--
-- Решения:
-- 1. Таблица для хранения метрик всех API запросов
-- 2. Автоматическое сохранение времени ответа и статусов
-- 3. Индексы для быстрого анализа метрик

-- Таблица для метрик API запросов
create table if not exists public.api_request_metrics (
    id uuid primary key default gen_random_uuid(),
    
    -- Информация о запросе
    endpoint text not null,                    -- Например: '/api/staff/finance'
    method text not null default 'GET',        -- HTTP метод: GET, POST, PUT, DELETE
    status_code integer not null,             -- HTTP статус код: 200, 400, 500 и т.д.
    
    -- Производительность
    duration_ms integer not null,             -- Время ответа в миллисекундах
    request_size_bytes integer,               -- Размер запроса в байтах
    response_size_bytes integer,              -- Размер ответа в байтах
    
    -- Контекст
    user_id uuid references auth.users (id) on delete set null,
    staff_id uuid references public.staff (id) on delete set null,
    biz_id uuid references public.businesses (id) on delete set null,
    
    -- Ошибки
    error_message text,                       -- Сообщение об ошибке (если есть)
    error_type text,                          -- Тип ошибки: 'validation', 'database', 'auth', 'server', 'network'
    
    -- Метаданные
    metadata jsonb,                           -- Дополнительные данные (query params, body size и т.д.)
    
    -- IP адрес и user agent (для безопасности)
    ip_address inet,
    user_agent text,
    
    -- Время запроса
    created_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.api_request_metrics is 'Метрики API запросов для мониторинга производительности и анализа ошибок';
comment on column public.api_request_metrics.endpoint is 'Путь эндпоинта (например, /api/staff/finance)';
comment on column public.api_request_metrics.method is 'HTTP метод запроса';
comment on column public.api_request_metrics.status_code is 'HTTP статус код ответа';
comment on column public.api_request_metrics.duration_ms is 'Время выполнения запроса в миллисекундах';
comment on column public.api_request_metrics.error_type is 'Тип ошибки: validation, database, auth, server, network';
comment on column public.api_request_metrics.metadata is 'Дополнительные данные запроса в формате JSON';

-- Индексы для быстрого поиска и анализа
create index if not exists api_metrics_endpoint_date_idx
    on public.api_request_metrics (endpoint, created_at desc);

create index if not exists api_metrics_status_code_idx
    on public.api_request_metrics (status_code, created_at desc)
    where status_code >= 400;  -- Только ошибки

create index if not exists api_metrics_duration_idx
    on public.api_request_metrics (duration_ms, created_at desc)
    where duration_ms > 1000;  -- Только медленные запросы (>1s)

create index if not exists api_metrics_staff_date_idx
    on public.api_request_metrics (staff_id, created_at desc)
    where staff_id is not null;

create index if not exists api_metrics_biz_date_idx
    on public.api_request_metrics (biz_id, created_at desc)
    where biz_id is not null;

create index if not exists api_metrics_error_type_idx
    on public.api_request_metrics (error_type, created_at desc)
    where error_type is not null;

-- Функция для записи метрики API запроса
create or replace function public.log_api_metric(
    p_endpoint text,
    p_method text,
    p_status_code integer,
    p_duration_ms integer,
    p_user_id uuid default null,
    p_staff_id uuid default null,
    p_biz_id uuid default null,
    p_error_message text default null,
    p_error_type text default null,
    p_request_size_bytes integer default null,
    p_response_size_bytes integer default null,
    p_metadata jsonb default null,
    p_ip_address inet default null,
    p_user_agent text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
    v_metric_id uuid;
begin
    -- Валидация статус кода
    if p_status_code < 100 or p_status_code >= 600 then
        raise exception 'Invalid status_code: %', p_status_code;
    end if;
    
    -- Валидация типа ошибки
    if p_error_type is not null and p_error_type not in ('validation', 'database', 'auth', 'server', 'network') then
        raise exception 'Invalid error_type: %', p_error_type;
    end if;
    
    -- Вставляем метрику
    insert into public.api_request_metrics (
        endpoint,
        method,
        status_code,
        duration_ms,
        user_id,
        staff_id,
        biz_id,
        error_message,
        error_type,
        request_size_bytes,
        response_size_bytes,
        metadata,
        ip_address,
        user_agent
    )
    values (
        p_endpoint,
        p_method,
        p_status_code,
        p_duration_ms,
        p_user_id,
        p_staff_id,
        p_biz_id,
        p_error_message,
        p_error_type,
        p_request_size_bytes,
        p_response_size_bytes,
        p_metadata,
        p_ip_address,
        p_user_agent
    )
    returning id into v_metric_id;
    
    return v_metric_id;
end;
$$;

comment on function public.log_api_metric is 'Записывает метрику API запроса в таблицу метрик. Возвращает ID созданной метрики.';

-- Предоставляем права на выполнение функции
grant execute on function public.log_api_metric(text, text, integer, integer, uuid, uuid, uuid, text, text, integer, integer, jsonb, inet, text) to authenticated;
grant execute on function public.log_api_metric(text, text, integer, integer, uuid, uuid, uuid, text, text, integer, integer, jsonb, inet, text) to service_role;

-- Функция для получения статистики по эндпоинту
create or replace function public.get_api_metrics_stats(
    p_endpoint text,
    p_window_minutes integer default 60,
    p_method text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
    v_result jsonb;
    v_window_start timestamptz;
begin
    v_window_start := timezone('utc'::text, now()) - (p_window_minutes || ' minutes')::interval;
    
    select jsonb_build_object(
        'endpoint', p_endpoint,
        'method', coalesce(p_method, 'all'),
        'window_minutes', p_window_minutes,
        'total_requests', count(*),
        'success_count', count(*) filter (where status_code < 400),
        'client_error_count', count(*) filter (where status_code >= 400 and status_code < 500),
        'server_error_count', count(*) filter (where status_code >= 500),
        'avg_duration_ms', coalesce(avg(duration_ms), 0),
        'min_duration_ms', coalesce(min(duration_ms), 0),
        'max_duration_ms', coalesce(max(duration_ms), 0),
        'p95_duration_ms', coalesce(
            percentile_cont(0.95) within group (order by duration_ms),
            0
        ),
        'p99_duration_ms', coalesce(
            percentile_cont(0.99) within group (order by duration_ms),
            0
        ),
        'error_rate', case 
            when count(*) > 0 then 
                round((count(*) filter (where status_code >= 400)::numeric / count(*)::numeric) * 100, 2)
            else 0
        end,
        'error_types', jsonb_agg(distinct error_type) filter (where error_type is not null),
        'status_codes', jsonb_object_agg(
            status_code::text,
            count(*)
        ) filter (where status_code is not null)
    )
    into v_result
    from public.api_request_metrics
    where endpoint = p_endpoint
      and created_at >= v_window_start
      and (p_method is null or method = p_method);
    
    return coalesce(v_result, jsonb_build_object('error', 'No data'));
end;
$$;

comment on function public.get_api_metrics_stats is 'Возвращает статистику по эндпоинту за указанный период времени.';

grant execute on function public.get_api_metrics_stats(text, integer, text) to authenticated;
grant execute on function public.get_api_metrics_stats(text, integer, text) to service_role;

-- Функция для получения медленных запросов
create or replace function public.get_slow_api_requests(
    p_endpoint text default null,
    p_threshold_ms integer default 1000,
    p_limit integer default 100
)
returns table (
    id uuid,
    endpoint text,
    method text,
    status_code integer,
    duration_ms integer,
    created_at timestamptz,
    error_message text
)
language plpgsql
security definer
set search_path = public
as $$
begin
    return query
    select 
        m.id,
        m.endpoint,
        m.method,
        m.status_code,
        m.duration_ms,
        m.created_at,
        m.error_message
    from public.api_request_metrics m
    where m.duration_ms >= p_threshold_ms
      and (p_endpoint is null or m.endpoint = p_endpoint)
    order by m.duration_ms desc, m.created_at desc
    limit p_limit;
end;
$$;

comment on function public.get_slow_api_requests is 'Возвращает список медленных запросов (выше порога).';

grant execute on function public.get_slow_api_requests(text, integer, integer) to authenticated;
grant execute on function public.get_slow_api_requests(text, integer, integer) to service_role;

-- Функция для получения запросов с ошибками
create or replace function public.get_failed_api_requests(
    p_endpoint text default null,
    p_window_minutes integer default 60,
    p_limit integer default 100
)
returns table (
    id uuid,
    endpoint text,
    method text,
    status_code integer,
    duration_ms integer,
    error_type text,
    error_message text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
    v_window_start timestamptz;
begin
    v_window_start := timezone('utc'::text, now()) - (p_window_minutes || ' minutes')::interval;
    
    return query
    select 
        m.id,
        m.endpoint,
        m.method,
        m.status_code,
        m.duration_ms,
        m.error_type,
        m.error_message,
        m.created_at
    from public.api_request_metrics m
    where m.status_code >= 400
      and m.created_at >= v_window_start
      and (p_endpoint is null or m.endpoint = p_endpoint)
    order by m.created_at desc
    limit p_limit;
end;
$$;

comment on function public.get_failed_api_requests is 'Возвращает список запросов с ошибками за указанный период.';

grant execute on function public.get_failed_api_requests(text, integer, integer) to authenticated;
grant execute on function public.get_failed_api_requests(text, integer, integer) to service_role;

-- Функция для очистки старых метрик
create or replace function public.cleanup_old_api_metrics(
    p_keep_days integer default 30
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_deleted_count integer;
begin
    -- Удаляем метрики старше указанного количества дней
    -- Оставляем только ошибки (4xx/5xx) навсегда
    delete from public.api_request_metrics
    where created_at < timezone('utc'::text, now()) - (p_keep_days || ' days')::interval
      and status_code < 400;
    
    get diagnostics v_deleted_count = row_count;
    
    return v_deleted_count;
end;
$$;

comment on function public.cleanup_old_api_metrics is 'Удаляет старые метрики (кроме ошибок). По умолчанию сохраняет метрики за последние 30 дней.';

grant execute on function public.cleanup_old_api_metrics(integer) to service_role;

-- Включаем RLS для таблицы метрик
alter table public.api_request_metrics enable row level security;

-- Политики RLS: пользователь может видеть только свои метрики
drop policy if exists "API metrics select own" on public.api_request_metrics;

create policy "API metrics select own"
    on public.api_request_metrics
    for select
    to authenticated
    using (
        user_id = auth.uid()
        or staff_id in (
            select id from public.staff where user_id = auth.uid()
        )
    );

-- Политики для service_role (для обхода RLS при просмотре менеджером)
-- service_role может видеть все метрики (используется в API для менеджеров)

