-- Добавление недостающих индексов для оптимизации частых запросов
-- 
-- Проблемы:
-- 1. Отсутствуют составные индексы для частых комбинаций фильтров и сортировок
-- 2. Нет индексов на часто используемые поля для поиска (phone, client_phone)
-- 3. Отсутствуют индексы для оптимизации сортировок по датам
--
-- Решения:
-- 1. Добавить составные индексы для частых запросов с фильтрацией и сортировкой
-- 2. Добавить индексы на поля для поиска
-- 3. Оптимизировать индексы для сортировок по датам

-- ============================================
-- BOOKINGS - индексы для бронирований
-- ============================================

-- Индекс для запросов бронирований по бизнесу с сортировкой по дате начала
-- Используется в: dashboard/bookings, bookings list queries
-- Паттерн: WHERE biz_id = ? ORDER BY start_at DESC
create index if not exists bookings_biz_start_at_idx
    on public.bookings (biz_id, start_at desc)
    where status != 'cancelled';

comment on index bookings_biz_start_at_idx is 'Ускоряет запросы бронирований по бизнесу с сортировкой по дате начала';

-- Индекс для запросов бронирований по бизнесу, филиалу и дате
-- Используется в: dashboard/bookings с фильтром по филиалу
-- Паттерн: WHERE biz_id = ? AND branch_id = ? AND start_at >= ? AND start_at <= ? ORDER BY start_at
create index if not exists bookings_biz_branch_start_at_idx
    on public.bookings (biz_id, branch_id, start_at)
    where status != 'cancelled';

comment on index bookings_biz_branch_start_at_idx is 'Ускоряет запросы бронирований по бизнесу, филиалу и диапазону дат';

-- Индекс для запросов бронирований по бизнесу и статусу с сортировкой
-- Используется в: dashboard/bookings с фильтром по статусу
-- Паттерн: WHERE biz_id = ? AND status = ? ORDER BY start_at DESC
create index if not exists bookings_biz_status_start_at_idx
    on public.bookings (biz_id, status, start_at desc);

comment on index bookings_biz_status_start_at_idx is 'Ускоряет запросы бронирований по бизнесу и статусу с сортировкой';

-- Индекс для запросов бронирований по клиенту, статусу и дате
-- Используется в: WhatsApp webhook, cabinet bookings, client bookings
-- Паттерн: WHERE client_id = ? AND status IN (?) AND start_at >= ? ORDER BY start_at
create index if not exists bookings_client_status_start_at_idx
    on public.bookings (client_id, status, start_at)
    where client_id is not null;

comment on index bookings_client_status_start_at_idx is 'Ускоряет запросы бронирований клиента по статусу и дате';

-- Индекс для запросов бронирований по телефону клиента, статусу и дате
-- Используется в: WhatsApp webhook для гостевых бронирований
-- Паттерн: WHERE client_phone = ? AND status IN (?) AND start_at >= ? ORDER BY start_at
create index if not exists bookings_client_phone_status_start_at_idx
    on public.bookings (client_phone, status, start_at)
    where client_phone is not null;

comment on index bookings_client_phone_status_start_at_idx is 'Ускоряет запросы гостевых бронирований по телефону, статусу и дате';

-- Индекс для запросов бронирований по сотруднику и дате
-- Используется в: staff bookings, staff schedule
-- Паттерн: WHERE staff_id = ? AND start_at >= ? ORDER BY start_at
create index if not exists bookings_staff_start_at_idx
    on public.bookings (staff_id, start_at)
    where status != 'cancelled';

comment on index bookings_staff_start_at_idx is 'Ускоряет запросы бронирований сотрудника с сортировкой по дате';

-- Индекс для запросов бронирований по клиенту с сортировкой по дате создания
-- Используется в: WhatsApp webhook для поиска последних бронирований
-- Паттерн: WHERE client_id = ? ORDER BY created_at DESC
create index if not exists bookings_client_created_at_idx
    on public.bookings (client_id, created_at desc)
    where client_id is not null;

comment on index bookings_client_created_at_idx is 'Ускоряет поиск последних бронирований клиента по дате создания';

-- ============================================
-- PROFILES - индексы для профилей пользователей
-- ============================================

-- Индекс для поиска профиля по телефону
-- Используется в: WhatsApp auth, Telegram auth, phone verification
-- Паттерн: WHERE phone = ?
create index if not exists profiles_phone_idx
    on public.profiles (phone)
    where phone is not null;

comment on index profiles_phone_idx is 'Ускоряет поиск профиля по номеру телефона';

-- ============================================
-- SERVICES - индексы для услуг
-- ============================================

-- Индекс для запросов услуг по бизнесу с фильтром по активности и сортировкой
-- Используется в: dashboard/services, booking form
-- Паттерн: WHERE biz_id = ? AND active = true ORDER BY name_ru
create index if not exists services_biz_active_name_idx
    on public.services (biz_id, active, name_ru)
    where active = true;

comment on index services_biz_active_name_idx is 'Ускоряет запросы активных услуг по бизнесу с сортировкой по имени';

-- ============================================
-- STAFF - индексы для сотрудников
-- ============================================

