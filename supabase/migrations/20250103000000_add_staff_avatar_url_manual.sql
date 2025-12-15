-- Добавляем поле avatar_url в таблицу staff
-- Выполните этот SQL в Supabase Dashboard → SQL Editor

-- Проверяем, существует ли колонка, и добавляем если нет
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'staff' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE staff ADD COLUMN avatar_url TEXT;
        COMMENT ON COLUMN staff.avatar_url IS 'URL аватарки сотрудника в Supabase Storage';
        RAISE NOTICE 'Колонка avatar_url успешно добавлена в таблицу staff';
    ELSE
        RAISE NOTICE 'Колонка avatar_url уже существует в таблице staff';
    END IF;
END $$;

