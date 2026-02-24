-- Одноразовый бэкофилл current_biz_id для существующих пользователей
-- Логика:
-- 1) Если у пользователя есть роли owner/admin/manager с привязанным biz_id — берём минимальный biz_id (детерминированно).
-- 2) Иначе, если пользователь является owner хотя бы одного бизнеса — берём минимальный id бизнеса (детерминированно).
-- 3) Результат записываем в user_current_business, если у пользователя ещё нет записи.

DO $$
BEGIN
    -- Вычисляем кандидатный бизнес для каждого пользователя
    WITH role_candidates AS (
        SELECT
            ur.user_id,
            ur.biz_id,
            ROW_NUMBER() OVER (
                PARTITION BY ur.user_id
                ORDER BY ur.biz_id ASC
            ) AS rn
        FROM public.user_roles ur
        JOIN public.roles r
            ON r.id = ur.role_id
        WHERE r.key IN ('owner', 'admin', 'manager')
          AND ur.biz_id IS NOT NULL
    ),
    role_choice AS (
        SELECT user_id, biz_id
        FROM role_candidates
        WHERE rn = 1
    ),
    owner_candidates AS (
        SELECT
            b.owner_id AS user_id,
            b.id AS biz_id,
            ROW_NUMBER() OVER (
                PARTITION BY b.owner_id
                ORDER BY b.id ASC
            ) AS rn
        FROM public.businesses b
        WHERE b.owner_id IS NOT NULL
    ),
    owner_choice AS (
        SELECT user_id, biz_id
        FROM owner_candidates
        WHERE rn = 1
    ),
    combined AS (
        -- Сначала выбор по ролям
        SELECT rc.user_id, rc.biz_id
        FROM role_choice rc
        UNION
        -- Если по ролям нет — используем бизнесы, где пользователь owner
        SELECT oc.user_id, oc.biz_id
        FROM owner_choice oc
        WHERE NOT EXISTS (
            SELECT 1
            FROM role_choice rc2
            WHERE rc2.user_id = oc.user_id
        )
    )
    INSERT INTO public.user_current_business (user_id, biz_id)
    SELECT c.user_id, c.biz_id
    FROM combined c
    LEFT JOIN public.user_current_business ucb
        ON ucb.user_id = c.user_id
    WHERE ucb.user_id IS NULL;
END $$;

