-- Добавляем поле phone в таблицу profiles для хранения номера телефона пользователя
-- Это поле не используется для авторизации, только для связи

-- Проверяем, является ли profiles view или таблицей
-- Если это view, создаем таблицу. Если таблица - добавляем поле.

-- Сначала проверяем, существует ли таблица profiles
DO $$
BEGIN
    -- Если profiles - это view, удаляем его и создаем таблицу
    IF EXISTS (
        SELECT 1 
        FROM information_schema.views 
        WHERE table_schema = 'public' 
        AND table_name = 'profiles'
    ) THEN
        -- Удаляем view
        DROP VIEW IF EXISTS public.profiles;
        
        -- Создаем таблицу profiles
        CREATE TABLE IF NOT EXISTS public.profiles (
            id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            full_name text,
            phone text
        );
        
        -- Включаем RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Создаем политики для RLS (базовые)
        -- Пользователи могут читать и обновлять только свой профиль
        CREATE POLICY "Users can view own profile" 
            ON public.profiles FOR SELECT 
            USING (auth.uid() = id);
        
        CREATE POLICY "Users can update own profile" 
            ON public.profiles FOR UPDATE 
            USING (auth.uid() = id);
        
        CREATE POLICY "Users can insert own profile" 
            ON public.profiles FOR INSERT 
            WITH CHECK (auth.uid() = id);
    ELSE
        -- Если это таблица, просто добавляем поле phone, если его еще нет
        IF NOT EXISTS (
            SELECT 1 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'profiles' 
            AND column_name = 'phone'
        ) THEN
            ALTER TABLE public.profiles ADD COLUMN phone text;
        END IF;
    END IF;
END $$;

-- Добавляем комментарий к полю
COMMENT ON COLUMN public.profiles.phone IS 'Номер телефона пользователя для связи (не используется для авторизации)';

