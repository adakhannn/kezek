-- Создание таблицы дневных агрегатов по бизнесу
--
-- Цели:
-- 1. Хранить предрасчитанные KPI по воронке и выручке в разрезе бизнеса и дня.
-- 2. Быстро отдавать данные для разделов "Обзор" и "Фанел" админ‑dashboard.
-- 3. Минимизировать нагрузку на сырые события (`analytics_events`) и бронирования (`bookings`).

create table if not exists public.business_daily_stats (
    -- Идентификаторы
    biz_id uuid not null references public.businesses (id) on delete cascade,
    date date not null,

    -- Метрики воронки за день
    home_views integer not null default 0,
    business_page_views integer not null default 0,
    booking_flow_starts integer not null default 0,
    bookings_created integer not null default 0,
    bookings_confirmed_or_paid integer not null default 0,

    -- Метрики промо и выручки за день
    promo_bookings integer not null default 0,
    promo_revenue numeric(14,2) not null default 0,  -- сумма фактической выручки по бронированиям с промо
    total_revenue numeric(14,2) not null default 0,  -- общая выручка по успешным бронированиям (с промо и без)

    -- Служебные поля
    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),

    constraint business_daily_stats_pkey primary key (biz_id, date)
);

comment on table public.business_daily_stats is
    'Дневные агрегаты по бизнесу: воронка и выручка за день для admin-analytics.';

comment on column public.business_daily_stats.biz_id is
    'Бизнес, к которому относятся агрегированные метрики.';

comment on column public.business_daily_stats.date is
    'Календарная дата (в таймзоне бизнеса), за которую посчитаны метрики.';

comment on column public.business_daily_stats.home_views is
    'Количество событий home_view (просмотры главной/списка бизнесов), отнесённых к этому бизнесу за день.';

comment on column public.business_daily_stats.business_page_views is
    'Количество событий business_page_view (просмотры страницы бизнеса) за день.';

comment on column public.business_daily_stats.booking_flow_starts is
    'Количество начатых потоков бронирования (booking_flow_start) за день.';

comment on column public.business_daily_stats.bookings_created is
    'Количество созданных бронирований (booking_created) за день.';

comment on column public.business_daily_stats.bookings_confirmed_or_paid is
    'Количество бронирований, перешедших в статус confirmed или paid, за день.';

comment on column public.business_daily_stats.promo_bookings is
    'Количество успешных бронирований за день, к которым было применено промо (has_promotion = true).';

comment on column public.business_daily_stats.promo_revenue is
    'Суммарная выручка за день по бронированиям с промо (booking_final_amount по has_promotion = true).';

comment on column public.business_daily_stats.total_revenue is
    'Суммарная выручка за день по всем успешным бронированиям (с промо и без).';

comment on column public.business_daily_stats.created_at is
    'Время первой инициализации агрегатов за дату.';

comment on column public.business_daily_stats.updated_at is
    'Время последнего пересчёта агрегатов за дату.';

-- Дополнительный индекс по дате (для выборок по всему пулу бизнесов)
create index if not exists business_daily_stats_date_idx
    on public.business_daily_stats (date);

