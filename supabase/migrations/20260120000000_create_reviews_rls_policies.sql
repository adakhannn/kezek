-- RLS политики для таблицы reviews
-- Пользователи могут создавать отзывы только для своих бронирований
-- Пользователи могут читать и обновлять только свои отзывы
-- Владельцы бизнесов могут читать отзывы для своих сотрудников

-- Включаем RLS, если еще не включен
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Удаляем старые политики, если они есть
DROP POLICY IF EXISTS "Users can insert own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can select own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Business owners can select reviews for their staff" ON public.reviews;

-- Политика для INSERT: пользователи могут создавать отзывы только для своих бронирований
CREATE POLICY "Users can insert own reviews"
    ON public.reviews
    FOR INSERT
    TO authenticated
    WITH CHECK (
        -- Проверяем, что client_id совпадает с текущим пользователем
        client_id = auth.uid()
        -- Проверяем, что booking_id принадлежит текущему пользователю
        AND EXISTS (
            SELECT 1
            FROM public.bookings b
            WHERE b.id = reviews.booking_id
              AND b.client_id = auth.uid()
        )
    );

-- Политика для SELECT: пользователи могут читать свои отзывы
CREATE POLICY "Users can select own reviews"
    ON public.reviews
    FOR SELECT
    TO authenticated
    USING (
        -- Пользователь может читать свои отзывы
        client_id = auth.uid()
        -- Или владелец бизнеса может читать отзывы для своих сотрудников
        OR EXISTS (
            SELECT 1
            FROM public.bookings b
            JOIN public.staff s ON s.id = b.staff_id
            JOIN public.businesses biz ON biz.id = s.biz_id
            WHERE b.id = reviews.booking_id
              AND biz.owner_id = auth.uid()
        )
    );

-- Политика для UPDATE: пользователи могут обновлять только свои отзывы
CREATE POLICY "Users can update own reviews"
    ON public.reviews
    FOR UPDATE
    TO authenticated
    USING (client_id = auth.uid())
    WITH CHECK (client_id = auth.uid());

-- Комментарии
COMMENT ON POLICY "Users can insert own reviews" ON public.reviews IS 
    'Пользователи могут создавать отзывы только для своих бронирований';
COMMENT ON POLICY "Users can select own reviews" ON public.reviews IS 
    'Пользователи могут читать свои отзывы, владельцы бизнесов - отзывы для своих сотрудников';
COMMENT ON POLICY "Users can update own reviews" ON public.reviews IS 
    'Пользователи могут обновлять только свои отзывы';

