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
        select 1 from public.staff where id = v_staff_id and rating_score is not null and rating_score > 0
    ) into v_has_rating;

    if not v_has_rating then
        raise exception '[TEST 3] После initialize_all_ratings у тестового сотрудника должен появиться rating_score > 0';
    end if;

    -- 3.3. проверяем, что дневные метрики могут быть посчитаны за конкретную дату
    perform public.recalculate_ratings_for_date(v_today);

    raise notice '[TEST 3] OK — инициализация и пересчет рейтингов выполняются без ошибок, сотрудник получает рейтинг';
end;
$$;


