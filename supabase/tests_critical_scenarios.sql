-- Сквозные SQL-сценарии на полной цепочке миграций: закрытие смены, акции при оплате и рейтинги.
-- Запуск: `pnpm test:sql` с локальным SUPABASE_DB_URL. Runner выполняет файл в одной транзакции и
-- откатывает её, так что тестовые строки и пересчитанные рейтинги не остаются. CI запускает его в
-- db_bootstrap на базе, собранной из baseline, миграций и seed.
-- При успехе выводятся только NOTICE; при ошибке любой сценарий падает с EXCEPTION.
-- Команды вызываются так, как их вызывает backend: с JWT-ролью service_role.

-----------------------------
-- 1. Закрытие смены командой сервера (гарантия, без клиентов)
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_staff_id uuid;
    v_shift_id uuid;
    v_tz text;
    v_day date;
    v_revision bigint;
    v_settings jsonb;
    v_calculation jsonb;
    v_result jsonb;
    v_shift record;
begin
    raise notice '[TEST 1] Старт теста закрытия смены без клиентов и с гарантией';
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_FOR_SHIFTS', 'test-biz-for-shifts', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_FOR_SHIFTS', true)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active, hourly_rate, percent_master, percent_salon)
    values (v_biz_id, v_branch_id, 'TEST STAFF SHIFTS', true, 100, 60, 40)
    returning id into v_staff_id;

    -- Вчерашняя смена по часовому поясу бизнеса, 09:00–17:00, без клиентов.
    v_tz := public.finance_business_timezone(v_biz_id);
    v_day := (now() at time zone v_tz)::date - 1;
    insert into public.staff_shifts (staff_id, biz_id, branch_id, status, opened_at, shift_date, total_amount, consumables_amount)
    values (v_staff_id, v_biz_id, v_branch_id, 'open', (v_day + time '09:00') at time zone v_tz, v_day, 0, 0)
    returning id, ledger_revision into v_shift_id, v_revision;

    -- Расчёт делает core-domain на сервере: 8 часов по 100 сом без выручки дают гарантию 800,
    -- и вся она — доплата. Команда проверяет смену, настройки и день и сохраняет результат.
    select jsonb_build_object('percent_master', percent_master, 'percent_salon', percent_salon, 'hourly_rate', hourly_rate)
    into v_settings
    from public.staff
    where id = v_staff_id;
    v_calculation := jsonb_build_object(
        'totalAmount', 0, 'totalConsumables', 0, 'normalizedPercentMaster', 60, 'normalizedPercentSalon', 40,
        'finalMasterShare', 800, 'finalSalonShare', 0, 'hoursWorked', 8, 'hourlyRate', 100,
        'guaranteedAmount', 800, 'topupAmount', 800, 'closedAt', (v_day + time '17:00') at time zone v_tz);
    v_result := public.close_staff_shift_command(v_shift_id, null, v_revision, v_settings, v_calculation);
    if v_result ->> 'ok' is distinct from 'true' then
        raise exception '[TEST 1] Команда закрытия вернула %', v_result;
    end if;

    select * into v_shift from public.staff_shifts where id = v_shift_id;
    if v_shift.status <> 'closed' or v_shift.guaranteed_amount <> 800 or v_shift.topup_amount <> 800
        or v_shift.master_share <> 800 or v_shift.salon_share <> 0 or v_shift.hours_worked <> 8 then
        raise exception '[TEST 1] Смена сохранена неверно: status %, гарантия %, доплата %, мастер %, салон %, часы %',
            v_shift.status, v_shift.guaranteed_amount, v_shift.topup_amount, v_shift.master_share, v_shift.salon_share, v_shift.hours_worked;
    end if;

    -- Повторная команда не закрывает смену второй раз.
    v_result := public.close_staff_shift_command(v_shift_id, null, v_revision, v_settings, v_calculation);
    if v_result ->> 'action' is distinct from 'already_closed' then
        raise exception '[TEST 1] Повторное закрытие должно вернуть already_closed, получили %', v_result;
    end if;

    raise notice '[TEST 1] OK — гарантированная смена без клиентов закрывается командой и сохраняется корректно';
end;
$$;


