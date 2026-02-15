# Применение миграции для метрик производительности фронтенда

## Миграция: `20250127000000_create_frontend_metrics_table.sql`

Эта миграция создает таблицу для хранения метрик производительности фронтенда:
- Core Web Vitals (LCP, FID, CLS, FCP, TTFB, INP)
- Время загрузки страниц
- Метрики рендеринга

## Способ 1: Supabase Dashboard (SQL Editor) - РЕКОМЕНДУЕТСЯ

### Шаг 1: Откройте Supabase Dashboard
1. Перейдите в https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**

### Шаг 2: Примените миграцию
1. Откройте файл `supabase/migrations/20250127000000_create_frontend_metrics_table.sql`
2. Скопируйте всё содержимое файла
3. Вставьте в SQL Editor
4. Нажмите **RUN** (F5)

## Способ 2: Supabase CLI

Если у вас настроен Supabase CLI:

```bash
# Убедитесь, что вы в корневой директории проекта
cd C:\projects\kezek

# Примените миграцию
npx supabase@latest db push
```

**Примечание:** Для использования CLI может потребоваться:
- Установка переменной окружения `SUPABASE_DB_PASSWORD`
- Настройка проекта через `npx supabase link --project-ref <project-id>`

## Проверка после применения

После применения миграции проверьте:

1. **Таблица создана:**
```sql
SELECT * FROM public.frontend_metrics LIMIT 1;
```

2. **Функция создана:**
```sql
SELECT proname FROM pg_proc WHERE proname = 'log_frontend_metric';
```

3. **Индексы созданы:**
```sql
SELECT indexname FROM pg_indexes WHERE tablename = 'frontend_metrics';
```

4. **RLS политики включены:**
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'frontend_metrics';
```

## Если возникли ошибки

1. **"relation already exists"** - таблица уже существует, это нормально (используется `CREATE TABLE IF NOT EXISTS`)
2. **"function already exists"** - функция уже существует, это нормально (используется `CREATE OR REPLACE FUNCTION`)
3. **"index already exists"** - индекс уже существует, это нормально (используется `CREATE INDEX IF NOT EXISTS`)

## После применения

После успешного применения миграции:
- Метрики производительности фронтенда будут автоматически сохраняться в таблицу `frontend_metrics`
- API endpoint `/api/metrics/frontend` начнет работать корректно
- Вы сможете анализировать производительность через SQL запросы или создать админ-панель для просмотра метрик

