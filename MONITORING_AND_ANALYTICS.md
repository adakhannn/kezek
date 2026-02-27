# Мониторинг и аналитика финансового модуля

## Обзор

Система мониторинга и аналитики финансового модуля Kezek предоставляет инструменты для отслеживания производительности API, анализа ошибок и аудита финансовых операций.

## Доступ к мониторингу

Мониторинг доступен по адресу: `/admin/monitoring`

**Требования:**
- Доступ только для менеджеров, администраторов и владельцев бизнеса
- Автоматическая проверка прав доступа через `getBizContextForManagers`

## Компоненты системы мониторинга

### 1. Метрики API запросов

Система автоматически отслеживает все запросы к финансовым API endpoints:

- `/api/staff/finance` - получение данных смены
- `/api/staff/shift/open` - открытие смены
- `/api/staff/shift/close` - закрытие смены
- `/api/staff/shift/items` - сохранение списка клиентов

**Отслеживаемые метрики:**
- Время выполнения запроса (duration_ms)
- HTTP статус код
- Тип ошибки (validation, database, auth, server, network)
- Контекст запроса (userId, staffId, bizId)
- IP адрес и User-Agent

**Таблица:** `api_request_metrics`

### 2. Логи финансовых операций

Система автоматически логирует все критические финансовые операции:

- Открытие смены
- Закрытие смены
- Создание клиента в смене
- Обновление клиента в смене
- Удаление клиента из смены

**Отслеживаемые данные:**
- Тип операции (shift_open, shift_close, item_create, item_update, item_delete)
- Уровень логирования (info, warning, error)
- Контекст операции (staffId, bizId, shiftId)
- Детали операции (JSON)
- Временная метка

**Таблица:** `staff_finance_operation_logs`

## Использование интерфейса мониторинга

### Вкладка "Статистика"

Показывает агрегированную статистику по API запросам:

- **Общее количество запросов** за выбранный период
- **Количество ошибок** (4xx, 5xx)
- **Процент ошибок** от общего числа запросов
- **Среднее время выполнения** запросов
- **Медианное время выполнения** (p50)
- **95-й процентиль** времени выполнения (p95)
- **99-й процентиль** времени выполнения (p99)

**Фильтры:**
- Endpoint (например, `/api/staff/finance`)
- Метод (GET, POST)
- Временное окно (последние 60 минут, 24 часа, 7 дней)

### Вкладка "Метрики API"

Показывает детальный список всех API запросов с возможностью фильтрации:

**Фильтры:**
- Endpoint
- HTTP метод
- Статус код (200, 400, 500, etc.)
- Тип ошибки (validation, database, auth, server, network)
- Дата начала и окончания
- Минимальное время выполнения

**Отображаемые данные:**
- Время запроса
- Endpoint и метод
- Статус код
- Время выполнения (мс)
- Тип ошибки (если есть)
- Сообщение об ошибке
- Контекст (userId, staffId, bizId)

**Пагинация:**
- По умолчанию: 100 записей на странице
- Максимум: 1000 записей на странице

### Вкладка "Логи операций"

Показывает логи всех финансовых операций:

**Фильтры:**
- ID сотрудника (staffId)
- ID бизнеса (bizId)
- ID смены (shiftId)
- Тип операции (shift_open, shift_close, item_create, item_update, item_delete)
- Уровень логирования (info, warning, error)
- Дата начала и окончания

**Отображаемые данные:**
- Время операции
- Тип операции
- Уровень логирования
- Сотрудник (имя)
- Бизнес (название)
- Смена (ID и дата)
- Детали операции (JSON)
- Сообщение

**Пагинация:**
- По умолчанию: 100 записей на странице
- Максимум: 1000 записей на странице

## API для мониторинга

### GET `/api/admin/metrics`

Получение метрик API запросов с фильтрацией.

