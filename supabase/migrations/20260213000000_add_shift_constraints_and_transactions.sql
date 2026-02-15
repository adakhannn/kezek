-- Добавление CHECK-ограничений и обеспечение транзакционности операций
-- 
-- Проблемы:
-- 1. Нет ограничений на уровне БД для проверки валидности данных
-- 2. Операции сохранения items не атомарны
-- 3. Нет защиты от некорректных значений сумм
--
-- Решения:
-- 1. Добавить CHECK-ограничения на неотрицательные суммы и максимальные значения
-- 2. Создать функцию для атомарного сохранения items
-- 3. Убедиться, что все операции выполняются в транзакциях

-- ============================================================================
-- ИСПРАВЛЕНИЕ ДАННЫХ ПЕРЕД ДОБАВЛЕНИЕМ ОГРАНИЧЕНИЙ
-- ============================================================================

-- Исправление некорректных значений hours_worked перед добавлением CHECK constraint
-- Это необходимо, так как существующие данные могут нарушать новые ограничения
DO $$
BEGIN
    -- Исправить отрицательные значения (установить в 0)
    UPDATE public.staff_shifts
    SET hours_worked = 0
    WHERE hours_worked IS NOT NULL 
      AND hours_worked < 0;
    
    -- Исправить значения больше 24 часов (установить в 24)
    UPDATE public.staff_shifts
    SET hours_worked = 24
    WHERE hours_worked IS NOT NULL 
      AND hours_worked > 24;
END $$;

-- ============================================================================
-- CHECK-ограничения для таблицы staff_shifts
-- ============================================================================

