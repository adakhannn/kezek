-- Добавление недостающих индексов для оптимизации запросов финансовых данных
-- 
-- Проблемы:
-- 1. Нет индекса на (biz_id, shift_date) для запросов без фильтрации по status
-- 2. Дубликат индекса на staff_shift_items(shift_id)
-- 3. Нужны дополнительные индексы для реальных запросов
--
-- Решения:
-- 1. Добавить индекс на (biz_id, shift_date) для общих запросов
-- 2. Удалить дубликат индекса на staff_shift_items
-- 3. Добавить составные индексы для оптимизации частых запросов

-- 1. Индекс для запросов по бизнесу и дате (без фильтрации по status)
-- Используется в запросах типа: WHERE biz_id = ? AND shift_date >= ? AND shift_date <= ?
create index if not exists staff_shifts_biz_date_idx
    on public.staff_shifts (biz_id, shift_date);

comment on index staff_shifts_biz_date_idx is 'Ускоряет запросы смен по бизнесу и дате без фильтрации по статусу';

-- 2. Составной индекс для запросов по бизнесу, сотруднику и дате
-- Используется в запросах типа: WHERE biz_id = ? AND staff_id = ? AND shift_date >= ? AND shift_date <= ?
create index if not exists staff_shifts_biz_staff_date_idx
    on public.staff_shifts (biz_id, staff_id, shift_date);

comment on index staff_shifts_biz_staff_date_idx is 'Ускоряет запросы смен по бизнесу, сотруднику и диапазону дат';

-- 3. Индекс для запросов открытых смен по бизнесу и дате
-- Используется для поиска открытых смен на конкретную дату
create index if not exists staff_shifts_biz_date_open_idx
    on public.staff_shifts (biz_id, shift_date, status)
    where status = 'open';

comment on index staff_shifts_biz_date_open_idx is 'Ускоряет поиск открытых смен по бизнесу и дате';

-- 4. Удаляем дубликат индекса на staff_shift_items(shift_id)
-- Индекс staff_shift_items_shift_idx уже существует в миграции 20251215010000
-- Индекс staff_shift_items_shift_id_idx был добавлен в миграции 20260125000001 (дубликат)
-- Оставляем более ранний индекс и удаляем дубликат
drop index if exists public.staff_shift_items_shift_id_idx;

-- 5. Индекс для запросов позиций смен по booking_id (если используется)
-- Может быть полезен для связывания позиций смен с записями
create index if not exists staff_shift_items_booking_idx
    on public.staff_shift_items (booking_id)
    where booking_id is not null;

comment on index staff_shift_items_booking_idx is 'Ускоряет поиск позиций смен по записи (booking_id)';

-- 6. Индекс для сортировки позиций смен по дате создания
-- Используется в запросах: ORDER BY created_at
create index if not exists staff_shift_items_shift_created_idx
    on public.staff_shift_items (shift_id, created_at);

comment on index staff_shift_items_shift_created_idx is 'Ускоряет сортировку позиций смен по дате создания';

