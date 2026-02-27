-- Создание таблицы часовой загрузки по бизнесу и филиалам
--
-- Цели:
-- 1. Хранить агрегированную загрузку по часам для heatmap и аналитики расписания.
-- 2. Разделять метрики по бизнесу и филиалам.
-- 3. Быстро отвечать на запросы админ‑dashboard без тяжёлых JOIN по бронированиям.

create table if not exists public.business_hourly_load (
    -- Идентификаторы
    biz_id uuid not null references public.businesses (id) on delete cascade,
    branch_id uuid not null references public.branches (id) on delete cascade,
    date date not null,
    hour int not null check (hour >= 0 and hour <= 23),

    -- Метрики загрузки (см. A2.1)
    bookings_count integer not null default 0,          -- количество успешных бронирований, начавшихся в этот час
    promo_bookings_count integer not null default 0,    -- из них с применённым промо (has_promotion = true)

    -- Дополнительные агрегаты (резерв под развитие)
    staff_count integer,                 -- опционально: количество уникальных сотрудников с бронированиями в этот час
    unique_clients_count integer,        -- опционально: количество уникальных клиентов в этот час

    created_at timestamptz not null default timezone('utc'::text, now()),
    updated_at timestamptz not null default timezone('utc'::text, now()),

    constraint business_hourly_load_pkey primary key (biz_id, branch_id, date, hour)
);

comment on table public.business_hourly_load is
    'Часовая загрузка по бизнесам и филиалам для heatmap и аналитики расписания.';

comment on column public.business_hourly_load.biz_id is
    'Бизнес, к которому относится агрегат.';

comment on column public.business_hourly_load.branch_id is
    'Филиал, для которого рассчитана загрузка.';

comment on column public.business_hourly_load.date is
    'Календарная дата (в таймзоне бизнеса), за которую посчитаны метрики.';

comment on column public.business_hourly_load.hour is
    'Час (0–23) в таймзоне бизнеса, к которому относится агрегат.';

comment on column public.business_hourly_load.bookings_count is
    'Количество успешных бронирований (статусы confirmed/paid), начавшихся в этот час.';

comment on column public.business_hourly_load.promo_bookings_count is
    'Количество успешных бронирований с промо (has_promotion = true), начавшихся в этот час.';

comment on column public.business_hourly_load.staff_count is
    'Количество уникальных сотрудников с бронированиями в этот час (опционально заполняется при агрегации).';

comment on column public.business_hourly_load.unique_clients_count is
    'Количество уникальных клиентов в этот час (опционально заполняется при агрегации).';

-- Индекс для выборок по бизнесу/филиалу и диапазону дат
create index if not exists business_hourly_load_biz_branch_date_idx
    on public.business_hourly_load (biz_id, branch_id, date);

