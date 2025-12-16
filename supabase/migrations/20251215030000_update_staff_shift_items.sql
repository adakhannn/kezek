-- Обновление таблицы staff_shift_items: добавляем расходники по клиенту и связь с booking

alter table public.staff_shift_items
add column if not exists consumables_amount numeric(12, 2) not null default 0,
add column if not exists booking_id uuid references public.bookings (id) on delete set null;

comment on column public.staff_shift_items.consumables_amount is 'Расходники для этого конкретного клиента';
comment on column public.staff_shift_items.booking_id is 'Связь с записью (booking), если клиент был записан';

-- Переименуем amount в service_amount для ясности
alter table public.staff_shift_items
rename column amount to service_amount;

comment on column public.staff_shift_items.service_amount is 'Сумма за услугу для этого клиента';

