-- Отладка: воспроизведение вставки смены как в API dashboard/staff/[id]/shift/open
-- Запустите в Supabase SQL Editor (Dashboard → SQL Editor) — в ответе будет точная ошибка Postgres.
-- Подставьте свои staff_id и дату при необходимости.

BEGIN;

DO $$
DECLARE
    v_staff_id uuid := 'bae78780-4532-44b1-9045-215ec1432628';
    v_biz_id uuid;
    v_branch_id uuid;
    v_shift_date date := '2026-03-03';
    v_opened_at timestamptz := now();
    v_late_minutes int := 0;
BEGIN
    SELECT s.biz_id, s.branch_id INTO v_biz_id, v_branch_id
    FROM public.staff s
    WHERE s.id = v_staff_id;

    IF v_biz_id IS NULL THEN
        RAISE EXCEPTION 'Staff not found: %', v_staff_id;
    END IF;
    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Staff has no branch_id: %', v_staff_id;
    END IF;

    -- Та же вставка, что и в API
    INSERT INTO public.staff_shifts (
        staff_id, biz_id, branch_id, shift_date, status, opened_at, late_minutes
    ) VALUES (
        v_staff_id, v_biz_id, v_branch_id, v_shift_date, 'open', v_opened_at, v_late_minutes
    );

    RAISE NOTICE 'Insert OK';
END;
$$;

ROLLBACK;  -- не сохраняем, только смотрим ошибку (уберите ROLLBACK если нужно оставить строку)
