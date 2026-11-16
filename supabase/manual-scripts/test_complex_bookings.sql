-- Ручные тесты для комплексов услуг (hold_complex_slot + booking_services).
-- Выполнять в Supabase SQL Editor в тестовом проекте.

-- 1. Подставьте реальные идентификаторы бизнеса, филиала, мастера и услуг.
--    Рекомендуется взять 2–3 услуги одного бизнеса и мастера.
--    Ниже используются плейсхолдеры:
--      :biz_id, :branch_id, :staff_id, :service_id_1, :service_id_2

-- with params as (
--     select
--         '00000000-0000-0000-0000-000000000000'::uuid as biz_id,
--         '00000000-0000-0000-0000-000000000000'::uuid as branch_id,
--         '00000000-0000-0000-0000-000000000000'::uuid as staff_id,
--         '00000000-0000-0000-0000-000000000000'::uuid as service_id_1,
--         '00000000-0000-0000-0000-000000000000'::uuid as service_id_2
-- )
-- select * from params;

-- 2. Создаём бронь с двумя услугами (30 и 45 минут).
-- Замените плейсхолдеры на реальные значения или раскомментируйте блок with params.

-- пример вызова:
-- select public.hold_complex_slot(
--     :biz_id,
--     :branch_id,
--     :staff_id,
--     now() + interval '1 day',
--     jsonb_build_array(
--         jsonb_build_object(
--             'service_id', :service_id_1,
--             'duration_min', 30,
--             'order_index', 0
--         ),
--         jsonb_build_object(
--             'service_id', :service_id_2,
--             'duration_min', 45,
--             'order_index', 1
--         )
--     )
-- ) as booking_id;

-- 3. Проверяем, что запись появилась в bookings и booking_services.
-- Подставьте значение booking_id из предыдущего шага.

-- select * from public.bookings where id = :booking_id;
-- select * from public.booking_services where booking_id = :booking_id order by order_index;

