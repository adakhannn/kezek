-- Создаём таблицу для расписания работы филиалов по дням недели
-- Аналогично working_hours, но для филиалов

CREATE TABLE IF NOT EXISTS public.branch_working_hours (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    biz_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    branch_id uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    day_of_week smallint NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = воскресенье, 1 = понедельник, ..., 6 = суббота
    intervals jsonb NOT NULL DEFAULT '[]'::jsonb, -- массив {start: "HH:mm", end: "HH:mm"}
    breaks jsonb NOT NULL DEFAULT '[]'::jsonb, -- массив {start: "HH:mm", end: "HH:mm"}
    created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Уникальность: один филиал может иметь только одно расписание на день недели
    UNIQUE(biz_id, branch_id, day_of_week)
);

COMMENT ON TABLE public.branch_working_hours IS 'Расписание работы филиалов по дням недели';
COMMENT ON COLUMN public.branch_working_hours.day_of_week IS 'День недели: 0 = воскресенье, 1 = понедельник, ..., 6 = суббота';
COMMENT ON COLUMN public.branch_working_hours.intervals IS 'Массив интервалов работы: [{start: "09:00", end: "18:00"}, ...]';
COMMENT ON COLUMN public.branch_working_hours.breaks IS 'Массив перерывов: [{start: "13:00", end: "14:00"}, ...]';

-- Индексы
CREATE INDEX IF NOT EXISTS branch_working_hours_biz_branch_idx 
    ON public.branch_working_hours(biz_id, branch_id);
CREATE INDEX IF NOT EXISTS branch_working_hours_branch_idx 
    ON public.branch_working_hours(branch_id);

-- RLS политики
ALTER TABLE public.branch_working_hours ENABLE ROW LEVEL SECURITY;

-- Владельцы бизнесов и менеджеры могут читать расписание своих филиалов
CREATE POLICY "Business owners and managers can select branch working hours"
    ON public.branch_working_hours
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = branch_working_hours.biz_id
              AND (
                  b.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.user_roles ur
                      JOIN public.roles r ON ur.role_id = r.id
                      WHERE ur.biz_id = b.id
                        AND ur.user_id = auth.uid()
                        AND r.key IN ('owner', 'manager')
                  )
              )
        )
    );

-- Владельцы бизнесов и менеджеры могут создавать расписание для своих филиалов
CREATE POLICY "Business owners and managers can insert branch working hours"
    ON public.branch_working_hours
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = branch_working_hours.biz_id
              AND (
                  b.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.user_roles ur
                      JOIN public.roles r ON ur.role_id = r.id
                      WHERE ur.biz_id = b.id
                        AND ur.user_id = auth.uid()
                        AND r.key IN ('owner', 'manager')
                  )
              )
        )
    );

-- Владельцы бизнесов и менеджеры могут обновлять расписание своих филиалов
CREATE POLICY "Business owners and managers can update branch working hours"
    ON public.branch_working_hours
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = branch_working_hours.biz_id
              AND (
                  b.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.user_roles ur
                      JOIN public.roles r ON ur.role_id = r.id
                      WHERE ur.biz_id = b.id
                        AND ur.user_id = auth.uid()
                        AND r.key IN ('owner', 'manager')
                  )
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = branch_working_hours.biz_id
              AND (
                  b.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.user_roles ur
                      JOIN public.roles r ON ur.role_id = r.id
                      WHERE ur.biz_id = b.id
                        AND ur.user_id = auth.uid()
                        AND r.key IN ('owner', 'manager')
                  )
              )
        )
    );

-- Владельцы бизнесов и менеджеры могут удалять расписание своих филиалов
CREATE POLICY "Business owners and managers can delete branch working hours"
    ON public.branch_working_hours
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.businesses b
            WHERE b.id = branch_working_hours.biz_id
              AND (
                  b.owner_id = auth.uid()
                  OR EXISTS (
                      SELECT 1
                      FROM public.user_roles ur
                      JOIN public.roles r ON ur.role_id = r.id
                      WHERE ur.biz_id = b.id
                        AND ur.user_id = auth.uid()
                        AND r.key IN ('owner', 'manager')
                  )
              )
        )
    );

