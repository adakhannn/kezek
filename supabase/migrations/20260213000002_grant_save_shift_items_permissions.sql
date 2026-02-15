-- Предоставляем права на выполнение функции save_shift_items_atomic для authenticated

grant execute on function public.save_shift_items_atomic(uuid, jsonb) to authenticated;
