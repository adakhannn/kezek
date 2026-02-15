# Исправление данных перед применением миграции

## Проблема

Миграция `20260213000000_add_shift_constraints_and_transactions.sql` не может быть применена, потому что в таблице `staff_shifts` есть строки с некорректными значениями `hours_worked`:
- Отрицательные значения (< 0)
- Значения больше 24 часов (> 24)

## Решение

### Шаг 1: Проверьте проблемные данные

Выполните в Supabase SQL Editor:

```sql
-- Найти проблемные строки
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
```

### Шаг 2: Исправьте данные

Выполните скрипт исправления (файл `fix_hours_worked_before_migration.sql`):

```sql
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
```

### Шаг 3: Проверьте результат

```sql
-- Проверка после исправления
SELECT 
    COUNT(*) as total_shifts,
    COUNT(*) FILTER (WHERE hours_worked IS NULL) as null_hours,
    COUNT(*) FILTER (WHERE hours_worked IS NOT NULL AND hours_worked >= 0 AND hours_worked <= 24) as valid_hours,
    COUNT(*) FILTER (WHERE hours_worked IS NOT NULL AND (hours_worked < 0 OR hours_worked > 24)) as invalid_hours
FROM public.staff_shifts;
```

Должно быть: `invalid_hours = 0`

### Шаг 4: Примените миграцию снова

После исправления данных, примените миграцию снова:

```bash
npx supabase@latest db push --include-all
```

Или через Supabase Dashboard SQL Editor - скопируйте содержимое файла `supabase/migrations/20260213000000_add_shift_constraints_and_transactions.sql` и выполните его.

## Альтернативный вариант: Более мягкое исправление

Если вы хотите сохранить оригинальные значения (но они некорректны), можно временно установить их в NULL:

```sql
-- Установить NULL для некорректных значений
UPDATE public.staff_shifts
SET hours_worked = NULL
WHERE hours_worked IS NOT NULL 
  AND (hours_worked < 0 OR hours_worked > 24);
```

Но лучше исправить на валидные значения (0 или 24), как в основном скрипте.

