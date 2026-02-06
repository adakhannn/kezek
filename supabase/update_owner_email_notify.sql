-- Обновление email_notify_to для бизнеса владельца
-- Этот скрипт находит бизнес по email владельца и обновляет email_notify_to

-- Вариант 1: Обновить для конкретного email владельца
-- Замените 'lowfade.9909@gmail.com' на email из auth.users
-- И 'low.fade.osh@gmail.com' на нужный email для уведомлений
UPDATE businesses 
SET email_notify_to = ARRAY['low.fade.osh@gmail.com']
WHERE owner_id IN (
    SELECT id 
    FROM auth.users 
    WHERE email = 'lowfade.9909@gmail.com'
);

-- Проверка результата
SELECT 
    b.id,
    b.name,
    b.slug,
    b.email_notify_to,
    u.email as owner_email
FROM businesses b
LEFT JOIN auth.users u ON u.id = b.owner_id
WHERE u.email = 'lowfade.9909@gmail.com';

