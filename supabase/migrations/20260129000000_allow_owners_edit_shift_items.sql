-- Добавляем политику для владельцев бизнеса, чтобы они могли редактировать позиции смен своих сотрудников

-- Удаляем старую политику, если она есть
DROP POLICY IF EXISTS "Business owners can manage staff shift items" ON public.staff_shift_items;

-- Владельцы, админы и менеджеры могут управлять позициями смен своих сотрудников
CREATE POLICY "Business owners can manage staff shift items"
    ON public.staff_shift_items
    FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.staff_shifts sh
            JOIN public.staff s ON s.id = sh.staff_id
            JOIN public.user_roles ur ON ur.biz_id = s.biz_id
            JOIN public.roles r ON ur.role_id = r.id
            WHERE sh.id = staff_shift_items.shift_id
              AND ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.staff_shifts sh
            JOIN public.staff s ON s.id = sh.staff_id
            JOIN public.user_roles ur ON ur.biz_id = s.biz_id
            JOIN public.roles r ON ur.role_id = r.id
            WHERE sh.id = staff_shift_items.shift_id
              AND ur.user_id = auth.uid()
              AND r.key IN ('owner', 'admin', 'manager')
        )
        OR is_super_admin()
    );

COMMENT ON POLICY "Business owners can manage staff shift items" ON public.staff_shift_items IS 
'Владельцы, админы и менеджеры могут редактировать позиции смен своих сотрудников';

