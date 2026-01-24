-- Аудит и усиление RLS политик для основных таблиц
-- Цель: убедиться, что владельцы бизнесов не могут видеть данные других бизнесов,
-- сотрудники не могут изменять данные других сотрудников,
-- и клиенты не могут видеть чужие бронирования

-- ============================================================================
-- 1. BUSINESSES
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.businesses ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Business owners can view own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Business owners can update own businesses" ON public.businesses;
DROP POLICY IF EXISTS "Public can view approved businesses" ON public.businesses;
DROP POLICY IF EXISTS "Super admins can manage all businesses" ON public.businesses;

-- Владельцы могут видеть только свои бизнесы
CREATE POLICY "Business owners can view own businesses"
    ON public.businesses
    FOR SELECT
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND ur.biz_id = businesses.id
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Владельцы могут обновлять только свои бизнесы
CREATE POLICY "Business owners can update own businesses"
    ON public.businesses
    FOR UPDATE
    TO authenticated
    USING (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND ur.biz_id = businesses.id
              AND r.key IN ('owner', 'admin')
        )
        OR is_super_admin()
    )
    WITH CHECK (
        owner_id = auth.uid()
        OR EXISTS (
            SELECT 1
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND ur.biz_id = businesses.id
              AND r.key IN ('owner', 'admin')
        )
        OR is_super_admin()
    );

-- Публичный доступ на чтение для одобренных бизнесов
CREATE POLICY "Public can view approved businesses"
    ON public.businesses
    FOR SELECT
    TO anon, authenticated
    USING (is_approved = true);

-- Суперадмины могут управлять всеми бизнесами
CREATE POLICY "Super admins can manage all businesses"
    ON public.businesses
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ============================================================================
-- 2. BRANCHES
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Business owners can view own branches" ON public.branches;
DROP POLICY IF EXISTS "Business owners can manage own branches" ON public.branches;
DROP POLICY IF EXISTS "Public can view active branches" ON public.branches;
DROP POLICY IF EXISTS "Super admins can manage all branches" ON public.branches;

-- Владельцы могут видеть только филиалы своих бизнесов
CREATE POLICY "Business owners can view own branches"
    ON public.branches
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
        OR is_super_admin()
    );

-- Владельцы могут управлять только филиалами своих бизнесов
CREATE POLICY "Business owners can manage own branches"
    ON public.branches
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
        OR is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Публичный доступ на чтение для активных филиалов
CREATE POLICY "Public can view active branches"
    ON public.branches
    FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND biz_id IN (
            SELECT id FROM public.businesses WHERE is_approved = true
        )
    );

-- Суперадмины могут управлять всеми филиалами
CREATE POLICY "Super admins can manage all branches"
    ON public.branches
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ============================================================================
-- 3. STAFF
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Business owners can view own staff" ON public.staff;
DROP POLICY IF EXISTS "Business owners can manage own staff" ON public.staff;
DROP POLICY IF EXISTS "Staff can view own profile" ON public.staff;
DROP POLICY IF EXISTS "Staff can update own profile" ON public.staff;
DROP POLICY IF EXISTS "Public can view active staff" ON public.staff;
DROP POLICY IF EXISTS "Super admins can manage all staff" ON public.staff;

-- Владельцы могут видеть только сотрудников своих бизнесов
CREATE POLICY "Business owners can view own staff"
    ON public.staff
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
        OR is_super_admin()
    );

-- Владельцы могут управлять только сотрудниками своих бизнесов
CREATE POLICY "Business owners can manage own staff"
    ON public.staff
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
        OR is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Сотрудники могут видеть только свой профиль
CREATE POLICY "Staff can view own profile"
    ON public.staff
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Сотрудники могут обновлять только свой профиль (ограниченные поля)
CREATE POLICY "Staff can update own profile"
    ON public.staff
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (
        user_id = auth.uid()
        -- Сотрудники не могут изменять критичные поля через RLS
        -- (это должно контролироваться на уровне API)
    );

-- Публичный доступ на чтение для активных сотрудников
CREATE POLICY "Public can view active staff"
    ON public.staff
    FOR SELECT
    TO anon, authenticated
    USING (
        is_active = true
        AND biz_id IN (
            SELECT id FROM public.businesses WHERE is_approved = true
        )
    );

-- Суперадмины могут управлять всеми сотрудниками
CREATE POLICY "Super admins can manage all staff"
    ON public.staff
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ============================================================================
-- 4. SERVICES
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Business owners can view own services" ON public.services;
DROP POLICY IF EXISTS "Business owners can manage own services" ON public.services;
DROP POLICY IF EXISTS "Public can view active services" ON public.services;
DROP POLICY IF EXISTS "Super admins can manage all services" ON public.services;

-- Владельцы могут видеть только услуги своих бизнесов
CREATE POLICY "Business owners can view own services"
    ON public.services
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
        OR is_super_admin()
    );

-- Владельцы могут управлять только услугами своих бизнесов
CREATE POLICY "Business owners can manage own services"
    ON public.services
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
        OR is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Публичный доступ на чтение для активных услуг
CREATE POLICY "Public can view active services"
    ON public.services
    FOR SELECT
    TO anon, authenticated
    USING (
        active = true
        AND biz_id IN (
            SELECT id FROM public.businesses WHERE is_approved = true
        )
    );

