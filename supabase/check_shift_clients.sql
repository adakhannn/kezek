-- Проверка клиентов для конкретной смены
-- Shift ID: d3ae6a79-b4f6-4a48-b5ca-18ae0e2b43c8

-- 1. Проверяем, есть ли клиенты для этой смены
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.created_at,
    ssi.note
FROM public.staff_shift_items ssi
WHERE ssi.shift_id = 'd3ae6a79-b4f6-4a48-b5ca-18ae0e2b43c8'
ORDER BY ssi.created_at DESC;

-- 2. Проверяем количество клиентов
SELECT 
    COUNT(*) AS items_count,
    COALESCE(SUM(ssi.service_amount), 0) AS total_service_amount,
    COALESCE(SUM(ssi.consumables_amount), 0) AS total_consumables_amount
FROM public.staff_shift_items ssi
WHERE ssi.shift_id = 'd3ae6a79-b4f6-4a48-b5ca-18ae0e2b43c8';

-- 3. Проверяем все смены этого сотрудника за 2026-02-08
SELECT 
    s.id,
    s.shift_date,
    s.status,
    s.total_amount,
    s.consumables_amount,
    COUNT(ssi.id) AS items_count
FROM public.staff_shifts s
LEFT JOIN public.staff_shift_items ssi ON ssi.shift_id = s.id
WHERE s.staff_id = 'dcdd97f0-bda8-464c-904d-84606a9b15a7'
  AND s.shift_date = '2026-02-08'
GROUP BY s.id, s.shift_date, s.status, s.total_amount, s.consumables_amount;

-- 4. Проверяем, не были ли клиенты удалены (если есть таблица аудита)
-- SELECT * FROM audit.staff_shift_items 
-- WHERE shift_id = 'd3ae6a79-b4f6-4a48-b5ca-18ae0e2b43c8'
--   AND action = 'DELETE'
-- ORDER BY changed_at DESC;

