-- Supabase Security Advisor: RLS для таблиц public и отзыв доступа к представлениям/функциям
-- 1. RLS для staff_schedule_rules, staff_time_off, staff_branch_assignments
-- 2. RLS для business_daily_stats, business_hourly_load
-- 3. Отзыв SELECT с представлений, раскрывающих auth.users (anon/authenticated)
-- 4. Ограничение branch_admins_effective: только service_role
-- 5. spatial_ref_sys (PostGIS) не меняем (нет прав владельца)

-- =============================================================================
-- 1. staff_schedule_rules, staff_time_off, staff_branch_assignments
-- =============================================================================

-- staff_schedule_rules
ALTER TABLE public.staff_schedule_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business managers can manage staff_schedule_rules" ON public.staff_schedule_rules;
CREATE POLICY "Business managers can manage staff_schedule_rules"
    ON public.staff_schedule_rules
    FOR ALL
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    );

-- staff_time_off
ALTER TABLE public.staff_time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business managers can manage staff_time_off" ON public.staff_time_off;
CREATE POLICY "Business managers can manage staff_time_off"
    ON public.staff_time_off
    FOR ALL
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    );

-- staff_branch_assignments
ALTER TABLE public.staff_branch_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business managers can manage staff_branch_assignments" ON public.staff_branch_assignments;
CREATE POLICY "Business managers can manage staff_branch_assignments"
    ON public.staff_branch_assignments
    FOR ALL
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    );

-- =============================================================================
-- 2. business_daily_stats, business_hourly_load
-- =============================================================================

ALTER TABLE public.business_daily_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business managers can view business_daily_stats" ON public.business_daily_stats;
CREATE POLICY "Business managers can view business_daily_stats"
    ON public.business_daily_stats
    FOR SELECT
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    );

-- Запись/обновление только через service_role (cron/API), RLS не даёт писать authenticated.


ALTER TABLE public.business_hourly_load ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Business managers can view business_hourly_load" ON public.business_hourly_load;
CREATE POLICY "Business managers can view business_hourly_load"
    ON public.business_hourly_load
    FOR SELECT
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR public.is_super_admin()
    );

-- Запись только через service_role (cron/API).

-- =============================================================================
-- 3. Отзыв SELECT с представлений, раскрывающих auth.users
-- anon не может читать; authenticated оставлен для совместимости (API после проверки прав).
-- Для полного снятия с authenticated перевести все запросы к этим view на service_role.
-- =============================================================================

DO $$
DECLARE
    views text[] := ARRAY[
        'user_roles_with_user', 'auth_users_view', 'current_user_roles',
        'current_staff_branch', 'user_roles_legacy'
    ];
    v name;
BEGIN
    FOREACH v IN ARRAY views
    LOOP
        IF EXISTS (
            SELECT 1 FROM information_schema.views
            WHERE table_schema = 'public' AND table_name = v
        ) THEN
            EXECUTE format('REVOKE SELECT ON public.%I FROM anon', v);
            RAISE NOTICE 'Revoked SELECT on public.% from anon', v;
        END IF;
    END LOOP;
END $$;

-- =============================================================================
-- 4. branch_admins_effective: только service_role (SECURITY DEFINER)
-- =============================================================================

REVOKE EXECUTE ON FUNCTION public.branch_admins_effective(uuid) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.branch_admins_effective(uuid) TO service_role;

-- 5. spatial_ref_sys (PostGIS) не трогаем: таблица принадлежит расширению,
-- миграции выполняются не владельцем — ALTER TABLE даёт 42501 (must be owner).
-- Ограничить доступ при необходимости может только суперпользователь Supabase.
