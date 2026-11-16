-- Позволяем сотрудникам видеть только свои правила расписания в staff_schedule_rules
-- Это нужно для корректной работы /api/staff/shift/open, где проверяется, является ли сегодня рабочим днём.

-- RLS уже включён и есть политика для менеджеров/владельцев:
-- "Business managers can manage staff_schedule_rules"
-- Здесь добавляем отдельную политику только на SELECT для сотрудников.

DO $$
BEGIN
    -- На всякий случай удаляем старую политику с тем же именем, если она была
    IF EXISTS (
        SELECT 1
        FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'staff_schedule_rules'
          AND policyname = 'Staff can view own schedule_rules'
    ) THEN
        DROP POLICY "Staff can view own schedule_rules" ON public.staff_schedule_rules;
    END IF;

    CREATE POLICY "Staff can view own schedule_rules"
        ON public.staff_schedule_rules
        FOR SELECT
        TO authenticated
        USING (
            -- Разрешаем доступ только к тем правилам, где staff_id принадлежит
            -- сотруднику, связанному с текущим пользователем (auth.uid()).
            staff_id IN (
                SELECT s.id
                FROM public.staff s
                WHERE s.user_id = auth.uid()
            )
        );
END
$$;

