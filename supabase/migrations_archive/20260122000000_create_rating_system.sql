-- Система рейтингов для сотрудников, филиалов и бизнесов
-- Каждый день влияет на рейтинг, учитывается период 30 дней

-- 1. Глобальные настройки рейтинга (управляется только суперадмином)
create table if not exists public.rating_global_config (
    id uuid primary key default gen_random_uuid(),
    
    -- Веса для расчета рейтинга сотрудника (сумма должна быть 100)
    staff_reviews_weight numeric(5, 2) not null default 35.0,
    staff_productivity_weight numeric(5, 2) not null default 25.0,
    staff_loyalty_weight numeric(5, 2) not null default 20.0,
    staff_discipline_weight numeric(5, 2) not null default 20.0,
    
    -- Период расчета (дни)
    window_days integer not null default 30,
    
    -- Активна ли эта конфигурация
    is_active boolean not null default true,
    
    -- Когда конфигурация начала действовать
    valid_from timestamptz not null default timezone('utc'::text, now()),
    
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now())
);

comment on table public.rating_global_config is 'Глобальные настройки расчета рейтингов (управляется суперадмином)';
comment on column public.rating_global_config.staff_reviews_weight is 'Вес отзывов клиентов в рейтинге сотрудника (%)';
comment on column public.rating_global_config.staff_productivity_weight is 'Вес продуктивности (количество клиентов) в рейтинге сотрудника (%)';
comment on column public.rating_global_config.staff_loyalty_weight is 'Вес возвращаемости клиентов в рейтинге сотрудника (%)';
comment on column public.rating_global_config.staff_discipline_weight is 'Вес дисциплины (опоздания) в рейтинге сотрудника (%)';
comment on column public.rating_global_config.window_days is 'Период расчета рейтинга в днях (скользящее окно)';

-- Создаем первую активную конфигурацию по умолчанию
insert into public.rating_global_config (is_active, valid_from)
values (true, timezone('utc'::text, now()))
on conflict do nothing;

-- 2. Дневные метрики сотрудников
create table if not exists public.staff_day_metrics (
    id uuid primary key default gen_random_uuid(),
    staff_id uuid not null references public.staff (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    branch_id uuid not null references public.branches (id) on delete cascade,
    
    -- Дата метрики
    metric_date date not null,
    
    -- Метрики отзывов
    avg_rating numeric(3, 2), -- средняя оценка за день (1-5)
    reviews_count integer not null default 0, -- количество отзывов за день
    
    -- Метрики продуктивности
    clients_count integer not null default 0, -- количество уникальных клиентов за день
    revenue numeric(12, 2) not null default 0, -- выручка за день
    
    -- Метрики возвращаемости
    returning_clients_count integer not null default 0, -- количество вернувшихся клиентов (2+ визита)
    returning_clients_ratio numeric(5, 2), -- доля вернувшихся клиентов (%)
    
    -- Метрики дисциплины
    late_minutes integer not null default 0, -- общее количество минут опоздания
    shifts_with_late integer not null default 0, -- количество смен с опозданием
    total_shifts integer not null default 0, -- общее количество смен за день
    
    -- Рассчитанный дневной рейтинг (0-100)
    day_score numeric(5, 2),
    
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    
    unique (staff_id, metric_date)
);

comment on table public.staff_day_metrics is 'Дневные метрики сотрудников для расчета рейтинга';
create index if not exists staff_day_metrics_staff_date_idx on public.staff_day_metrics (staff_id, metric_date desc);
create index if not exists staff_day_metrics_biz_date_idx on public.staff_day_metrics (biz_id, metric_date desc);
create index if not exists staff_day_metrics_branch_date_idx on public.staff_day_metrics (branch_id, metric_date desc);

-- 3. Дневные метрики филиалов
create table if not exists public.branch_day_metrics (
    id uuid primary key default gen_random_uuid(),
    branch_id uuid not null references public.branches (id) on delete cascade,
    biz_id uuid not null references public.businesses (id) on delete cascade,
    
    -- Дата метрики
    metric_date date not null,
    
    -- Агрегированные метрики от сотрудников филиала
    avg_staff_score numeric(5, 2), -- средний рейтинг сотрудников филиала
    total_clients_count integer not null default 0, -- общее количество клиентов
    total_revenue numeric(12, 2) not null default 0, -- общая выручка
    avg_rating numeric(3, 2), -- средняя оценка по всем отзывам филиала
    total_reviews_count integer not null default 0, -- общее количество отзывов
    
    -- Рассчитанный дневной рейтинг филиала (0-100)
    day_score numeric(5, 2),
    
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    
    unique (branch_id, metric_date)
);

comment on table public.branch_day_metrics is 'Дневные метрики филиалов для расчета рейтинга';
create index if not exists branch_day_metrics_branch_date_idx on public.branch_day_metrics (branch_id, metric_date desc);
create index if not exists branch_day_metrics_biz_date_idx on public.branch_day_metrics (biz_id, metric_date desc);

-- 4. Дневные метрики бизнесов
create table if not exists public.biz_day_metrics (
    id uuid primary key default gen_random_uuid(),
    biz_id uuid not null references public.businesses (id) on delete cascade,
    
    -- Дата метрики
    metric_date date not null,
    
    -- Агрегированные метрики от филиалов бизнеса
    avg_branch_score numeric(5, 2), -- средний рейтинг филиалов
    total_clients_count integer not null default 0, -- общее количество клиентов
    total_revenue numeric(12, 2) not null default 0, -- общая выручка
    avg_rating numeric(3, 2), -- средняя оценка по всем отзывам бизнеса
    total_reviews_count integer not null default 0, -- общее количество отзывов
    
    -- Рассчитанный дневной рейтинг бизнеса (0-100)
    day_score numeric(5, 2),
    
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),
    
    unique (biz_id, metric_date)
);

