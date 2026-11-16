-- Тестовые сценарии для проверки приоритетов применения акций
-- ВНИМАНИЕ: скрипт рассчитан на запуск в тестовой/стейджинговой БД.
-- Перед использованием замените значения идентификаторов на реальные.

-- 1. Подготовка: создаём тестового клиента, филиал и услугу (если нужно)
-- Здесь предполагается, что у вас уже есть biz_id, branch_id и service_id.
-- Закомментировано, чтобы случайно не создавать дубль.
/*
insert into public.clients (id, full_name, phone)
values ('00000000-0000-0000-0000-000000000001', 'Test Client', '+996500000001')
on conflict (id) do nothing;
*/

-- Параметры для примеров (ЗАМЕНИТЕ НА СВОИ)
\set client_id '00000000-0000-0000-0000-000000000001'
\set branch_id '00000000-0000-0000-0000-00000000B001'
\set biz_id    '00000000-0000-0000-0000-00000000A001'
\set service_id '00000000-0000-0000-0000-00000000S001'

-- 2. Создаём набор акций с разными типами для одного филиала
-- Обратите внимание на promotion_type и params

insert into public.branch_promotions (id, branch_id, biz_id, promotion_type, title_ru, params, is_active)
values
    -- first_visit_discount: скидка 30% на первый визит
    ('00000000-0000-0000-0000-00000000P001', :'branch_id', :'biz_id', 'first_visit_discount', 'Скидка 30% на первый визит', jsonb_build_object('discount_percent', 30), true),
    -- birthday_discount: скидка 20% в день рождения (по умолчанию can_use_promotion пока возвращает false)
    ('00000000-0000-0000-0000-00000000P002', :'branch_id', :'biz_id', 'birthday_discount', 'Скидка 20% в день рождения', jsonb_build_object('discount_percent', 20), true),
    -- реферальная бесплатная услуга
    ('00000000-0000-0000-0000-00000000P003', :'branch_id', :'biz_id', 'referral_free', 'Бесплатная услуга за друга', '{}'::jsonb, true),
    -- реферальная скидка 50%
    ('00000000-0000-0000-0000-00000000P004', :'branch_id', :'biz_id', 'referral_discount_50', 'Скидка 50% за друга', '{}'::jsonb, true),
    -- каждая 7‑я услуга бесплатно
    ('00000000-0000-0000-0000-00000000P005', :'branch_id', :'biz_id', 'free_after_n_visits', 'Каждая 7‑я услуга бесплатно', jsonb_build_object('visit_count', 7), true)
on conflict (id) do nothing;

-- 3. Сценарий A: первый визит клиента в филиал
-- Ожидаемая акция: first_visit_discount (т.к. has priority #1)

-- Создаём бронирование и сразу отмечаем как paid
insert into public.bookings (id, client_id, branch_id, biz_id, service_id, status, start_at, end_at)
values (
    '00000000-0000-0000-0000-00000000BKG1',
    :'client_id',
    :'branch_id',
    :'biz_id',
    :'service_id',
    'paid',
    now() - interval '1 hour',
    now()
);

select public.update_booking_status_with_promotion('00000000-0000-0000-0000-00000000BKG1', 'paid') as promotion_result;

select id, status, promotion_applied
from public.bookings
where id = '00000000-0000-0000-0000-00000000BKG1';

-- 4. Сценарий B: клиент уже имеет один paid‑визит (first_visit_discount больше не должен применяться)
-- Подготовка: имитируем, что у клиента уже есть одна оплаченная запись в этом филиале

insert into public.bookings (id, client_id, branch_id, biz_id, service_id, status, start_at, end_at)
values (
    '00000000-0000-0000-0000-00000000BKG0',
    :'client_id',
    :'branch_id',
    :'biz_id',
    :'service_id',
    'paid',
    now() - interval '2 day',
    now() - interval '2 day' + interval '1 hour'
)
on conflict (id) do nothing;

-- Новое бронирование с paid‑статусом
insert into public.bookings (id, client_id, branch_id, biz_id, service_id, status, start_at, end_at)
values (
    '00000000-0000-0000-0000-00000000BKG2',
    :'client_id',
    :'branch_id',
    :'biz_id',
    :'service_id',
    'paid',
    now() - interval '30 minutes',
    now()
);

select public.update_booking_status_with_promotion('00000000-0000-0000-0000-00000000BKG2', 'paid') as promotion_result;

select id, status, promotion_applied
from public.bookings
where id in ('00000000-0000-0000-0000-00000000BKG1', '00000000-0000-0000-0000-00000000BKG2')
order by id;

-- 5. Сценарий C: проверка реферальных акций
-- Подготовка: создаём неиспользованную реферальную связь

insert into public.client_referrals (id, referrer_id, referred_client_id, branch_id, created_at, referrer_bonus_used)
values (
    '00000000-0000-0000-0000-00000000R001',
    :'client_id',
    '00000000-0000-0000-0000-00000000REF1', -- приглашённый клиент
    :'branch_id',
    now() - interval '1 day',
    false
)
on conflict (id) do nothing;

-- Новое бронирование для пригласившего, уже не первый визит (first_visit_discount не должен сработать)
insert into public.bookings (id, client_id, branch_id, biz_id, service_id, status, start_at, end_at)
values (
    '00000000-0000-0000-0000-00000000BKG3',
    :'client_id',
    :'branch_id',
    :'biz_id',
    :'service_id',
    'paid',
    now() - interval '15 minutes',
    now()
);

select public.update_booking_status_with_promotion('00000000-0000-0000-0000-00000000BKG3', 'paid') as promotion_result;

select id, status, promotion_applied
from public.bookings
where id = '00000000-0000-0000-0000-00000000BKG3';

select *
from public.client_referrals
where id = '00000000-0000-0000-0000-00000000R001';

-- 6. Сценарий D: каждая N‑я (7‑я) услуга бесплатно
-- Здесь важно, чтобы free_after_n_visits срабатывала только когда (visit_count + 1) % N = 0

-- Посчитаем текущее количество визитов
select public.get_client_visit_count(:'client_id', :'branch_id') as current_visits;

-- При необходимости можно досоздать нужное количество paid‑визитов,
-- затем создать ещё одно бронирование и вызвать update_booking_status_with_promotion,
-- чтобы убедиться, что только N‑й визит получает free_after_n_visits.