-----------------------------
-- 2. Применение промо при переходе брони в paid
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_staff_id uuid;
    v_client_id uuid := gen_random_uuid();
    v_service_id uuid;
    v_booking_id uuid;
    v_result jsonb;
    v_booking record;
begin
    raise notice '[TEST 2] Старт теста применения промо при статусе paid';
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

    -- 2.1. бизнес, филиал, сотрудник с назначением в филиал, клиент-аккаунт и услуга за 1000
    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_FOR_PROMO', 'test-biz-for-promo', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_FOR_PROMO', true)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active)
    values (v_biz_id, v_branch_id, 'TEST STAFF PROMO', true)
    returning id into v_staff_id;

    insert into public.staff_branch_assignments (biz_id, staff_id, branch_id, valid_from)
    values (v_biz_id, v_staff_id, v_branch_id, current_date - 30);

    insert into auth.users (id, email)
    values (v_client_id, 'test-promo-client@example.test');

    insert into public.services (biz_id, branch_id, name_ru, duration_min, price_from, price_to, active)
    values (v_biz_id, v_branch_id, 'TEST SERVICE', 30, 1000, 1000, true)
    returning id into v_service_id;

    -- 2.2. промо "первая услуга со скидкой 50%" в этом филиале
    insert into public.branch_promotions (branch_id, biz_id, promotion_type, title_ru, params, is_active)
    values (v_branch_id, v_biz_id, 'first_visit_discount', 'Тест: первая услуга 50%', jsonb_build_object('discount_percent', 50), true);

    -- 2.3. подтверждённая бронь, которую сервер переводит в paid после визита, как на практике:
    -- она уже закончилась, но в счёт своих же визитов не входит (ENG-123)
    insert into public.bookings (biz_id, branch_id, staff_id, client_id, service_id, start_at, end_at, status)
    values (v_biz_id, v_branch_id, v_staff_id, v_client_id, v_service_id,
        now() - interval '1 hour', now() - interval '30 minutes', 'confirmed')
    returning id into v_booking_id;

    v_result := public.update_booking_status_with_promotion(v_booking_id, 'paid');

    select status, promotion_applied into v_booking from public.bookings where id = v_booking_id;
    if v_booking.status <> 'paid' then
        raise exception '[TEST 2] После update_booking_status_with_promotion статус должен быть paid, получили %', v_booking.status;
    end if;

    if v_result ->> 'applied' is distinct from 'true' or (v_result ->> 'final_amount')::numeric <> 500 then
        raise exception '[TEST 2] Ожидали final_amount = 500 (скидка 50%% от 1000), получили %', v_result;
    end if;

    if (v_booking.promotion_applied ->> 'final_amount')::numeric is distinct from 500 then
        raise exception '[TEST 2] Бронь должна хранить применённое промо с final_amount = 500, получили %', v_booking.promotion_applied;
    end if;

    raise notice '[TEST 2] OK — промо first_visit_discount применяется при переходе в paid и корректно считает сумму';
end;
$$;


-----------------------------
-- 3. Инициализация и пересчет рейтингов
-----------------------------

do $$
declare
    v_today date := current_date;
    v_staff_id uuid;
    v_biz_id uuid;
    v_branch_id uuid;
    v_has_rating boolean;
begin
    raise notice '[TEST 3] Старт теста инициализации и пересчета рейтингов';

    -- 3.1. создаем минимальный бизнес/филиал/сотрудника без рейтингов
    insert into public.businesses (name, slug, is_approved, rating_score)
    values ('TEST_BIZ_FOR_RATINGS', 'test-biz-for-ratings', true, null)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active, rating_score)
    values (v_biz_id, 'TEST_BRANCH_FOR_RATINGS', true, null)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active, rating_score)
    values (v_biz_id, v_branch_id, 'TEST STAFF RATINGS', true, null)
    returning id into v_staff_id;

    -- 3.2. запускаем инициализацию всех рейтингов
    perform public.initialize_all_ratings(30);

    select exists (
        select 1 from public.staff where id = v_staff_id and rating_score is not null
    ) into v_has_rating;

    if not v_has_rating then
        raise exception '[TEST 3] После initialize_all_ratings у тестового сотрудника должен появиться rating_score (не NULL)';
    end if;

    -- 3.3. проверяем, что дневные метрики могут быть посчитаны за конкретную дату
    perform public.recalculate_ratings_for_date(v_today);

    raise notice '[TEST 3] OK — инициализация и пересчет рейтингов выполняются без ошибок, сотрудник получает рейтинг';
