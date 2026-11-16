-- Добавляем столбцы для переводов названий услуг (киргизский и английский)

-- Добавляем столбец name_ky (киргизский)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS name_ky text;

-- Добавляем столбец name_en (английский)
ALTER TABLE public.services
ADD COLUMN IF NOT EXISTS name_en text;

-- Комментарии к столбцам
COMMENT ON COLUMN public.services.name_ky IS 'Название услуги на киргизском языке';
COMMENT ON COLUMN public.services.name_en IS 'Название услуги на английском языке';

-- Обновляем документацию
COMMENT ON TABLE public.services IS 'Услуги бизнеса. Каждая услуга может иметь переводы на киргизский (name_ky) и английский (name_en) языки.';

