-- Комментарий к функции save_shift_items_atomic

comment on function public.save_shift_items_atomic is 'Атомарно сохраняет позиции смены в транзакции. Удаляет старые позиции и вставляет новые. Проверяет, что смена открыта.';

