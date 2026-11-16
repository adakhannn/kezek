-- Добавляем поле ставки за час в таблицу staff
-- Если указано, сотрудник получает оплату за выход (гарантированная сумма)

alter table public.staff
add column if not exists hourly_rate numeric(10, 2);

comment on column public.staff.hourly_rate is 'Ставка за час работы (сом/час). Если указана, сотрудник получает оплату за выход.';

-- Добавляем поля в staff_shifts для хранения информации о доплате за выход
alter table public.staff_shifts
add column if not exists hours_worked numeric(6, 2),
add column if not exists hourly_rate numeric(10, 2),
add column if not exists guaranteed_amount numeric(12, 2) not null default 0,
add column if not exists topup_amount numeric(12, 2) not null default 0;

comment on column public.staff_shifts.hours_worked is 'Количество отработанных часов (от opened_at до closed_at)';
comment on column public.staff_shifts.hourly_rate is 'Ставка за час на момент закрытия смены (копия из staff.hourly_rate)';
comment on column public.staff_shifts.guaranteed_amount is 'Гарантированная сумма за выход (hours_worked × hourly_rate)';
comment on column public.staff_shifts.topup_amount is 'Доплата владельца, если guaranteed_amount > master_share';