comment on table public.biz_day_metrics is 'Дневные метрики бизнесов для расчета рейтинга';
create index if not exists biz_day_metrics_biz_date_idx on public.biz_day_metrics (biz_id, metric_date desc);

-- 5. Добавляем поля rating_score в существующие таблицы
alter table public.staff
add column if not exists rating_score numeric(5, 2),
add column if not exists rating_updated_at timestamptz;

comment on column public.staff.rating_score is 'Текущий рейтинг сотрудника (0-100), рассчитанный за последние 30 дней';
comment on column public.staff.rating_updated_at is 'Время последнего обновления рейтинга';

alter table public.branches
add column if not exists rating_score numeric(5, 2),
add column if not exists rating_updated_at timestamptz;

comment on column public.branches.rating_score is 'Текущий рейтинг филиала (0-100), рассчитанный за последние 30 дней';
comment on column public.branches.rating_updated_at is 'Время последнего обновления рейтинга';

alter table public.businesses
add column if not exists rating_score numeric(5, 2),
add column if not exists rating_updated_at timestamptz;

comment on column public.businesses.rating_score is 'Текущий рейтинг бизнеса (0-100), рассчитанный за последние 30 дней';
comment on column public.businesses.rating_updated_at is 'Время последнего обновления рейтинга';

-- Индексы для сортировки по рейтингу
create index if not exists staff_rating_score_idx on public.staff (rating_score desc nulls last) where is_active = true;
create index if not exists branches_rating_score_idx on public.branches (rating_score desc nulls last) where is_active = true;
create index if not exists businesses_rating_score_idx on public.businesses (rating_score desc nulls last) where is_approved = true;

-- Триггеры для обновления updated_at
drop trigger if exists set_timestamp_updated_at_staff_day_metrics on public.staff_day_metrics;
create trigger set_timestamp_updated_at_staff_day_metrics
before update on public.staff_day_metrics
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists set_timestamp_updated_at_branch_day_metrics on public.branch_day_metrics;
create trigger set_timestamp_updated_at_branch_day_metrics
before update on public.branch_day_metrics
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists set_timestamp_updated_at_biz_day_metrics on public.biz_day_metrics;
create trigger set_timestamp_updated_at_biz_day_metrics
before update on public.biz_day_metrics
for each row
execute function public.set_timestamp_updated_at();

drop trigger if exists set_timestamp_updated_at_rating_config on public.rating_global_config;
create trigger set_timestamp_updated_at_rating_config
before update on public.rating_global_config
for each row
execute function public.set_timestamp_updated_at();

-- RLS политики
alter table public.rating_global_config enable row level security;
alter table public.staff_day_metrics enable row level security;
alter table public.branch_day_metrics enable row level security;
alter table public.biz_day_metrics enable row level security;

-- Глобальные настройки: только суперадмин может изменять, все могут читать
drop policy if exists "Rating config select all" on public.rating_global_config;
create policy "Rating config select all"
    on public.rating_global_config
    for select
    to authenticated
    using (true);

drop policy if exists "Rating config modify superadmin" on public.rating_global_config;
create policy "Rating config modify superadmin"
    on public.rating_global_config
    for all
    to authenticated
    using (
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    )
    with check (
        exists (
            select 1
            from public.user_roles_with_user ur
            where ur.user_id = auth.uid()
              and ur.role_key = 'super_admin'
              and ur.biz_id is null
        )
    );

-- Дневные метрики: владельцы бизнесов могут читать свои метрики
drop policy if exists "Staff day metrics select owners" on public.staff_day_metrics;
create policy "Staff day metrics select owners"
    on public.staff_day_metrics
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
    );

drop policy if exists "Branch day metrics select owners" on public.branch_day_metrics;
create policy "Branch day metrics select owners"
    on public.branch_day_metrics
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
    );

drop policy if exists "Biz day metrics select owners" on public.biz_day_metrics;
create policy "Biz day metrics select owners"
    on public.biz_day_metrics
    for select
    to authenticated
    using (
        exists (
            select 1
            from public.businesses b
            where b.id = biz_id
              and b.owner_id = auth.uid()
        )
    );

-- Публичный доступ к рейтингам (для сортировки на публичке)
-- Рейтинги в staff, branches, businesses уже доступны через существующие политики

