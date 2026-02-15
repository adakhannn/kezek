-- Исправление данных перед применением миграции с ограничениями
-- Находит и исправляет строки с некорректными значениями hours_worked

-- 1. Найти проблемные строки
SELECT 
    id,
    staff_id,
    shift_date,
    hours_worked,
    status,
    created_at
FROM public.staff_shifts
WHERE hours_worked IS NOT NULL 
  AND (hours_worked < 0 OR hours_worked > 24)
ORDER BY created_at DESC;

-- 2. Исправить отрицательные значения (установить в 0)
UPDATE public.staff_shifts
SET hours_worked = 0
WHERE hours_worked IS NOT NULL 
  AND hours_worked < 0;

-- 3. Исправить значения больше 24 часов (установить в 24)
UPDATE public.staff_shifts
SET hours_worked = 24
WHERE hours_worked IS NOT NULL 
  AND hours_worked > 24;

-- 4. Проверка после исправления
SELECT 
    COUNT(*) as total_shifts,
    COUNT(*) FILTER (WHERE hours_worked IS NULL) as null_hours,
    COUNT(*) FILTER (WHERE hours_worked IS NOT NULL AND hours_worked >= 0 AND hours_worked <= 24) as valid_hours,
    COUNT(*) FILTER (WHERE hours_worked IS NOT NULL AND (hours_worked < 0 OR hours_worked > 24)) as invalid_hours
FROM public.staff_shifts;