-- Проверка неотрицательных сумм
alter table public.staff_shifts
add constraint staff_shifts_total_amount_nonnegative
    check (total_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_consumables_amount_nonnegative
    check (consumables_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_master_share_nonnegative
    check (master_share >= 0);

alter table public.staff_shifts
add constraint staff_shifts_salon_share_nonnegative
    check (salon_share >= 0);

alter table public.staff_shifts
add constraint staff_shifts_guaranteed_amount_nonnegative
    check (guaranteed_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_topup_amount_nonnegative
    check (topup_amount >= 0);

alter table public.staff_shifts
add constraint staff_shifts_late_minutes_nonnegative
    check (late_minutes >= 0);

-- Проверка максимальных значений (защита от переполнения)
-- Максимальная сумма: 999,999,999,999.99 (12 цифр, 2 знака после запятой)
alter table public.staff_shifts
add constraint staff_shifts_total_amount_max
    check (total_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_consumables_amount_max
    check (consumables_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_master_share_max
    check (master_share <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_salon_share_max
    check (salon_share <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_guaranteed_amount_max
    check (guaranteed_amount <= 999999999999.99);

alter table public.staff_shifts
add constraint staff_shifts_topup_amount_max
    check (topup_amount <= 999999999999.99);

-- Проверка процентов (должны быть в диапазоне 0-100)
alter table public.staff_shifts
add constraint staff_shifts_percent_master_range
    check (percent_master >= 0 and percent_master <= 100);

alter table public.staff_shifts
add constraint staff_shifts_percent_salon_range
    check (percent_salon >= 0 and percent_salon <= 100);

-- Проверка часов работы (неотрицательное значение, максимум 24 часа в день)
alter table public.staff_shifts
add constraint staff_shifts_hours_worked_range
    check (hours_worked is null or (hours_worked >= 0 and hours_worked <= 24));

-- Проверка hourly_rate (неотрицательное значение)
alter table public.staff_shifts
add constraint staff_shifts_hourly_rate_nonnegative
    check (hourly_rate is null or hourly_rate >= 0);

-- Проверка логики: если смена закрыта, должна быть указана closed_at
alter table public.staff_shifts
add constraint staff_shifts_closed_at_required
    check (status != 'closed' or closed_at is not null);

-- Проверка логики: если смена открыта, должна быть указана opened_at
alter table public.staff_shifts
add constraint staff_shifts_opened_at_required
    check (status != 'open' or opened_at is not null);

-- ============================================================================
-- CHECK-ограничения для таблицы staff_shift_items
-- ============================================================================

-- Проверка неотрицательных сумм
alter table public.staff_shift_items
add constraint staff_shift_items_service_amount_nonnegative
    check (service_amount >= 0);

alter table public.staff_shift_items
add constraint staff_shift_items_consumables_amount_nonnegative
    check (consumables_amount >= 0);

-- Проверка максимальных значений
alter table public.staff_shift_items
add constraint staff_shift_items_service_amount_max
    check (service_amount <= 999999999999.99);

alter table public.staff_shift_items
add constraint staff_shift_items_consumables_amount_max
    check (consumables_amount <= 999999999999.99);

-- Проверка длины текстовых полей (защита от слишком длинных значений)
alter table public.staff_shift_items
add constraint staff_shift_items_client_name_length
    check (client_name is null or length(client_name) <= 500);

alter table public.staff_shift_items
add constraint staff_shift_items_service_name_length
    check (service_name is null or length(service_name) <= 500);

alter table public.staff_shift_items
add constraint staff_shift_items_note_length
    check (note is null or length(note) <= 2000);

-- ============================================================================
-- ПРИМЕЧАНИЕ: Функция save_shift_items_atomic вынесена в отдельную миграцию
-- 20260213000001_add_save_shift_items_function.sql для совместимости с Supabase CLI
-- ============================================================================
-- Комментарии к ограничениям
-- ============================================================================

comment on constraint staff_shifts_total_amount_nonnegative on public.staff_shifts is 'Сумма выручки не может быть отрицательной';
comment on constraint staff_shifts_consumables_amount_nonnegative on public.staff_shifts is 'Сумма расходников не может быть отрицательной';
comment on constraint staff_shifts_master_share_nonnegative on public.staff_shifts is 'Доля мастера не может быть отрицательной';
comment on constraint staff_shifts_salon_share_nonnegative on public.staff_shifts is 'Доля салона не может быть отрицательной';
comment on constraint staff_shifts_guaranteed_amount_nonnegative on public.staff_shifts is 'Гарантированная сумма не может быть отрицательной';
comment on constraint staff_shifts_topup_amount_nonnegative on public.staff_shifts is 'Доплата не может быть отрицательной';
comment on constraint staff_shifts_late_minutes_nonnegative on public.staff_shifts is 'Минуты опоздания не могут быть отрицательными';
comment on constraint staff_shifts_total_amount_max on public.staff_shifts is 'Максимальная сумма выручки: 999,999,999,999.99';
comment on constraint staff_shifts_percent_master_range on public.staff_shifts is 'Процент мастера должен быть в диапазоне 0-100';
comment on constraint staff_shifts_percent_salon_range on public.staff_shifts is 'Процент салона должен быть в диапазоне 0-100';
comment on constraint staff_shifts_hours_worked_range on public.staff_shifts is 'Часы работы должны быть в диапазоне 0-24';
comment on constraint staff_shifts_closed_at_required on public.staff_shifts is 'Закрытая смена должна иметь дату закрытия';
comment on constraint staff_shifts_opened_at_required on public.staff_shifts is 'Открытая смена должна иметь дату открытия';

comment on constraint staff_shift_items_service_amount_nonnegative on public.staff_shift_items is 'Сумма услуги не может быть отрицательной';
comment on constraint staff_shift_items_consumables_amount_nonnegative on public.staff_shift_items is 'Сумма расходников не может быть отрицательной';
comment on constraint staff_shift_items_service_amount_max on public.staff_shift_items is 'Максимальная сумма услуги: 999,999,999,999.99';
comment on constraint staff_shift_items_client_name_length on public.staff_shift_items is 'Имя клиента не может быть длиннее 500 символов';
comment on constraint staff_shift_items_service_name_length on public.staff_shift_items is 'Название услуги не может быть длиннее 500 символов';
comment on constraint staff_shift_items_note_length on public.staff_shift_items is 'Примечание не может быть длиннее 2000 символов';