end;
$$;


-----------------------------
-- 4. Комплексный тест: смены + промо + рейтинги за несколько дней
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_staff_id uuid;
    v_client_id uuid := gen_random_uuid();
    v_service_id uuid;
    v_booking_id uuid;
    v_date_1 date := current_date - 3;
    v_date_2 date := current_date - 2;
    v_date_3 date := current_date - 1;
    v_initial_rating numeric;
    v_rating_after_work numeric;
    v_metrics_count integer;
    v_result numeric;
begin
    raise notice '[TEST 4] Старт комплексного теста: смены + промо + рейтинги за несколько дней';
    perform set_config('request.jwt.claims', '{"role":"service_role"}', true);

    -- 4.1. Создаем тестовую инфраструктуру
    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_COMPLEX', 'test-biz-complex', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_COMPLEX', true)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active, hourly_rate, percent_master, percent_salon)
    values (v_biz_id, v_branch_id, 'TEST STAFF COMPLEX', true, 100, 60, 40)
    returning id into v_staff_id;

    insert into public.staff_branch_assignments (biz_id, staff_id, branch_id, valid_from)
    values (v_biz_id, v_staff_id, v_branch_id, current_date - 30);

    insert into auth.users (id, email)
    values (v_client_id, 'test-complex-client@example.test');

    insert into public.services (biz_id, branch_id, name_ru, duration_min, price_from, price_to, active)
    values (v_biz_id, v_branch_id, 'TEST SERVICE COMPLEX', 30, 1000, 1000, true)
    returning id into v_service_id;

    -- 4.2. Создаем промо "седьмая услуга бесплатно"
    insert into public.branch_promotions (branch_id, biz_id, promotion_type, title_ru, params, is_active)
    values (v_branch_id, v_biz_id, 'free_after_n_visits', 'Тест: седьмая услуга бесплатно', jsonb_build_object('visit_count', 7), true);

    -- 4.3. Симулируем 5 оплаченных посещений за 3 дня, в 10:00 и 11:00; шестое и седьмое оплачиваются ниже
    for i in 1..5 loop
        insert into public.bookings (biz_id, branch_id, staff_id, client_id, service_id, start_at, end_at, status)
        values (
            v_biz_id,
            v_branch_id,
            v_staff_id,
            v_client_id,
            v_service_id,
            (v_date_1 + (i - 1) % 3)::timestamp + make_interval(hours => 10 + (i - 1) / 3),
            (v_date_1 + (i - 1) % 3)::timestamp + make_interval(hours => 10 + (i - 1) / 3, mins => 30),
            'paid'
        );
    end loop;

    -- 4.4. Создаем закрытые смены за эти дни с клиентами
    for i in 1..3 loop
        insert into public.staff_shifts (
            staff_id, biz_id, branch_id, status, opened_at, shift_date,
            total_amount, consumables_amount, hours_worked, hourly_rate,
            master_share, salon_share, closed_at
        )
        values (
            v_staff_id,
            v_biz_id,
            v_branch_id,
            'closed',
            (v_date_1 + (i - 1))::timestamp + make_interval(hours => 9),
            v_date_1 + (i - 1),
            2000 * i, -- выручка растет
            100 * i,   -- расходники растут
            8,         -- 8 часов
            100,       -- ставка
            1200 * i,  -- доля мастера (60% от выручки)
            800 * i + 100 * i, -- доля салона (40% + расходники)
            (v_date_1 + (i - 1))::timestamp + make_interval(hours => 17)
        );
    end loop;

    -- 4.5. Инициализируем рейтинги
    perform public.initialize_all_ratings(30);

    select rating_score into v_initial_rating
    from public.staff
    where id = v_staff_id;

    if v_initial_rating is null or v_initial_rating <= 0 then
        raise exception '[TEST 4] После инициализации у сотрудника должен быть рейтинг > 0, получили %', v_initial_rating;
    end if;

    -- 4.6. Пересчитываем метрики за последние 3 дня
    perform public.calculate_staff_day_metrics(v_staff_id, v_date_1);
    perform public.calculate_staff_day_metrics(v_staff_id, v_date_2);
    perform public.calculate_staff_day_metrics(v_staff_id, v_date_3);

    -- 4.7. Пересчитываем рейтинг сотрудника
    perform public.calculate_staff_rating(v_staff_id);

    select rating_score into v_rating_after_work
    from public.staff
    where id = v_staff_id;

    if v_rating_after_work is null or v_rating_after_work <= 0 then
        raise exception '[TEST 4] После работы у сотрудника должен быть рейтинг > 0, получили %', v_rating_after_work;
    end if;

    -- 4.8. Проверяем, что метрики созданы
    select count(*) into v_metrics_count
    from public.staff_day_metrics
    where staff_id = v_staff_id
      and metric_date in (v_date_1, v_date_2, v_date_3);

    if v_metrics_count < 3 then
        raise exception '[TEST 4] Ожидали минимум 3 дневные метрики, получили %', v_metrics_count;
    end if;

    -- 4.9. Шестое посещение уже закончилось, когда его отмечают оплаченным: промо не срабатывает.
    -- Оплачиваемая бронь не входит в счёт своих же визитов (ENG-123), иначе бесплатным был бы шестой.
    insert into public.bookings (biz_id, branch_id, staff_id, client_id, service_id, start_at, end_at, status)
    values (v_biz_id, v_branch_id, v_staff_id, v_client_id, v_service_id,
        now() - interval '3 hours', now() - interval '150 minutes', 'confirmed')
    returning id into v_booking_id;

    perform public.update_booking_status_with_promotion(v_booking_id, 'paid');

    if exists (select 1 from public.bookings where id = v_booking_id and (status <> 'paid' or promotion_applied is not null)) then
        raise exception '[TEST 4] Шестое посещение должно быть оплачено без промо';
    end if;

    -- 4.10. Создаем 7-е посещение (должно сработать промо "седьмая услуга бесплатно")
    insert into public.bookings (biz_id, branch_id, staff_id, client_id, service_id, start_at, end_at, status)
    values (
        v_biz_id,
        v_branch_id,
        v_staff_id,
        v_client_id,
        v_service_id,
        now() - interval '1 hour',
        now() - interval '30 minutes',
        'confirmed'
    )
    returning id into v_booking_id;

    -- Применяем промо
    perform public.update_booking_status_with_promotion(v_booking_id, 'paid');

    -- Проверяем, что промо применилось
    select (promotion_applied ->> 'final_amount')::numeric
    into v_result
    from public.bookings
    where id = v_booking_id;

    if v_result is null or v_result <> 0 then
        raise exception '[TEST 4] Ожидали final_amount = 0 (седьмая услуга бесплатно), получили %', v_result;
    end if;

    raise notice '[TEST 4] OK — комплексный тест пройден: смены, промо и рейтинги работают корректно вместе';
