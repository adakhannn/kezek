-- Проверка клиентов для сотрудника dcdd97f0-bda8-464c-904d-84606a9b15a7
-- Используйте этот файл для проверки данных через SQL Editor в Supabase

-- 1. Все смены сотрудника (последние сверху)
SELECT 
    s.id AS shift_id,
    s.shift_date,
    s.status,
    s.opened_at,
    s.closed_at,
    s.total_amount,
    s.consumables_amount,
    s.master_share,
    s.salon_share,
    COUNT(ssi.id) AS items_count,
    COALESCE(SUM(ssi.service_amount), 0) AS items_service_sum,
    COALESCE(SUM(ssi.consumables_amount), 0) AS items_consumables_sum
FROM public.staff_shifts s
LEFT JOIN public.staff_shift_items ssi ON ssi.shift_id = s.id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
GROUP BY s.id, s.shift_date, s.status, s.opened_at, s.closed_at, s.total_amount, s.consumables_amount, s.master_share, s.salon_share
ORDER BY s.shift_date DESC, s.created_at DESC;

-- 2. Все клиенты (items) для всех смен сотрудника
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
ORDER BY s.shift_date DESC, ssi.created_at DESC;

-- 3. Клиенты за конкретную дату (например, 08.02.2026)
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
  AND s.shift_date = '2026-02-08'
ORDER BY ssi.created_at DESC;

-- 4. Открытая смена на сегодня (или за указанную дату)
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
  -- Раскомментируйте для проверки конкретной даты:
  -- AND s.shift_date = '2026-02-08'
GROUP BY s.id, s.shift_date, s.status, s.opened_at
ORDER BY s.shift_date DESC
LIMIT 1;

-- 5. Клиенты открытой смены
SELECT 
    ssi.id,
    ssi.shift_id,
    s.shift_date,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.created_at
FROM public.staff_shift_items ssi
JOIN public.staff_shifts s ON s.id = ssi.shift_id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  AND s.status = 'open'
  -- Раскомментируйте для проверки конкретной даты:
  -- AND s.shift_date = '2026-02-08'
ORDER BY ssi.created_at DESC;

-- 6. Проверка удаленных клиентов (история изменений через аудит, если есть)
-- Если есть таблица аудита, можно проверить удаления
-- SELECT * FROM audit.staff_shift_items 
-- WHERE staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
--   AND action = 'DELETE'
-- ORDER BY changed_at DESC;

-- 7. Сверка: сумма в смене vs сумма в items
SELECT 
    s.id AS shift_id,
    s.shift_date,
    s.status,
    s.total_amount AS shift_total,
    s.consumables_amount AS shift_consumables,
    COALESCE(SUM(ssi.service_amount), 0) AS items_service_sum,
    COALESCE(SUM(ssi.consumables_amount), 0) AS items_consumables_sum,
    (s.total_amount - COALESCE(SUM(ssi.service_amount), 0)) AS service_diff,
    (s.consumables_amount - COALESCE(SUM(ssi.consumables_amount), 0)) AS consumables_diff,
    COUNT(ssi.id) AS items_count
FROM public.staff_shifts s
LEFT JOIN public.staff_shift_items ssi ON ssi.shift_id = s.id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  -- Раскомментируйте для проверки конкретной даты:
  -- AND s.shift_date = '2026-02-08'
GROUP BY s.id, s.shift_date, s.status, s.total_amount, s.consumables_amount
ORDER BY s.shift_date DESC;