-- Суперадмины могут управлять всеми услугами
CREATE POLICY "Super admins can manage all services"
    ON public.services
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ============================================================================
-- 5. BOOKINGS
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Clients can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can create own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Clients can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Business owners can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Business owners can update own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Staff can view own bookings" ON public.bookings;
DROP POLICY IF EXISTS "Super admins can manage all bookings" ON public.bookings;

-- Клиенты могут видеть только свои бронирования
CREATE POLICY "Clients can view own bookings"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        client_id = auth.uid()
        OR (client_phone IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND phone = bookings.client_phone
        ))
    );

-- Клиенты могут создавать только свои бронирования
CREATE POLICY "Clients can create own bookings"
    ON public.bookings
    FOR INSERT
    TO authenticated
    WITH CHECK (
        client_id = auth.uid()
        OR client_id IS NULL  -- Для гостевых бронирований
    );

-- Клиенты могут обновлять только свои бронирования (ограниченные поля)
CREATE POLICY "Clients can update own bookings"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
        client_id = auth.uid()
        OR (client_phone IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND phone = bookings.client_phone
        ))
    )
    WITH CHECK (
        client_id = auth.uid()
        OR (client_phone IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.profiles
            WHERE id = auth.uid()
              AND phone = bookings.client_phone
        ))
    );

-- Владельцы бизнесов могут видеть бронирования своих бизнесов
CREATE POLICY "Business owners can view own bookings"
    ON public.bookings
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
        OR is_super_admin()
    );

-- Владельцы бизнесов могут обновлять бронирования своих бизнесов
CREATE POLICY "Business owners can update own bookings"
    ON public.bookings
    FOR UPDATE
    TO authenticated
    USING (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    )
    WITH CHECK (
        biz_id IN (
            SELECT ur.biz_id
            FROM public.user_roles ur
            JOIN public.roles r ON ur.role_id = r.id
            WHERE ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Сотрудники могут видеть бронирования, где они назначены
CREATE POLICY "Staff can view own bookings"
    ON public.bookings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.staff s
            WHERE s.id = bookings.staff_id
              AND s.user_id = auth.uid()
              AND s.is_active = true
        )
    );

-- Суперадмины могут управлять всеми бронированиями
CREATE POLICY "Super admins can manage all bookings"
    ON public.bookings
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- ============================================================================
-- 6. SERVICE_STAFF
-- ============================================================================
-- Включаем RLS, если еще не включен
ALTER TABLE public.service_staff ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Business owners can manage service_staff" ON public.service_staff;
DROP POLICY IF EXISTS "Super admins can manage all service_staff" ON public.service_staff;

-- Владельцы могут управлять связями услуга-сотрудник только для своих бизнесов
CREATE POLICY "Business owners can manage service_staff"
    ON public.service_staff
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.services svc
            JOIN public.user_roles ur ON ur.biz_id = svc.biz_id
            JOIN public.roles r ON ur.role_id = r.id
            WHERE svc.id = service_staff.service_id
              AND ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.services svc
            JOIN public.user_roles ur ON ur.biz_id = svc.biz_id
            JOIN public.roles r ON ur.role_id = r.id
            WHERE svc.id = service_staff.service_id
              AND ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

-- Суперадмины могут управлять всеми связями
CREATE POLICY "Super admins can manage all service_staff"
    ON public.service_staff
    FOR ALL
    TO authenticated
    USING (is_super_admin())
    WITH CHECK (is_super_admin());

-- Комментарии
COMMENT ON POLICY "Business owners can view own businesses" ON public.businesses IS
    'Владельцы могут видеть только свои бизнесы';
COMMENT ON POLICY "Business owners can update own businesses" ON public.businesses IS
    'Владельцы могут обновлять только свои бизнесы';
COMMENT ON POLICY "Business owners can view own branches" ON public.branches IS
    'Владельцы могут видеть только филиалы своих бизнесов';
COMMENT ON POLICY "Business owners can manage own branches" ON public.branches IS
    'Владельцы могут управлять только филиалами своих бизнесов';
COMMENT ON POLICY "Business owners can view own staff" ON public.staff IS
    'Владельцы могут видеть только сотрудников своих бизнесов';
COMMENT ON POLICY "Business owners can manage own staff" ON public.staff IS
    'Владельцы могут управлять только сотрудниками своих бизнесов';
COMMENT ON POLICY "Staff can view own profile" ON public.staff IS
    'Сотрудники могут видеть только свой профиль';
COMMENT ON POLICY "Staff can update own profile" ON public.staff IS
    'Сотрудники могут обновлять только свой профиль';
COMMENT ON POLICY "Business owners can view own services" ON public.services IS
    'Владельцы могут видеть только услуги своих бизнесов';
COMMENT ON POLICY "Business owners can manage own services" ON public.services IS
    'Владельцы могут управлять только услугами своих бизнесов';
COMMENT ON POLICY "Clients can view own bookings" ON public.bookings IS
    'Клиенты могут видеть только свои бронирования';
COMMENT ON POLICY "Business owners can view own bookings" ON public.bookings IS
    'Владельцы могут видеть бронирования своих бизнесов';
COMMENT ON POLICY "Staff can view own bookings" ON public.bookings IS
    'Сотрудники могут видеть бронирования, где они назначены';

