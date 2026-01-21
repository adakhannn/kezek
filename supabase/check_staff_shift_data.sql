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

-- 8. Сверка итогов смены и позиций (для конкретной даты)
-- Замените STAFF_ID и SHIFT_DATE на нужные значения
WITH shift AS (
    SELECT 
        id,
        shift_date,
        status,
        total_amount,
        consumables_amount,
        master_share,
        salon_share,
        hours_worked,
        guaranteed_amount,
        topup_amount
    FROM public.staff_shifts
    WHERE staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
      AND shift_date = '2026-01-12'
),
items AS (
    SELECT 
        ssi.shift_id,
        SUM(ssi.service_amount)       AS sum_service_amount,
        SUM(ssi.consumables_amount)   AS sum_consumables_amount,
        COUNT(*)                      AS items_count
    FROM public.staff_shift_items ssi
    JOIN shift s ON s.id = ssi.shift_id
    GROUP BY ssi.shift_id
)
SELECT 
    s.id               AS shift_id,
    s.shift_date,
    s.status,
    s.total_amount,
    i.sum_service_amount,
    (s.total_amount - COALESCE(i.sum_service_amount, 0)) AS total_vs_items_diff,
    s.consumables_amount,
    i.sum_consumables_amount,
    (s.consumables_amount - COALESCE(i.sum_consumables_amount, 0)) AS consumables_vs_items_diff,
    s.master_share,
    s.salon_share,
    s.hours_worked,
    s.guaranteed_amount,
    s.topup_amount,
    i.items_count
FROM shift s
LEFT JOIN items i ON s.id = i.shift_id;

-- 9. Сверка смены и статусов бронирований (для конкретной даты)
-- Показывает, какие брони попали в смену, а какие помечены как no_show / paid вне смены
WITH params AS (
    SELECT 
        '41a2a539-fa66-4978-ae59-962b9c2bd34d'::uuid AS staff_id,
        '2026-01-12'::date                          AS shift_date
),
day_bookings AS (
    SELECT 
        b.id,
        b.staff_id,
        b.status,
        b.start_at,
        b.promotion_applied
    FROM public.bookings b
    JOIN params p ON p.staff_id = b.staff_id
    WHERE timezone('Asia/Bishkek', b.start_at)::date = p.shift_date
      AND b.status <> 'cancelled'
),
shift_for_day AS (
    SELECT s.id
    FROM public.staff_shifts s
    JOIN params p ON p.staff_id = s.staff_id
    WHERE s.shift_date = p.shift_date
    ORDER BY s.created_at DESC
    LIMIT 1
),
items_links AS (
    SELECT 
        ssi.booking_id
    FROM public.staff_shift_items ssi
    JOIN shift_for_day s ON s.id = ssi.shift_id
    WHERE ssi.booking_id IS NOT NULL
)
SELECT 
    db.id               AS booking_id,
    db.status           AS booking_status,
    db.start_at,
    CASE 
        WHEN il.booking_id IS NOT NULL THEN true
        ELSE false
    END                 AS in_shift_items,
    db.promotion_applied
FROM day_bookings db
LEFT JOIN items_links il ON il.booking_id = db.id
ORDER BY db.start_at;

