# Инструкция по применению миграций

## Способ 1: Supabase Dashboard (SQL Editor) - РЕКОМЕНДУЕТСЯ

### Шаг 1: Откройте Supabase Dashboard
1. Перейдите в https://supabase.com/dashboard
2. Выберите ваш проект
3. Перейдите в раздел **SQL Editor**

### Шаг 2: Примените миграции по порядку

Выполните миграции в следующем порядке (скопируйте содержимое каждого файла):

#### 1. `20260123000000_create_branch_promotions.sql`
- Скопируйте содержимое файла `supabase/migrations/20260123000000_create_branch_promotions.sql`
- Вставьте в SQL Editor
- Нажмите **RUN** (F5)

#### 2. `20260123000001_add_apply_promotion_function.sql`
- Скопируйте содержимое файла `supabase/migrations/20260123000001_add_apply_promotion_function.sql`
- Вставьте в SQL Editor
- Нажмите **RUN** (F5)

#### 3. `20260123000002_initialize_ratings.sql`
- Скопируйте содержимое файла `supabase/migrations/20260123000002_initialize_ratings.sql`
- Вставьте в SQL Editor
- Нажмите **RUN** (F5)

### Шаг 3: Инициализация рейтингов

После применения всех миграций, выполните инициализацию рейтингов:

```sql
-- Пересчитать рейтинги за последние 30 дней и установить начальные значения
SELECT public.initialize_all_ratings(30);
```

Или через API (из админки или curl):
```bash
POST https://kezek.kg/api/admin/initialize-ratings
Headers: Authorization: Bearer <ваш_токен>
Body: { "days_back": 30 }
```

**Рекомендации по запуску инициализации и пересчёта рейтингов**

- **Допустимый диапазон `days_back`:** от 1 до 365 (в API проверяется автоматически). По умолчанию — 30.
- **Рекомендуемые значения:**
  - **30** — обычный запуск после деплоя или для еженедельной/ежемесячной синхронизации.
  - **60–90** — при необходимости подтянуть более длинную историю.
  - **365** — полный пересчёт за год; использовать только при явной необходимости (миграция данных, смена логики рейтингов).
- **Время запуска:** инициализация и массовый пересчёт за большой период создают заметную нагрузку на БД. Запускайте их **в период минимальной нагрузки** (например, ночью или в нерабочие часы). Избегайте запуска с большим `days_back` в часы пика.

**Для очень больших баз (батчевый режим):** чтобы не превышать таймаут одного запроса, можно разбить пересчёт по диапазонам дат и в конце обновить агрегаты:

1. Вызвать API несколько раз с телом `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD" }` (диапазон не более 31 дня), покрывая нужный период кусками по 7–14 дней.
2. Один раз вызвать с телом `{ "finalize_only": true }` — обновятся агрегированные рейтинги по уже рассчитанным метрикам.

Пример (последние 90 дней по 7 дней): 13 запросов с `start_date`/`end_date` (например, 2025-01-01–2025-01-07, 2025-01-08–2025-01-14, …), затем один запрос с `finalize_only: true`.

## Способ 2: Supabase CLI (требует настройки)

Если хотите использовать CLI, сначала настройте переменные окружения:

1. Установите `SUPABASE_DB_PASSWORD` (если известен):
```bash
# Windows PowerShell
$env:SUPABASE_DB_PASSWORD = "ваш_пароль"

# Windows CMD
set SUPABASE_DB_PASSWORD=ваш_пароль

# Linux/Mac
export SUPABASE_DB_PASSWORD="ваш_пароль"
```

2. Затем выполните:
```bash
npx supabase@latest db push
```

**Примечание:** Пароль БД можно найти в Supabase Dashboard → Settings → Database → Connection string (postgres://postgres:[YOUR-PASSWORD]@...)

## Проверка после применения

После применения миграций проверьте:

1. **Таблицы акций созданы:**
```sql
SELECT * FROM public.branch_promotions LIMIT 1;
SELECT * FROM public.client_promotion_usage LIMIT 1;
SELECT * FROM public.client_referrals LIMIT 1;
```

2. **Функции акций созданы:**
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%promotion%';
```

3. **Функции рейтингов созданы:**
```sql
SELECT proname FROM pg_proc WHERE proname LIKE '%rating%' OR proname LIKE '%initialize%';
```

4. **Для батчевого режима** нужна миграция `20260226100000_rating_batched_support.sql` (функция `update_all_aggregated_ratings`).

4. **Начальные рейтинги установлены:**
```sql
SELECT COUNT(*) FROM public.businesses WHERE rating_score IS NOT NULL AND rating_score > 0;
SELECT COUNT(*) FROM public.branches WHERE rating_score IS NOT NULL AND rating_score > 0;
SELECT COUNT(*) FROM public.staff WHERE rating_score IS NOT NULL AND rating_score > 0;
```

## Если возникли ошибки

1. **"relation already exists"** - таблица/функция уже существует, это нормально (используется `create or replace` / `if not exists`)
2. **"policy does not exist"** - это тоже нормально, миграция пытается удалить несуществующую политику перед созданием
3. **"column does not exist"** - убедитесь, что все предыдущие миграции применены

