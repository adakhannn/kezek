-- Добавляем поля процентов распределения в таблицу staff
-- Эти проценты используются при закрытии смены для расчета долей мастера и салона

alter table public.staff
add column if not exists percent_master numeric(5, 2) not null default 60,
add column if not exists percent_salon numeric(5, 2) not null default 40;

comment on column public.staff.percent_master is 'Процент от чистой суммы (после расходников), который идет мастеру';
comment on column public.staff.percent_salon is 'Процент от чистой суммы (после расходников), который идет салону';

-- Проверка: сумма процентов должна быть 100
alter table public.staff
add constraint staff_percent_sum_check check (
    (percent_master + percent_salon) = 100
);

