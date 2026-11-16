-- Примечание: Bucket должен быть создан вручную через Dashboard:
-- Storage → New bucket → Name: "avatars" → Public bucket: ON

-- На Supabase нет синтаксиса CREATE POLICY IF NOT EXISTS,
-- поэтому сначала аккуратно дропаем старые политики (если они есть),
-- а затем создаём новые.
DROP POLICY IF EXISTS "Users can upload staff avatars" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete staff avatars" ON storage.objects;

-- Политика для загрузки файлов (INSERT) - только аутентифицированные пользователи могут загружать в папку staff-avatars
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

-- Политика для удаления файлов (DELETE) - пользователи могут удалять файлы из папки staff-avatars
-- Упрощенная версия: любой аутентифицированный пользователь может удалять файлы из staff-avatars
CREATE POLICY "Users can delete staff avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND (storage.foldername(name))[1] = 'staff-avatars'
);
