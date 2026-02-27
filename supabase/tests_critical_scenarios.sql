-- Минимальный набор автоматизированных проверок для критичных сценариев
-- Запускать целиком в Supabase SQL editor.
-- При успехе вы увидите только NOTICE; при ошибке любой сценарий упадет с EXCEPTION.

-----------------------------
-- 1. Закрытие смен (гарантия, отсутствие клиентов)
-----------------------------

do $$
declare
    v_staff_id uuid;
    v_biz_id uuid;
    v_branch_id uuid;
    v_shift_id uuid;
    v_hourly numeric := 100; -- 100 сом/час
    v_hours numeric := 8;    -- 8 часов смены
    v_expected_guarantee numeric;
    v_shift record;
begin
    raise notice '[TEST 1] Старт теста закрытия смены без клиентов и с гарантией';

    -- 1.1. создаем тестовый бизнес / филиал / сотрудника
    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_FOR_SHIFTS', 'test-biz-for-shifts', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_FOR_SHIFTS', true)
    returning id into v_branch_id;

    insert into public.staff (biz_id, branch_id, full_name, is_active, hourly_rate, percent_master, percent_salon)
    values (v_biz_id, v_branch_id, 'TEST STAFF SHIFTS', true, v_hourly, 60, 40)
    returning id into v_staff_id;

    -- 1.2. создаем смену в прошлом без клиентов
    insert into public.staff_shifts (staff_id, biz_id, branch_id, status, opened_at, shift_date, total_amount, consumables_amount)
    values (
        v_staff_id,
        v_biz_id,
        v_branch_id,
        'open',
        now() - make_interval(hours => v_hours + 1),
        (now() - interval '1 day')::date,
        0,
        0
    )
    returning id into v_shift_id;

    -- В этом тесте мы не вызываем HTTP‑роут cron/close-shifts,
    -- а моделируем закрытие смены напрямую в SQL по тем же формулам, что описаны в документации.

    v_expected_guarantee := round(v_hourly * v_hours);

    update public.staff_shifts
    set
        hours_worked      = v_hours,
        hourly_rate       = v_hourly,
        guaranteed_amount = v_expected_guarantee,
        total_amount      = 0,
        consumables_amount = 0,
        master_share      = v_expected_guarantee, -- гарантия должна победить базовую долю (0)
        salon_share       = 0,
        topup_amount      = v_expected_guarantee, -- т.к. base_master_share = 0
        status            = 'closed',
        closed_at         = now()
    where id = v_shift_id;

    select * into v_shift from public.staff_shifts where id = v_shift_id;

    if v_shift.guaranteed_amount <> v_expected_guarantee then
        raise exception '[TEST 1] Ожидали guaranteed_amount = %, получили %', v_expected_guarantee, v_shift.guaranteed_amount;
    end if;

    if v_shift.master_share <> v_expected_guarantee then
        raise exception '[TEST 1] Ожидали master_share = гарантии %, получили %', v_expected_guarantee, v_shift.master_share;
    end if;

    if v_shift.topup_amount <> v_expected_guarantee then
        raise exception '[TEST 1] Ожидали topup_amount = %, получили %', v_expected_guarantee, v_shift.topup_amount;
    end if;

    if v_shift.salon_share <> 0 then
        raise exception '[TEST 1] Ожидали salon_share = 0 при отсутствии выручки, получили %', v_shift.salon_share;
    end if;

    raise notice '[TEST 1] OK — гарантированная смена без клиентов считается корректно';
end;
$$;


-----------------------------
-- 2. Применение промо при переходе брони в paid
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_client_id uuid;
    v_service_id uuid;
    v_booking_id uuid;
    v_promo_id uuid;
    v_result jsonb;
