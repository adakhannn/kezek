-- Проверка профиля мастера
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- 1. Проверяем, существует ли профиль для мастера
-- Замените '3fb32919-87d1-4551-a015-a30186d0b5d2' на нужный user_id
SELECT 
    p.id,
    p.full_name,
    p.phone,
    p.telegram_id,
    p.telegram_username,
    p.telegram_verified,
    p.notify_telegram,
    s.id as staff_id,
    s.full_name as staff_name,
    s.email as staff_email,
    s.user_id as staff_user_id
FROM profiles p
FULL OUTER JOIN staff s ON p.id = s.user_id
WHERE s.user_id = '3fb32919-87d1-4551-a015-a30186d0b5d2'
   OR p.id = '3fb32919-87d1-4551-a015-a30186d0b5d2';

-- 2. Проверяем все мастера и их профили
SELECT 
    s.id as staff_id,
    s.full_name as staff_name,
    s.email as staff_email,
    s.user_id,
    CASE 
        WHEN p.id IS NULL THEN 'НЕТ ПРОФИЛЯ'
        ELSE 'ЕСТЬ ПРОФИЛЬ'
    END as profile_status,
    p.telegram_id,
    p.telegram_verified,
    p.notify_telegram
FROM staff s
LEFT JOIN profiles p ON s.user_id = p.id
WHERE s.user_id IS NOT NULL
ORDER BY s.full_name;

-- 3. Проверяем, существует ли пользователь в auth.users
-- Примечание: raw_user_meta_data содержит метаданные пользователя в формате JSON
SELECT 
    id,
    email,
    phone,
    created_at,
    raw_user_meta_data
FROM auth.users
WHERE id = '3fb32919-87d1-4551-a015-a30186d0b5d2';

-- 4. Если профиля нет, создаем его (замените данные на реальные)
-- INSERT INTO profiles (id, full_name, notify_telegram, telegram_verified)
-- VALUES (
--     '3fb32919-87d1-4551-a015-a30186d0b5d2',
--     'Adakhan',  -- имя мастера
--     true,       -- включить уведомления в Telegram
--     false       -- telegram не верифицирован (пока)
-- )
-- ON CONFLICT (id) DO UPDATE SET
--     full_name = EXCLUDED.full_name,
--     notify_telegram = EXCLUDED.notify_telegram;

