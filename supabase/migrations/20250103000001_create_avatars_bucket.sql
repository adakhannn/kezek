-- Создание bucket для аватарок сотрудников
-- Примечание: Создание bucket через SQL возможно только в Supabase CLI или через Dashboard
-- Если миграция не работает, создайте bucket вручную через Dashboard:
-- Storage → New bucket → Name: "avatars" → Public bucket: ON

-- Попытка создать bucket (работает только если у пользователя есть права)
-- Если bucket уже существует, команда проигнорируется
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'avatars',
    'avatars',
    true, -- публичный bucket
    5242880, -- 5MB лимит
    ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp'] -- разрешенные типы
)
ON CONFLICT (id) DO NOTHING;

-- Политика для загрузки файлов (INSERT) - только аутентифицированные пользователи могут загружать в папку staff-avatars
CREATE POLICY IF NOT EXISTS "Users can upload staff avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);

-- Политика для чтения файлов (SELECT) - все могут просматривать аватарки
CREATE POLICY IF NOT EXISTS "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Политика для удаления файлов (DELETE) - пользователи могут удалять только свои аватарки
-- Проверяем, что файл принадлежит текущему пользователю через staff.user_id
CREATE POLICY IF NOT EXISTS "Users can delete their own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
    AND EXISTS (
        SELECT 1 FROM staff
        WHERE staff.user_id = auth.uid()
        AND staff.avatar_url LIKE '%' || storage.objects.name
    )
);

-- Комментарий: если политика удаления не работает из-за сложной проверки,
-- можно использовать более простую версию ниже (раскомментируйте, если нужно):
/*
CREATE POLICY IF NOT EXISTS "Users can delete staff avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);
*/