**Query параметры:**
- `endpoint` - фильтр по endpoint
- `method` - фильтр по HTTP методу
- `statusCode` - фильтр по статус коду
- `errorType` - фильтр по типу ошибки
- `startDate` - дата начала (ISO 8601)
- `endDate` - дата окончания (ISO 8601)
- `minDuration` - минимальное время выполнения (мс)
- `limit` - количество записей (по умолчанию 100, максимум 1000)
- `offset` - смещение для пагинации

**Ответ:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "endpoint": "/api/staff/finance",
      "method": "GET",
      "status_code": 200,
      "duration_ms": 150,
      "error_type": null,
      "error_message": null,
      "user_id": "uuid",
      "staff_id": "uuid",
      "biz_id": "uuid",
      "ip_address": "127.0.0.1",
      "user_agent": "Mozilla/5.0...",
      "created_at": "2024-01-26T10:00:00Z"
    }
  ],
  "pagination": {
    "total": 1000,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

### GET `/api/admin/metrics/stats`

Получение агрегированной статистики по метрикам.

**Query параметры:**
- `endpoint` - фильтр по endpoint (по умолчанию `/api/staff/finance`)
- `method` - фильтр по HTTP методу
- `windowMinutes` - временное окно в минутах (по умолчанию 60)

**Ответ:**
```json
{
  "ok": true,
  "data": {
    "total_requests": 1000,
    "successful_requests": 950,
    "error_requests": 50,
    "error_rate": 0.05,
    "avg_duration_ms": 150,
    "median_duration_ms": 120,
    "p95_duration_ms": 300,
    "p99_duration_ms": 500,
    "min_duration_ms": 50,
    "max_duration_ms": 2000
  }
}
```

### GET `/api/admin/finance-logs`

Получение логов финансовых операций с фильтрацией.

**Query параметры:**
- `staffId` - фильтр по ID сотрудника
- `bizId` - фильтр по ID бизнеса
- `shiftId` - фильтр по ID смены
- `operationType` - фильтр по типу операции
- `logLevel` - фильтр по уровню логирования
- `startDate` - дата начала (ISO 8601)
- `endDate` - дата окончания (ISO 8601)
- `limit` - количество записей (по умолчанию 100, максимум 1000)
- `offset` - смещение для пагинации

**Ответ:**
```json
{
  "ok": true,
  "data": [
    {
      "id": "uuid",
      "operation_type": "shift_close",
      "log_level": "info",
      "staff_id": "uuid",
      "biz_id": "uuid",
      "shift_id": "uuid",
      "operation_details": {
        "total_amount": 10000,
        "master_share": 6000,
        "salon_share": 4500
      },
      "message": "Смена закрыта успешно",
      "staff": {
        "id": "uuid",
        "full_name": "Иван Иванов"
      },
      "business": {
        "id": "uuid",
        "name": "Салон красоты",
        "slug": "salon-krasoty"
      },
      "created_at": "2024-01-26T18:00:00Z"
    }
  ],
  "pagination": {
    "total": 500,
    "limit": 100,
    "offset": 0,
    "hasMore": true
  }
}
```

## Анализ метрик

### Регулярный анализ

Рекомендуется регулярно анализировать метрики для выявления проблем:

1. **Еженедельный анализ:**
   - Проверка общего количества запросов
   - Анализ процента ошибок
   - Выявление медленных запросов (p95, p99)

2. **Ежемесячный анализ:**
   - Тренды производительности
   - Анализ типов ошибок
   - Выявление проблемных endpoints

### Ключевые показатели

**Производительность:**
- Среднее время выполнения < 200ms - отлично
- Среднее время выполнения 200-500ms - нормально
- Среднее время выполнения > 500ms - требует оптимизации

**Надежность:**
- Процент ошибок < 1% - отлично
- Процент ошибок 1-5% - нормально
- Процент ошибок > 5% - требует внимания

**Критические endpoints:**
- `/api/staff/shift/close` - должен быть быстрым (< 500ms)
- `/api/staff/finance` - часто используемый, должен быть быстрым (< 200ms)
- `/api/staff/shift/items` - часто используемый, должен быть быстрым (< 300ms)

## Разрешение споров

Логи финансовых операций используются для разрешения споров между сотрудниками и владельцами бизнеса:

### Типичные сценарии

1. **Спор о сумме смены:**
   - Проверьте логи операции `shift_close`
   - Найдите детали расчета в `operation_details`
   - Проверьте список клиентов в логах `item_create`/`item_update`

2. **Спор о времени закрытия:**
   - Проверьте временную метку в логе `shift_close`
   - Сравните с метриками API запросов

3. **Проблемы с клиентами:**
   - Проверьте логи операций `item_create`, `item_update`, `item_delete`
   - Найдите детали изменений в `operation_details`

### Поиск в логах

```sql
-- Найти все операции закрытия смены для конкретного сотрудника
SELECT * FROM staff_finance_operation_logs
WHERE staff_id = 'staff-id'
  AND operation_type = 'shift_close'
  AND created_at >= '2024-01-01'
ORDER BY created_at DESC;

-- Найти все ошибки за период
SELECT * FROM staff_finance_operation_logs
WHERE log_level = 'error'
  AND created_at >= '2024-01-01'
ORDER BY created_at DESC;
```

## Настройка алертов

### Рекомендуемые алерты

1. **Высокий процент ошибок:**
   - Условие: процент ошибок > 10% за последний час
   - Действие: уведомление администратора

2. **Медленные запросы:**
   - Условие: p95 время выполнения > 1000ms за последний час
   - Действие: уведомление разработчиков

3. **Критические ошибки:**
   - Условие: ошибки типа `database` или `server`
   - Действие: немедленное уведомление

### Интеграция с системами мониторинга

Метрики можно экспортировать в внешние системы мониторинга через API:

```bash
# Получить метрики за последний час
curl -X GET "https://kezek.kg/api/admin/metrics?startDate=2024-01-26T10:00:00Z&endDate=2024-01-26T11:00:00Z" \
  -H "Cookie: <session_cookie>"

# Получить статистику
curl -X GET "https://kezek.kg/api/admin/metrics/stats?windowMinutes=60" \
  -H "Cookie: <session_cookie>"
```

## Очистка старых данных

Рекомендуется периодически очищать старые метрики и логи:

- **Метрики API:** хранить последние 90 дней
- **Логи операций:** хранить последние 365 дней

Полная политика хранения (включая воронку, брони, профили) и расписание cron описаны в [DATA_RETENTION.md](./DATA_RETENTION.md). Очистка может быть настроена через cron job (`/api/cron/data-retention`) или вручную через SQL:

```sql
-- Удалить метрики старше 90 дней
DELETE FROM api_request_metrics
WHERE created_at < NOW() - INTERVAL '90 days';

-- Удалить логи старше 365 дней
DELETE FROM staff_finance_operation_logs
WHERE created_at < NOW() - INTERVAL '365 days';
```

## Безопасность

- Доступ к мониторингу только для авторизованных менеджеров/администраторов
- Все запросы логируются
- Чувствительные данные (например, суммы) не логируются в открытом виде
- IP адреса и User-Agent сохраняются для безопасности

### Безопасность аналитических API для бизнеса и платформы

Для раздела бизнес‑аналитики в **админ‑dashboard** используются следующие админ‑маршруты:

- `/admin/api/analytics/overview`
- `/admin/api/analytics/conversion-funnel`
- `/admin/api/analytics/load`
- `/admin/api/analytics/promotions`

Для витрины аналитики в **кабинете бизнеса** используются маршруты:

- `/api/dashboard/analytics/overview` — обзор воронки и выручки;
- `/api/dashboard/analytics/load` — загрузка по часам;
- `/api/dashboard/branches/list` — список активных филиалов бизнеса.

Отдельно для системной аналитики платформы используются маршруты:

- `/admin/api/system-analytics/overview` — сводка по всем бизнесам за период (активные бизнесы, выручка, бронирования);
- в дальнейшем возможны дополнительные маршруты `/admin/api/system-analytics/by-city`, `/by-category`, `/anomalies` и т.д.

**Разграничение ролей и доступа:**

- Раздел `/admin/analytics/*` (включая `/admin/analytics/system`) доступен только суперадминам:
  - доступ к `/admin/*` защищён через `admin/layout.tsx`, который проверяет наличие глобальной роли `super_admin` в `user_roles_with_user` (`biz_id IS NULL`);
  - при отсутствии супер‑роли возвращается 403 с сообщением «Нет доступа (нужен супер‑админ)».
- Раздел `/dashboard/analytics` предназначен для владельцев и менеджеров конкретного бизнеса:
  - доступ к `/dashboard/*` проходит через `DashboardLayout` и `getBizContextForManagers()`, который выбирает текущий `bizId` и проверяет наличие ролей `owner|admin|manager`;
  - при отсутствии привязки к бизнесу выбрасывается типизированная ошибка `BizAccessError('NO_BIZ_ACCESS')`, и пользователь видит экран «нет доступа к кабинету».

**Гарантии изоляции данных:**

- Все аналитические маршруты бизнес‑уровня (и в `/admin/api/analytics/*`, и в `/api/dashboard/analytics/*`) используют `getBizContextForManagers()` для определения текущего бизнеса.
- Админские маршруты дополнительно валидируют `bizId` в query‑строке: если переданный `bizId` не совпадает с контекстным, возвращается 403.
- Все запросы к агрегирующим таблицам бизнес‑уровня (`business_daily_stats`, `business_hourly_load`, `analytics_events`, `bookings`) фильтруются по `biz_id = effectiveBizId`, поэтому агрегаты по чужим бизнесам получить нельзя даже при прямых вызовах API.
- Системная аналитика платформы (`/admin/api/system-analytics/*`) строится поверх агрегатов по всем бизнесам (суммы и усреднения по `business_daily_stats` / `business_hourly_load`) и не даёт доступа к PII (нет e‑mail/телефонов клиентов, ФИО и т.п.), только агрегированные числа.
- И админские, и дашборд‑маршруты бизнес‑уровня используют одинаковую бизнес‑логику расчёта KPI; различается только уровень доступа и UX‑обвязка. Системная аналитика добавляет ещё один уровень агрегации (по городам/категориям/каналам) поверх этих же витрин.

**Логирование и мониторинг:**

- Вызовы системных аналитических API (`/admin/api/system-analytics/*`) логируются с отдельным scope (`SystemAnalytics*`) для отслеживания нагрузки и ошибок.
- В суммарные метрики мониторинга API (`api_request_metrics`) добавляются события по `system-analytics`, что позволяет контролировать частоту использования и время ответа этих маршрутов.

**Трекинг событий:**

- Публичный endpoint `/admin/api/analytics/track`:
  - принимает только строго валидированные события (`trackEventSchema`);
  - для неавторизованных пользователей разрешает только безопасные публичные события (`home_view`, `business_page_view`, `booking_flow_start`, `booking_flow_step`);
  - все записи попадают в таблицу `analytics_events`, доступ к которой ограничен на уровне RLS: читать и агрегировать события может только сервисная роль (через `getServiceClient`), что исключает утечки сырых событий клиентским ключом.

Подробнее про бизнес‑аналитику и витрину см. в `BUSINESS_ANALYTICS_DASHBOARD_PLAN.md` (эпик G).

### Тех. чек‑лист сверки метрик (G2.1)

Ниже приведены примерные SQL‑запросы и сценарии для ручной сверки агрегатов аналитики.

#### 1. Сверка количества бронирований в `business_daily_stats` с `bookings`

Проверяем, что число успешных бронирований за день по бизнесу совпадает с агрегатом:

```sql
-- 1) Агрегаты по business_daily_stats
SELECT
  biz_id,
  date,
  bookings_confirmed_or_paid
FROM business_daily_stats
WHERE biz_id = 'BIZ_ID_HERE'
  AND date BETWEEN '2025-01-01' AND '2025-01-07'
ORDER BY date;

-- 2) Фактические успешные брони за те же даты (confirmed/paid)
SELECT
  biz_id,
  DATE(start_at AT TIME ZONE 'UTC') AS date_utc,
  COUNT(*) AS successful_bookings
FROM bookings
WHERE biz_id = 'BIZ_ID_HERE'
  AND status IN ('confirmed', 'paid')
  AND start_at >= '2025-01-01T00:00:00Z'
  AND start_at <  '2025-01-08T00:00:00Z'
GROUP BY biz_id, date_utc
ORDER BY date_utc;
```

#### 2. Сверка heatmap (`business_hourly_load`) с сырыми бронированиями

Проверяем, что помесячная/посуточная загрузка по часам совпадает с развернутыми бронированиями:

```sql
-- 1) Агрегаты по business_hourly_load
SELECT
  biz_id,
  branch_id,
  date,
  hour,
  bookings_count,
  promo_bookings_count
FROM business_hourly_load
WHERE biz_id = 'BIZ_ID_HERE'
  AND branch_id = 'BRANCH_ID_HERE'
  AND date = '2025-01-05'
ORDER BY hour;

-- 2) Фактические брони по часам (по start_at, UTC)
SELECT
  biz_id,
  branch_id,
  DATE(start_at AT TIME ZONE 'UTC') AS date_utc,
  EXTRACT(HOUR FROM start_at AT TIME ZONE 'UTC')::int AS hour_utc,
  COUNT(*) AS successful_bookings,
  COUNT(*) FILTER (WHERE promotion_applied IS NOT NULL) AS promo_bookings
FROM bookings
WHERE biz_id = 'BIZ_ID_HERE'
  AND branch_id = 'BRANCH_ID_HERE'
  AND status IN ('confirmed', 'paid')
  AND start_at >= '2025-01-05T00:00:00Z'
  AND start_at <  '2025-01-06T00:00:00Z'
GROUP BY biz_id, branch_id, date_utc, hour_utc
ORDER BY hour_utc;
```

#### 3. Сверка промо‑метрик (`business_daily_stats` + `promotions` API) с `bookings.promotion_applied`

Проверяем, что общее число промо‑бронирований и выручка с промо сходятся:

```sql
-- 1) Агрегаты по промо в business_daily_stats
SELECT
  biz_id,
  date,
  promo_bookings,
  promo_revenue,
  total_revenue
FROM business_daily_stats
WHERE biz_id = 'BIZ_ID_HERE'
  AND date BETWEEN '2025-01-01' AND '2025-01-07'
ORDER BY date;

-- 2) Фактические промо‑брони и суммы по promotion_applied
SELECT
  biz_id,
  DATE(start_at AT TIME ZONE 'UTC') AS date_utc,
  COUNT(*) AS promo_bookings,
  SUM( (promotion_applied->>'final_amount')::numeric ) AS promo_revenue,
  SUM( COALESCE((promotion_applied->>'original_amount')::numeric,
                 (promotion_applied->>'final_amount')::numeric, 0) ) AS total_revenue_estimate
FROM bookings
WHERE biz_id = 'BIZ_ID_HERE'
  AND status IN ('confirmed', 'paid')
  AND promotion_applied IS NOT NULL
  AND start_at >= '2025-01-01T00:00:00Z'
  AND start_at <  '2025-01-08T00:00:00Z'
GROUP BY biz_id, date_utc
ORDER BY date_utc;
```

Рекомендуется прогонять эти сверки на нескольких реальных бизнесах (разные по размеру/настроенным промо) после изменений в агрегирующей логике или схемах таблиц.

## Дополнительные ресурсы

- [API документация](./API_DOCUMENTATION.md) - описание всех API endpoints
- [Finance Domain README](./apps/web/src/lib/financeDomain/README.md) - руководство по финансовым расчетам
- [Admin Dashboard](../apps/web/src/app/admin/monitoring/) - исходный код интерфейса мониторинга