-- Индекс для запросов сотрудников по бизнесу с фильтром по активности и сортировкой
-- Используется в: dashboard/staff, booking form
-- Паттерн: WHERE biz_id = ? AND is_active = true ORDER BY full_name
create index if not exists staff_biz_active_name_idx
    on public.staff (biz_id, is_active, full_name)
    where is_active = true;

comment on index staff_biz_active_name_idx is 'Ускоряет запросы активных сотрудников по бизнесу с сортировкой по имени';

-- ============================================
-- BRANCHES - индексы для филиалов
-- ============================================

-- Индекс для запросов филиалов по бизнесу с фильтром по активности и сортировкой
-- Используется в: dashboard/branches, booking form
-- Паттерн: WHERE biz_id = ? AND is_active = true ORDER BY name
create index if not exists branches_biz_active_name_idx
    on public.branches (biz_id, is_active, name)
    where is_active = true;

comment on index branches_biz_active_name_idx is 'Ускоряет запросы активных филиалов по бизнесу с сортировкой по имени';

-- ============================================
-- STAFF_SCHEDULE_RULES - индексы для правил расписания
-- ============================================

-- Индекс для запросов правил расписания по бизнесу, сотруднику, типу и дате
-- Используется в: staff schedule, booking form
-- Паттерн: WHERE biz_id = ? AND staff_id = ? AND kind = 'date' AND is_active = true AND date_on = ?
create index if not exists staff_schedule_rules_biz_staff_kind_active_date_idx
    on public.staff_schedule_rules (biz_id, staff_id, kind, is_active, date_on)
    where is_active = true;

comment on index staff_schedule_rules_biz_staff_kind_active_date_idx is 'Ускоряет запросы правил расписания по бизнесу, сотруднику, типу и дате';

-- Индекс для запросов правил расписания по бизнесу, сотруднику и диапазону дат
-- Используется в: staff schedule view
-- Паттерн: WHERE biz_id = ? AND staff_id = ? AND kind = 'date' AND is_active = true AND date_on >= ? AND date_on <= ?
create index if not exists staff_schedule_rules_biz_staff_kind_date_range_idx
    on public.staff_schedule_rules (biz_id, staff_id, kind, date_on)
    where is_active = true and kind = 'date';

comment on index staff_schedule_rules_biz_staff_kind_date_range_idx is 'Ускоряет запросы правил расписания по бизнесу, сотруднику и диапазону дат';

-- ============================================
-- SERVICE_STAFF - индексы для связи услуг и сотрудников
-- ============================================

-- Индекс для запросов активных связей услуги и сотрудника
-- Используется в: booking form для фильтрации доступных сотрудников
-- Паттерн: WHERE service_id = ? AND is_active = true
create index if not exists service_staff_service_active_idx
    on public.service_staff (service_id, is_active)
    where is_active = true;

comment on index service_staff_service_active_idx is 'Ускоряет запросы активных связей услуги и сотрудников';

-- Индекс для запросов активных связей сотрудника и услуги
-- Используется в: staff services list
-- Паттерн: WHERE staff_id = ? AND is_active = true
create index if not exists service_staff_staff_active_idx
    on public.service_staff (staff_id, is_active)
    where is_active = true;

comment on index service_staff_staff_active_idx is 'Ускоряет запросы активных связей сотрудника и услуг';

-- ============================================
-- BUSINESSES - индексы для бизнесов
-- ============================================

-- Индекс для запросов бизнесов с фильтром по одобрению и сортировкой по рейтингу
-- Используется в: home page, business listing
-- Паттерн: WHERE is_approved = true ORDER BY rating_score DESC NULLS LAST, name ASC
create index if not exists businesses_approved_rating_name_idx
    on public.businesses (is_approved, rating_score desc nulls last, name)
    where is_approved = true;

comment on index businesses_approved_rating_name_idx is 'Ускоряет запросы одобренных бизнесов с сортировкой по рейтингу и имени';

-- ============================================
-- BRANCH_PROMOTIONS - индексы для акций филиалов
-- ============================================

-- Индекс для запросов активных акций по филиалам
-- Используется в: home page для подсчета акций
-- Паттерн: WHERE branch_id IN (?) AND is_active = true
create index if not exists branch_promotions_branch_active_idx
    on public.branch_promotions (branch_id, is_active)
    where is_active = true;

comment on index branch_promotions_branch_active_idx is 'Ускоряет запросы активных акций по филиалам';

-- ============================================
-- REVIEWS - индексы для отзывов
-- ============================================

-- Индекс для запросов отзывов по клиенту с сортировкой по дате создания
-- Используется в: client reviews
-- Паттерн: WHERE client_id = ? ORDER BY created_at DESC
create index if not exists reviews_client_created_at_idx
    on public.reviews (client_id, created_at desc)
    where client_id is not null;

comment on index reviews_client_created_at_idx is 'Ускоряет запросы отзывов клиента с сортировкой по дате создания';

-- Индекс для запросов отзывов по бронированию
-- Используется в: booking details
-- Паттерн: WHERE booking_id = ?
create index if not exists reviews_booking_id_idx
    on public.reviews (booking_id)
    where booking_id is not null;

comment on index reviews_booking_id_idx is 'Ускоряет поиск отзыва по бронированию';

