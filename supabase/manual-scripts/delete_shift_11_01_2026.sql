-- Удаление смены от 11.01.2026
-- ВНИМАНИЕ: Это удалит смену и все связанные данные (позиции клиентов)

-- Сначала проверим, что будем удалять
SELECT 
    id,
    staff_id,
    shift_date,
    status,
    opened_at,
    closed_at,
    hours_worked,
    hourly_rate,
    guaranteed_amount,
    master_share,
    salon_share,
    total_amount
FROM public.staff_shifts
WHERE shift_date = '2026-01-11'
  -- Раскомментируйте и укажите ID сотрудника, если нужно удалить только его смену:
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY opened_at DESC;

-- Проверяем связанные позиции (клиентов)
SELECT 
    ssi.id,
    ssi.shift_id,
    ssi.client_name,
    ssi.service_name,
    ssi.service_amount,
    ss.shift_date
FROM public.staff_shift_items ssi
JOIN public.staff_shifts ss ON ss.id = ssi.shift_id
WHERE ss.shift_date = '2026-01-11'
  -- Раскомментируйте и укажите ID сотрудника, если нужно:
  -- AND ss.staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
ORDER BY ssi.created_at ASC;

-- Удаляем позиции (клиентов) для смены от 11.01.2026
-- Это нужно сделать перед удалением смены из-за foreign key constraints
DELETE FROM public.staff_shift_items
WHERE shift_id IN (
    SELECT id 
    FROM public.staff_shifts 
    WHERE shift_date = '2026-01-11'
      -- Раскомментируйте и укажите ID сотрудника, если нужно:
      -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
);

-- Удаляем смену от 11.01.2026
DELETE FROM public.staff_shifts
WHERE shift_date = '2026-01-11'
  -- Раскомментируйте и укажите ID сотрудника, если нужно удалить только его смену:
  -- AND staff_id = '41a2a539-fa66-4978-ae59-962b9c2bd34d'
RETURNING 
    id, 
    shift_date, 
    status, 
    staff_id;

-- Проверяем, что смена удалена
SELECT 
    id,
    shift_date,
    status
FROM public.staff_shifts
WHERE shift_date = '2026-01-11';

