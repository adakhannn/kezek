-- Добавляем поле avatar_url в таблицу staff
ALTER TABLE staff
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Комментарий к полю
COMMENT ON COLUMN staff.avatar_url IS 'URL аватарки сотрудника в Supabase Storage';

