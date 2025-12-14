-- Упрощенные RLS политики для bucket "avatars"
-- Выполните этот SQL в Supabase Dashboard → SQL Editor
-- Этот скрипт создает максимально простые политики для тестирования

-- Сначала удаляем все существующие политики для bucket avatars
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE '%avatar%') LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', r.policyname);
    END LOOP;
END $$;

-- ВАРИАНТ 1: Максимально простые политики (для тестирования)
-- Разрешаем всем аутентифицированным пользователям все операции с bucket avatars

-- Загрузка (INSERT)
CREATE POLICY "Allow authenticated upload to avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- Чтение (SELECT) - публичный доступ
CREATE POLICY "Allow public read from avatars"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- Удаление (DELETE)
CREATE POLICY "Allow authenticated delete from avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars');

-- Обновление (UPDATE)
CREATE POLICY "Allow authenticated update in avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars')
WITH CHECK (bucket_id = 'avatars');

