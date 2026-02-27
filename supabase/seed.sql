-- Seed file for local development
-- This file is executed after migrations during `supabase db reset`
--
-- Важно: сиды должны быть детерминированными и работать на "чистой" базе,
-- которая только что прошла миграции.

-----------------------------
-- RATING-E2E-2:
-- Минимальный сценарий для E2E‑тестов рейтингов
-- Создаем тестовый бизнес/филиал/сотрудника и инициализируем рейтинги,
-- чтобы страницы /admin/ratings-status и /admin/ratings-debug имели стабильные данные.
-----------------------------

do $$
declare
    v_biz_id uuid;
    v_branch_id uuid;
    v_staff_id uuid;
begin
    -- Тестовый бизнес для рейтингов E2E
    insert into public.businesses (name, slug, is_approved, rating_score)
    values ('RATINGS_E2E_BIZ', 'ratings-e2e-biz', true, null)
    returning id into v_biz_id;

    -- Тестовый филиал
    insert into public.branches (biz_id, name, is_active, rating_score)
    values (v_biz_id, 'RATINGS_E2E_BRANCH', true, null)
    returning id into v_branch_id;

    -- Тестовый сотрудник
    insert into public.staff (biz_id, branch_id, full_name, is_active, rating_score)
    values (v_biz_id, v_branch_id, 'RATINGS E2E STAFF', true, null)
    returning id into v_staff_id;

    -- Инициализируем рейтинги для всех сущностей (использует активную rating_global_config)
    perform public.initialize_all_ratings(30);

    -- Пересчитываем рейтинги за вчерашний день, чтобы появились дневные метрики
    perform public.recalculate_ratings_for_date(current_date - interval '1 day');
end;
$$;

