-- Проверка данных смены сотрудника
-- Замените STAFF_ID на ID сотрудника (например, '41a2a539-fa66-4978-ae59-962b9c2bd34d')

-- 1. Проверяем все смены сотрудника (последние 10)
SELECT 
    id,
    shift_date,
    status,
    opened_at,
    closed_at,
    total_amount,
    consumables_amount,
    master_share,
    salon_share,
    created_at
FROM public.staff_shifts
WHERE staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY shift_date DESC, created_at DESC
LIMIT 10;

-- 2. Проверяем открытую смену на сегодня
SELECT 
    id,
    shift_date,
    status,
    opened_at,
    closed_at,
    total_amount,
    consumables_amount,
    master_share,
    salon_share,
    percent_master,
    percent_salon,
    created_at
FROM public.staff_shifts
WHERE staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
  AND status = 'open'
ORDER BY shift_date DESC
LIMIT 1;

-- 3. Проверяем позиции (клиентов) для открытой смены
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.note,
    ssi.created_at,
    ss.shift_date,
    ss.status as shift_status
FROM public.staff_shift_items ssi
JOIN public.staff_shifts ss ON ss.id = ssi.shift_id
WHERE ss.staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
  AND ss.status = 'open'
ORDER BY ssi.created_at ASC;

-- 4. Проверяем все позиции для всех смен сотрудника (последние 20)
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.note,
    ssi.created_at,
    ss.shift_date,
    ss.status as shift_status
FROM public.staff_shift_items ssi
JOIN public.staff_shifts ss ON ss.id = ssi.shift_id
WHERE ss.staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY ss.shift_date DESC, ssi.created_at ASC
LIMIT 20;

-- 5. Проверяем, есть ли смены на конкретную дату (например, 2026-01-12)
SELECT 
    id,
    shift_date,
    status,
    opened_at,
    closed_at,
    total_amount,
    consumables_amount,
    master_share,
    salon_share,
    created_at
FROM public.staff_shifts
WHERE staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
  AND shift_date = '2026-01-12';

-- 6. Проверяем позиции для смены на конкретную дату
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ssi.consumables_amount,
    ssi.booking_id,
    ssi.note,
    ssi.created_at,
    ss.shift_date,
    ss.status as shift_status
FROM public.staff_shift_items ssi
JOIN public.staff_shifts ss ON ss.id = ssi.shift_id
WHERE ss.staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
  AND ss.shift_date = '2026-01-12';

-- 7. Проверяем сегодняшнюю дату в БД (для сравнения)
SELECT 
    CURRENT_DATE as today_db,
    timezone('Asia/Bishkek', now())::date as today_tz,
    format(timezone('Asia/Bishkek', now()), 'YYYY-MM-DD') as today_formatted;