end;
$$;


-----------------------------
-- 5. Тест рейтингов при отсутствии активности (периоды без метрик)
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_staff_id uuid;
    v_initial_rating numeric := 75.0;
    v_rating_after_pause numeric;
begin
    raise notice '[TEST 5] Старт теста рейтингов при отсутствии активности';

    -- 5.1. Создаем тестовую инфраструктуру
    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_INACTIVE', 'test-biz-inactive', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_INACTIVE', true)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active, rating_score)
    values (v_biz_id, v_branch_id, 'TEST STAFF INACTIVE', true, v_initial_rating)
    returning id into v_staff_id;

    -- 5.2. Убеждаемся, что нет метрик за последние 30 дней
    delete from public.staff_day_metrics
    where staff_id = v_staff_id;

    -- 5.3. Пересчитываем рейтинг (должен сохранить последний известный рейтинг)
    perform public.calculate_staff_rating(v_staff_id);

    select rating_score into v_rating_after_pause
    from public.staff
    where id = v_staff_id;

    -- Проверяем, что рейтинг сохранился (не упал до 0)
    if v_rating_after_pause is null or v_rating_after_pause <> v_initial_rating then
        raise exception '[TEST 5] Ожидали сохранение рейтинга % при отсутствии метрик, получили %', v_initial_rating, v_rating_after_pause;
    end if;

    raise notice '[TEST 5] OK — рейтинг сохраняется при отсутствии активности';
end;
$$;
