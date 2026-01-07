-- Добавляем поля для Яндекс OAuth в таблицу profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS yandex_id TEXT,
ADD COLUMN IF NOT EXISTS yandex_username TEXT;

-- Создаем индекс для быстрого поиска по yandex_id
CREATE INDEX IF NOT EXISTS idx_profiles_yandex_id ON profiles(yandex_id) WHERE yandex_id IS NOT NULL;

-- Комментарии к колонкам
COMMENT ON COLUMN profiles.yandex_id IS 'ID пользователя в Яндекс ID';
COMMENT ON COLUMN profiles.yandex_username IS 'Логин пользователя в Яндекс ID';

