-- Создание таблицы для хранения событий воронки и бизнес‑аналитики
--
-- Цели:
-- 1. Единое хранилище сырых событий (frontend + backend) по воронке booking‑флоу.
-- 2. База для последующих агрегатов `business_daily_stats` и `business_hourly_load`.
-- 3. Минимально достаточные индексы для выборок по бизнесу, филиалу, типу события и времени.

-- Таблица сырых событий аналитики
create table if not exists public.analytics_events (
    id uuid primary key default gen_random_uuid(),

    -- Время фиксации события (UTC)
    created_at timestamptz not null default timezone('utc'::text, now()),

    -- Тип события (см. словарь событий в BUSINESS_ANALYTICS_DASHBOARD_PLAN.md, раздел A1.1)
    event_type text not null,

    -- Привязка к бизнесу / филиалу / бронированию
    biz_id uuid null,
    branch_id uuid null,
    booking_id uuid null,

    -- Клиент и источник события
    client_id uuid null,
    source text not null,          -- 'web', 'mobile', 'staff_dashboard', 'system' и т.п.
    session_id text null,

    -- Дополнительные данные события:
    -- шаг флоу, locale, реферальная информация, A/B‑флаги и т.д.
    metadata jsonb not null default '{}'::jsonb
);

comment on table public.analytics_events is 'Сырые события воронки и бизнес‑аналитики (frontend + backend).';
comment on column public.analytics_events.created_at is 'Время фиксации события (UTC).';
comment on column public.analytics_events.event_type is 'Тип события: home_view, business_page_view, booking_flow_start, booking_flow_step, booking_created, booking_confirmed_or_paid и т.п.';
comment on column public.analytics_events.biz_id is 'Бизнес, к которому относится событие (если применимо).';
comment on column public.analytics_events.branch_id is 'Филиал, к которому относится событие (если применимо).';
comment on column public.analytics_events.booking_id is 'Бронирование, к которому относится событие (если применимо).';
comment on column public.analytics_events.client_id is 'Клиент (если известен / авторизован).';
comment on column public.analytics_events.source is 'Источник события: web, mobile, staff_dashboard, system и т.п.';
comment on column public.analytics_events.session_id is 'Сессия пользователя (для построения воронки).';
comment on column public.analytics_events.metadata is 'Дополнительные данные события в формате JSON (step, locale, referrer, A/B‑флаги и т.д.).';

-- Индексы для типичных сценариев выборки

-- По бизнесу и времени: основной скоуп для агрегатов по бизнесу
create index if not exists analytics_events_biz_date_idx
    on public.analytics_events (biz_id, created_at desc)
    where biz_id is not null;

-- По филиалу и времени: агрегаты в разрезе филиалов
create index if not exists analytics_events_branch_date_idx
    on public.analytics_events (branch_id, created_at desc)
    where branch_id is not null;

-- По типу события и времени: выборки по конкретному шагу воронки
create index if not exists analytics_events_type_date_idx
    on public.analytics_events (event_type, created_at desc);

-- По времени: общий индекс для “скользящих окон” по дате
create index if not exists analytics_events_created_at_idx
    on public.analytics_events (created_at desc);

-- По сессии и времени: построение воронок в рамках сессии
create index if not exists analytics_events_session_date_idx
    on public.analytics_events (session_id, created_at desc)
    where session_id is not null;

-- Включаем RLS и даём доступ только service_role (для внутренних API/cron‑джобов)
alter table public.analytics_events enable row level security;

drop policy if exists "Analytics events select all for service_role" on public.analytics_events;

create policy "Analytics events select all for service_role"
    on public.analytics_events
    for select
    to service_role
    using (true);

