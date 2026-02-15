# Применение миграции вручную через Supabase Dashboard

## Проблема

Supabase CLI не может обработать миграцию с функцией PostgreSQL из-за ограничений парсера. Ошибка: `cannot insert multiple commands into a prepared statement`.

## Решение: Применить вручную через SQL Editor

### Шаг 1: Откройте Supabase Dashboard

1. Перейдите в https://supabase.com/dashboard
2. Выберите ваш проект
3. Откройте **SQL Editor** (в левом меню)

### Шаг 2: Примените миграции по порядку

#### 1. Миграция ограничений (уже применена через CLI)
Файл: `20260213000000_add_shift_constraints_and_transactions.sql`
✅ Должна быть уже применена

#### 2. Функция save_shift_items_atomic
Файл: `20260213000001_add_save_shift_items_function.sql`

Скопируйте и выполните:

```sql
create or replace function public.save_shift_items_atomic(
    p_shift_id uuid,
    p_items jsonb
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_shift_status text;
    v_result jsonb;
    v_item jsonb;
    v_inserted_count integer := 0;
    v_deleted_count integer := 0;
begin
    -- Проверяем, что смена существует и открыта
    select status
    into v_shift_status
    from public.staff_shifts
    where id = p_shift_id
    for update;  -- Блокируем строку для обновления
    
    if v_shift_status is null then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена не найдена'
        );
    end if;
    
    if v_shift_status != 'open' then
        return jsonb_build_object(
            'ok', false,
            'error', 'Смена должна быть открыта для сохранения позиций'
        );
    end if;
    
    -- Удаляем все существующие позиции для этой смены
    delete from public.staff_shift_items
    where shift_id = p_shift_id;
    
    get diagnostics v_deleted_count = row_count;
    
    -- Вставляем новые позиции
    if p_items is not null and jsonb_array_length(p_items) > 0 then
        insert into public.staff_shift_items (
            shift_id,
            client_name,
            service_name,
            service_amount,
            consumables_amount,
            booking_id,
            note,
            created_at
        )
        select
            p_shift_id,
            (item->>'clientName')::text,
            (item->>'serviceName')::text,
            coalesce(((item->>'serviceAmount')::numeric), 0),
            coalesce(((item->>'consumablesAmount')::numeric), 0),
            case when (item->>'bookingId')::text = '' then null else (item->>'bookingId')::uuid end,
            (item->>'note')::text,
            coalesce(
                ((item->>'createdAt')::timestamptz),
                timezone('utc'::text, now())
            )
        from jsonb_array_elements(p_items) as item
        where
            -- Сохраняем только если есть данные
            coalesce(((item->>'serviceAmount')::numeric), 0) > 0
            or coalesce(((item->>'consumablesAmount')::numeric), 0) > 0
            or (item->>'bookingId')::text is not null
            or ((item->>'clientName')::text is not null and (item->>'clientName')::text != '');
        
        get diagnostics v_inserted_count = row_count;
    end if;
    
    -- Возвращаем результат
    return jsonb_build_object(
        'ok', true,
        'deleted_count', v_deleted_count,
        'inserted_count', v_inserted_count
    );
    
exception
    when others then
        return jsonb_build_object(
            'ok', false,
            'error', 'Ошибка при сохранении позиций: ' || sqlerrm
        );
end;
$$;
```

#### 3. Права на выполнение функции
Файл: `20260213000002_grant_save_shift_items_permissions.sql`

```sql
grant execute on function public.save_shift_items_atomic(uuid, jsonb) to authenticated;
grant execute on function public.save_shift_items_atomic(uuid, jsonb) to service_role;
```

#### 4. Комментарий к функции
Файл: `20260213000003_comment_save_shift_items_function.sql`

```sql
comment on function public.save_shift_items_atomic is 'Атомарно сохраняет позиции смены в транзакции. Удаляет старые позиции и вставляет новые. Проверяет, что смена открыта.';
```

### Шаг 3: Проверка

После применения всех миграций, проверьте, что функция создана:

```sql
SELECT 
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname = 'save_shift_items_atomic';
```

Должна вернуться одна строка с функцией.

### Шаг 4: Отметьте миграции как примененные (опционально)

Если вы хотите, чтобы CLI знал, что миграции применены, вы можете вручную добавить записи в таблицу `supabase_migrations.schema_migrations`:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name)
VALUES 
    ('20260213000001', 'add_save_shift_items_function'),
    ('20260213000002', 'grant_save_shift_items_permissions'),
    ('20260213000003', 'comment_save_shift_items_function')
ON CONFLICT (version) DO NOTHING;
```

## Альтернатива: Применить через psql

Если у вас есть доступ к базе данных через `psql`, вы можете применить миграции так:

```bash
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20260213000001_add_save_shift_items_function.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20260213000002_grant_save_shift_items_permissions.sql
psql -h <your-db-host> -U postgres -d postgres -f supabase/migrations/20260213000003_comment_save_shift_items_function.sql
```
