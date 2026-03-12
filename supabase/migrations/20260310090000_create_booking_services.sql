-- Создаём таблицу для состава услуг бронирования: booking_services
-- См. docs/SERVICE_COMPLEXES_FEATURE.md (раздел 3.2 \"Схема БД\").

create table if not exists public.booking_services (
    id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references public.bookings(id) on delete cascade,
    service_id uuid not null references public.services(id) on delete restrict,
    duration_min integer not null,
    order_index integer not null default 0,
    price_from numeric(10, 2),
    price_to numeric(10, 2),
    created_at timestamptz not null default now()
);

comment on table public.booking_services is
    'Состав услуг по каждому бронированию (комплексы услуг, несколько услуг за один визит).';

comment on column public.booking_services.booking_id is
    'ID бронирования (public.bookings), к которому относится услуга.';

comment on column public.booking_services.service_id is
    'ID услуги (public.services), зафиксированной в составе брони.';

comment on column public.booking_services.duration_min is
    'Длительность этой услуги на момент создания бронирования (в минутах).';

comment on column public.booking_services.order_index is
    'Порядок выполнения услуги в рамках одного визита (0, 1, 2, ...).';

comment on column public.booking_services.price_from is
    'Цена \"от\" для услуги на момент бронирования (для отображения истории).';

comment on column public.booking_services.price_to is
    'Цена \"до\" для услуги на момент бронирования (для отображения истории).';

create index if not exists idx_booking_services_booking_id
    on public.booking_services (booking_id);

create index if not exists idx_booking_services_booking_id_order_index
    on public.booking_services (booking_id, order_index);

