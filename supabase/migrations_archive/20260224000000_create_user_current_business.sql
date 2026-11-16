-- Хранение текущего выбранного бизнеса пользователя
-- Используется для явного выбора бизнеса владельцем/менеджером

CREATE TABLE IF NOT EXISTS public.user_current_business (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    biz_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.user_current_business IS 'Текущий выбранный бизнес пользователя (для кабинета владельца/менеджера)';
COMMENT ON COLUMN public.user_current_business.user_id IS 'ID пользователя (auth.users.id), для которого сохранён текущий бизнес';
COMMENT ON COLUMN public.user_current_business.biz_id IS 'ID текущего бизнеса пользователя (public.businesses.id)';
COMMENT ON COLUMN public.user_current_business.updated_at IS 'Время последнего изменения текущего бизнеса (UTC)';

-- Индекс по biz_id для возможной аналитики/фильтрации
CREATE INDEX IF NOT EXISTS user_current_business_biz_id_idx
    ON public.user_current_business (biz_id);

-- Обновляем updated_at при изменении строки
CREATE OR REPLACE FUNCTION public.user_current_business_set_updated_at()
RETURNS trigger AS $$
BEGIN
    NEW.updated_at := timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_user_current_business_set_updated_at
    ON public.user_current_business;

CREATE TRIGGER trg_user_current_business_set_updated_at
    BEFORE UPDATE ON public.user_current_business
    FOR EACH ROW
    EXECUTE FUNCTION public.user_current_business_set_updated_at();

-- Включаем RLS
ALTER TABLE public.user_current_business ENABLE ROW LEVEL SECURITY;

-- Пользователь может читать только свою запись о текущем бизнесе
CREATE POLICY "Users can select own current business"
    ON public.user_current_business
    FOR SELECT
    TO authenticated
    USING (user_id = auth.uid());

-- Пользователь может создавать запись только для себя
CREATE POLICY "Users can insert own current business"
    ON public.user_current_business
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

-- Пользователь может обновлять только свою запись
CREATE POLICY "Users can update own current business"
    ON public.user_current_business
    FOR UPDATE
    TO authenticated
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());

-- Пользователь может удалить только свою запись
CREATE POLICY "Users can delete own current business"
    ON public.user_current_business
    FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());

