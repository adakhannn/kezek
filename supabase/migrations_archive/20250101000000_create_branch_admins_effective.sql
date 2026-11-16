-- Функция для получения всех эффективных администраторов филиала
-- Возвращает владельца бизнеса, администраторов бизнеса и явных администраторов филиала

CREATE OR REPLACE FUNCTION public.branch_admins_effective(p_branch_id uuid)
RETURNS TABLE (
    user_id uuid,
    source text
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_biz_id uuid;
BEGIN
    -- Получаем biz_id филиала
    SELECT biz_id INTO v_biz_id
    FROM branches
    WHERE id = p_branch_id;
    
    IF v_biz_id IS NULL THEN
        RETURN;
    END IF;
    
    -- Возвращаем UNION всех администраторов:
    -- 1. Владелец бизнеса
    RETURN QUERY
    SELECT 
        b.owner_id as user_id,
        'owner'::text as source
    FROM businesses b
    WHERE b.id = v_biz_id
      AND b.owner_id IS NOT NULL;
    
    -- 2. Администраторы бизнеса (через user_roles с ролью 'admin')
    RETURN QUERY
    SELECT DISTINCT
        ur.user_id,
        'biz_admin'::text as source
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.biz_id = v_biz_id
      AND r.key = 'admin';
    
    -- 3. Явные администраторы филиала
    RETURN QUERY
    SELECT 
        ba.user_id,
        'branch_admin'::text as source
    FROM branch_admins ba
    WHERE ba.branch_id = p_branch_id;
    
END;
$$;

-- Комментарий к функции
COMMENT ON FUNCTION public.branch_admins_effective(uuid) IS 
'Возвращает всех эффективных администраторов филиала: владелец бизнеса, администраторы бизнеса и явные администраторы филиала';

-- Даём права на выполнение функции для анонимного пользователя (через RLS будет проверяться доступ)
GRANT EXECUTE ON FUNCTION public.branch_admins_effective(uuid) TO anon, authenticated;