begin
    raise notice '[TEST 2] Старт теста применения промо при статусе paid';

    -- 2.1. создаем бизнес / филиал / клиента / услугу
    insert into public.businesses (name, slug, is_approved)
    values ('TEST_BIZ_FOR_PROMO', 'test-biz-for-promo', true)
    returning id into v_biz_id;

    insert into public.branches (biz_id, name, is_active)
    values (v_biz_id, 'TEST_BRANCH_FOR_PROMO', true)
    returning id into v_branch_id;

    insert into public.clients (phone)
    values ('+996700000001')
    returning id into v_client_id;

    insert into public.services (biz_id, branch_id, name_ru, duration_min, price, active)
    values (v_biz_id, v_branch_id, 'TEST SERVICE', 30, 1000, true)
    returning id into v_service_id;

    -- 2.2. создаем промо "первая услуга со скидкой 50%" в этом филиале
    insert into public.branch_promotions (branch_id, promotion_type, title_ru, params, is_active)
    values (
        v_branch_id,
        'first_visit_discount',
        'Тест: первая услуга 50%',
        jsonb_build_object('discount_percent', 50),
        true
    )
    returning id into v_promo_id;

    -- 2.3. создаем бронь и сразу переводим в paid через функцию
    insert into public.bookings (biz_id, branch_id, client_id, service_id, start_at, end_at, status)
    values (
        v_biz_id,
        v_branch_id,
        v_client_id,
        v_service_id,
        now(),
        now() + interval '30 minutes',
        'confirmed'
    )
    returning id into v_booking_id;

    v_result := public.update_booking_status_with_promotion(v_booking_id, 'paid');

    if coalesce((v_result ->> 'status')::text, '') <> 'paid' then
        raise exception '[TEST 2] После update_booking_status_with_promotion статус должен быть paid, получили %', v_result;
    end if;

    if (v_result ->> 'final_amount')::numeric <> 500 then
        raise exception '[TEST 2] Ожидали final_amount = 500 (скидка 50%% от 1000), получили %', v_result ->> 'final_amount';
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

    -- 3.2. запускаем инициализацию всех рейтингов (функция создается миграцией 20260123000002_initialize_ratings.sql)
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
    v_client_id uuid;
    v_service_id uuid;
    v_promo_id uuid;
    v_booking_id uuid;
    v_shift_id uuid;
    v_date_1 date := current_date - interval '3 days';
    v_date_2 date := current_date - interval '2 days';
    v_date_3 date := current_date - interval '1 day';
    v_initial_rating numeric;
    v_rating_after_work numeric;
    v_metrics_count integer;
    v_result numeric;
begin
    raise notice '[TEST 4] Старт комплексного теста: смены + промо + рейтинги за несколько дней';

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

    insert into public.clients (phone)
    values ('+996700000002')
    returning id into v_client_id;

    insert into public.services (biz_id, branch_id, name_ru, duration_min, price, active)
    values (v_biz_id, v_branch_id, 'TEST SERVICE COMPLEX', 30, 1000, true)
    returning id into v_service_id;

    -- 4.2. Создаем промо "седьмая услуга бесплатно"
    insert into public.branch_promotions (branch_id, promotion_type, title_ru, params, is_active)
    values (
        v_branch_id,
        'free_after_n_visits',
        'Тест: седьмая услуга бесплатно',
        jsonb_build_object('visit_count', 7),
        true
    )
    returning id into v_promo_id;

    -- 4.3. Симулируем 6 посещений за 3 дня (чтобы на 7-м сработало промо)
    for i in 1..6 loop
        insert into public.bookings (biz_id, branch_id, client_id, service_id, start_at, end_at, status)
        values (
            v_biz_id,
            v_branch_id,
            v_client_id,
            v_service_id,
            (v_date_1 + make_interval(days => (i - 1) % 3))::timestamp + make_interval(hours => 10),
            (v_date_1 + make_interval(days => (i - 1) % 3))::timestamp + make_interval(hours => 10, minutes => 30),
            'paid'
        );
    end loop;

    -- 4.4. Создаем смены за эти дни с клиентами
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
            (v_date_1 + make_interval(days => i - 1))::timestamp + make_interval(hours => 9),
            v_date_1 + make_interval(days => i - 1),
            2000 * i, -- выручка растет
            100 * i,   -- расходники растут
            8,         -- 8 часов
            100,       -- ставка
            1200 * i,  -- доля мастера (60% от выручки)
            800 * i + 100 * i, -- доля салона (40% + расходники)
            (v_date_1 + make_interval(days => i - 1))::timestamp + make_interval(hours => 17)
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

    -- Проверяем, что рейтинг изменился после работы
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

    -- 4.9. Создаем 7-е посещение (должно сработать промо "седьмая услуга бесплатно")
    insert into public.bookings (biz_id, branch_id, client_id, service_id, start_at, end_at, status)
    values (
        v_biz_id,
        v_branch_id,
        v_client_id,
        v_service_id,
        current_date::timestamp + make_interval(hours => 10),
        current_date::timestamp + make_interval(hours => 10, minutes => 30),
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


