-- Исправление RLS политик для bucket "avatars"
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- Сначала удаляем существующие политики (если есть), чтобы избежать конфликтов
DROP POLICY IF EXISTS "Users can upload staff avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete staff avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Политика для загрузки файлов (INSERT) - аутентифицированные пользователи могут загружать в папку staff-avatars
CREATE POLICY "Users can upload staff avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);

-- Политика для чтения файлов (SELECT) - все могут просматривать аватарки
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Политика для удаления файлов (DELETE) - аутентифицированные пользователи могут удалять файлы из папки staff-avatars
CREATE POLICY "Users can delete staff avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);

-- Политика для обновления файлов (UPDATE) - на случай, если нужно обновить метаданные
CREATE POLICY "Users can update staff avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
)
WITH CHECK (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);

