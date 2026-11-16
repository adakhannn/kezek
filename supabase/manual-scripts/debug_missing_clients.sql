-- Отладка пропавших клиентов для сотрудника dcdd97f0-bda8-464c-904d-84606a9b15a7

-- 1. Проверяем, есть ли смена за 2026-02-08
SELECT 
    s.id AS shift_id,
    s.shift_date,
    s.status,
    s.opened_at,
    s.closed_at,
    s.total_amount,
    s.consumables_amount,
    s.created_at,
    s.updated_at
FROM public.staff_shifts s
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  AND s.shift_date = '2026-02-08';

-- 2. Проверяем все смены этого сотрудника (последние 10)
SELECT 
    s.id AS shift_id,
    s.shift_date,
    s.status,
    s.total_amount,
    COUNT(ssi.id) AS items_count
FROM public.staff_shifts s
LEFT JOIN public.staff_shift_items ssi ON ssi.shift_id = s.id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
GROUP BY s.id, s.shift_date, s.status, s.total_amount
ORDER BY s.shift_date DESC, s.created_at DESC
LIMIT 10;

-- 3. Проверяем ВСЕ клиенты этого сотрудника (независимо от даты)
SELECT 
    ssi.id,
    ssi.shift_id,
    s.shift_date,
    s.status AS shift_status,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.created_at,
    ssi.note
FROM public.staff_shift_items ssi
JOIN public.staff_shifts s ON s.id = ssi.shift_id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
ORDER BY s.shift_date DESC, ssi.created_at DESC
LIMIT 50;

-- 4. Проверяем, есть ли клиенты для смены за 2026-02-08 (если смена существует)
-- Сначала найдем shift_id для этой даты
WITH shift_for_date AS (
    SELECT id, shift_date, status
    FROM public.staff_shifts
    WHERE staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
      AND shift_date = '2026-02-08'
    LIMIT 1
)
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.created_at
FROM public.staff_shift_items ssi
JOIN shift_for_date sfd ON sfd.id = ssi.shift_id
ORDER BY ssi.created_at DESC;

-- 5. Проверяем открытые смены этого сотрудника
SELECT 
    s.id AS shift_id,
    s.shift_date,
    s.status,
    s.opened_at,
    COUNT(ssi.id) AS items_count
FROM public.staff_shifts s
LEFT JOIN public.staff_shift_items ssi ON ssi.shift_id = s.id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  AND s.status = 'open'
GROUP BY s.id, s.shift_date, s.status, s.opened_at
ORDER BY s.shift_date DESC;

-- 6. Проверяем клиенты открытых смен
SELECT 
    ssi.id,
    ssi.shift_id,
    s.shift_date,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.created_at
FROM public.staff_shift_items ssi
JOIN public.staff_shifts s ON s.id = ssi.shift_id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  AND s.status = 'open'
ORDER BY s.shift_date DESC, ssi.created_at DESC;

-- 7. Проверяем, не были ли клиенты удалены через каскадное удаление смены
-- (если смена была удалена, клиенты тоже удалились бы)
-- Проверяем логи или историю (если есть таблица аудита)

-- 8. Проверяем последние изменения в staff_shift_items для этого сотрудника
-- (если есть updated_at или аудит)
SELECT 
    ssi.id,
    ssi.shift_id,
    s.shift_date,
    ssi.client_name,
    ssi.service_name,
    ssi.created_at
FROM public.staff_shift_items ssi
JOIN public.staff_shifts s ON s.id = ssi.shift_id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
ORDER BY ssi.created_at DESC
LIMIT 20;

