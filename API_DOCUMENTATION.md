# API Documentation

Документация всех API endpoints проекта Kezek.

## Интерактивная документация (Swagger UI)

Для интерактивной документации с возможностью тестирования endpoints используйте Swagger UI:
- **Локально**: http://localhost:3000/api-docs
- **Production**: https://kezek.kg/api-docs

Swagger UI позволяет:
- Просматривать все доступные endpoints
- Видеть схемы запросов и ответов
- Тестировать endpoints прямо из браузера
- Автоматически генерировать клиентский код

OpenAPI спецификация доступна в формате JSON: `/api/swagger.json`

## Содержание

- [Аутентификация](#аутентификация)
- [Бронирования](#бронирования)
- [Сотрудники](#сотрудники)
- [Смены](#смены)
- [Дашборд](#дашборд)
- [Администрирование](#администрирование)
- [Cron Jobs](#cron-jobs)
- [Webhooks](#webhooks)
- [Профиль](#профиль)
- [Уведомления](#уведомления)
- [WhatsApp](#whatsapp)

---

## Аутентификация

### POST `/api/auth/telegram/login`

Авторизация через Telegram.

**Параметры запроса:**
```json
{
  "initData": "string" // Telegram WebApp initData
}
```

**Ответ:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "email": "string",
    "phone": "string"
  },
  "session": {
    "access_token": "string",
    "refresh_token": "string"
  }
}
```

**Ошибки:**
- `400` - Неверные данные
- `401` - Ошибка авторизации

---

### POST `/api/auth/telegram/link`

Привязка Telegram аккаунта к существующему пользователю.

**Параметры запроса:**
```json
{
  "initData": "string" // Telegram WebApp initData
}
```

**Ответ:**
```json
{
  "ok": true,
  "linked": true
}
```

---

### POST `/api/auth/sign-out`

Выход из системы.

**Ответ:**
```json
{
  "ok": true
}
```

---

### POST `/api/auth/mobile-exchange`

Обмен токена для мобильного приложения.

**Параметры запроса:**
```json
{
  "refresh_token": "string"
}
```

**Ответ:**
```json
{
  "access_token": "string",
  "refresh_token": "string"
}
```

---

## Бронирования

### POST `/api/quick-hold`

Быстрое создание бронирования (hold) для авторизованных пользователей.

**Rate Limiting:** `public` (100 req/15min)

**Параметры запроса:**
```json
{
  "biz_id": "uuid",
  "branch_id": "uuid", // опционально, если не указан - берется первый активный филиал
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2024-01-15T10:00:00+06:00" // ISO строка с таймзоной
}
```

**Авторизация:**
- Bearer token в заголовке `Authorization` (для мобильного приложения)
- Или cookies (для веб-версии)

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid",
  "confirmed": true
}
```

**Ошибки:**
- `400` - Неверные параметры, нет активного филиала, ошибка RPC
- `401` - Не авторизован

---

### POST `/api/quick-book-guest`

Быстрое создание бронирования для гостей (без регистрации).

**Rate Limiting:** `public` (50 req/15min)

**Параметры запроса:**
```json
{
  "biz_id": "uuid",
  "service_id": "uuid",
  "staff_id": "uuid",
  "start_at": "2024-01-15T10:00:00+06:00",
  "client_name": "string",
  "client_phone": "string",
  "client_email": "string" // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid"
}
```

**Ошибки:**
- `400` - Неверные параметры
- `429` - Превышен лимит запросов

---

### POST `/api/bookings/[id]/mark-attendance`

Отметка посещения клиента (пришел/не пришел).

**Rate Limiting:** `normal` (60 req/min)

**Параметры запроса:**
```json
{
  "attended": true // true = пришел, false = не пришел
}
```

**Требования:**
- Только менеджеры бизнеса
- Бронирование должно принадлежать бизнесу менеджера

**Ответ:**
```json
{
  "ok": true,
  "booking": {
    "id": "uuid",
    "status": "paid",
    "total_amount": 1000,
    "promotion_applied": {
      "id": "uuid",
      "title_ru": "Скидка 50%"
    }
  }
}
```

**Ошибки:**
- `400` - Неверные параметры, бронирование не найдено
- `403` - Нет доступа
- `404` - Бронирование не найдено

---

### POST `/api/bookings/[id]/cancel`

Отмена бронирования.

**Параметры запроса:**
```json
{
  "reason": "string" // опционально
}
```

**Ответ:**
```json
{
  "ok": true,
  "booking_id": "uuid"
}
```

---

## Сотрудники

### POST `/api/staff/shift/open`

Открытие смены сотрудника.

**Rate Limiting:** `critical` (30 req/min)

**Требования:**
- Только сотрудники
- Не должен быть выходной день
- Не должно быть открытой смены на сегодня

**Параметры запроса:**
```json
{} // Нет параметров, используется контекст сотрудника
```

**Ответ:**
```json
{
  "ok": true,
  "shift_id": "uuid",
  "date": "2024-01-15"
}
```

**Ошибки:**
- `400` - Выходной день, смена уже открыта
- `403` - Нет доступа

---

### POST `/api/staff/shift/close`

Закрытие смены сотрудника.

**Rate Limiting:** `critical` (30 req/min)

**Параметры запроса:**
```json
{
  "hours_worked": 8.5, // опционально, для ручной корректировки
  "topup_amount": 500 // опционально, доплата
}
```

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "total_amount": 5000,
    "master_share": 3000,
    "salon_share": 2000,
    "hours_worked": 8.5,
    "guaranteed_amount": 0
  }
}
```

**Ошибки:**
- `400` - Смена не найдена, ошибка расчета
- `403` - Нет доступа

---

### GET `/api/staff/shift/today`

Получение информации о текущей смене.

**Ответ:**
```json
{
  "shift": {
    "id": "uuid",
    "date": "2024-01-15",
    "status": "open",
    "items_count": 5
  } | null
}
```

---

### GET `/api/staff/shift/items`

Получение списка клиентов в открытой смене.

**Ответ:**
```json
{
  "items": [
    {
      "id": "uuid",
      "booking_id": "uuid",
      "client_name": "string",
      "client_phone": "string",
      "service_name": "string",
      "total_amount": 1000,
      "master_share": 600,
      "salon_share": 400
    }
  ]
}
```

---

### POST `/api/staff/create`

Создание сотрудника.

**Параметры запроса:**
```json
{
  "user_id": "uuid",
  "biz_id": "uuid",
  "branch_id": "uuid",
  "full_name": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "staff_id": "uuid"
}
```

---

### POST `/api/staff/update`

Обновление данных сотрудника.

**Параметры запроса:**
```json
{
  "full_name": "string",
  "branch_id": "uuid" // опционально
}
```

---

### POST `/api/staff/avatar/upload`

Загрузка аватара сотрудника.

**Параметры запроса:**
- `multipart/form-data`
- `file`: файл изображения

**Ответ:**
```json
{
  "ok": true,
  "avatar_url": "https://..."
}
```

---

### POST `/api/staff/avatar/remove`

Удаление аватара сотрудника.

**Ответ:**
```json
{
  "ok": true
}
```

---

## Дашборд

### GET `/api/dashboard/finance/all`

Получение финансовой статистики для всех сотрудников.

**Query параметры:**
- `period`: `day` | `week` | `month` | `year` (по умолчанию `month`)
- `start_date`: `YYYY-MM-DD` (опционально)
- `end_date`: `YYYY-MM-DD` (опционально)
- `branch_id`: `uuid` (опционально, фильтр по филиалу)

**Требования:**
- Только менеджеры бизнеса

**Ответ:**
```json
{
  "stats": [
    {
      "staff_id": "uuid",
      "staff_name": "string",
      "total_amount": 50000,
      "master_share": 30000,
      "salon_share": 20000,
      "hours_worked": 160,
      "shifts_count": 20
    }
  ],
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

---

### GET `/api/dashboard/staff/[id]/finance`

Получение финансовой статистики конкретного сотрудника.

**Query параметры:**
- `period`: `day` | `week` | `month` | `year`
- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

**Ответ:**
```json
{
  "staff_id": "uuid",
  "staff_name": "string",
  "total_amount": 50000,
  "master_share": 30000,
  "salon_share": 20000,
  "hours_worked": 160,
  "shifts_count": 20,
  "shifts": [
    {
      "id": "uuid",
      "date": "2024-01-15",
      "total_amount": 5000,
      "master_share": 3000,
      "salon_share": 2000
    }
  ]
}
```

---

### GET `/api/dashboard/staff/finance/all`

Получение финансовой статистики всех сотрудников (агрегированная версия).

**Ответ:**
```json
{
  "stats": [
    {
      "staff_id": "uuid",
      "staff_name": "string",
      "total_amount": 50000,
      "master_share": 30000,
      "salon_share": 20000
    }
  ]
}
```

---

### GET `/api/dashboard/staff/[id]/finance/stats`

Получение статистики по сотруднику (краткая версия).

**Ответ:**
```json
{
  "total_amount": 50000,
  "master_share": 30000,
  "salon_share": 20000,
  "hours_worked": 160
}
```

---

### POST `/api/dashboard/branches/[branchId]/promotions`

Создание промоакции для филиала.

**Параметры запроса:**
```json
{
  "promotion_type": "free_after_n_visits" | "referral_free" | "referral_discount_50" | "birthday_discount" | "first_visit_discount",
  "title_ru": "string",
  "params": {
    // Зависит от типа промоакции
    "n_visits": 5, // для free_after_n_visits
    "discount_percent": 50 // для discount типов
  }
}
```

**Ответ:**
```json
{
  "ok": true,
  "promotion_id": "uuid"
}
```

---

### GET `/api/dashboard/branches/[branchId]/promotions`

Получение списка промоакций филиала.

**Ответ:**
```json
{
  "promotions": [
    {
      "id": "uuid",
      "promotion_type": "string",
      "title_ru": "string",
      "params": {},
      "is_active": true
    }
  ]
}
```

---

### DELETE `/api/dashboard/branches/[branchId]/promotions/[promotionId]`

Удаление промоакции.

**Ответ:**
```json
{
  "ok": true
}
```

---

### POST `/api/dashboard/staff-shifts/[id]/update-hours`

Ручная корректировка отработанных часов для закрытой смены.

**Параметры запроса:**
```json
{
  "hours_worked": 8.5
}
```

**Требования:**
- Только владельцы бизнеса

**Ответ:**
```json
{
  "ok": true,
  "shift": {
    "id": "uuid",
    "hours_worked": 8.5
  }
}
```

---

## Администрирование

### GET `/api/admin/health-check`

Проверка здоровья системы.

**Ответ:**
```json
{
  "ok": true,
  "timestamp": "2024-01-15T10:00:00Z",
  "services": {
    "database": "ok",
    "storage": "ok"
  }
}
```

---

### GET `/api/admin/performance/stats`

Получение статистики производительности (только для super-admin).

**Ответ:**
```json
{
  "stats": [
    {
      "name": "get_free_slots_service_day_v2",
      "type": "rpc",
      "avg": 150,
      "min": 50,
      "max": 500,
      "p95": 300,
      "p99": 450,
      "errorRate": 0.01,
      "status": "ok"
    }
  ]
}
```

---

### POST `/api/admin/ratings/status`

Получение статуса расчета рейтингов.

**Ответ:**
```json
{
  "last_calculation": "2024-01-15T10:00:00Z",
  "status": "ok"
}
```

---

### POST `/api/admin/initialize-ratings`

Инициализация расчета рейтингов.

**Ответ:**
```json
{
  "ok": true,
  "message": "Ratings initialization started"
}
```

---

### GET `/api/admin/promotions/debug`

Отладка промоакций (только для super-admin).

**Query параметры:**
- `client_id`: `uuid`
- `booking_id`: `uuid`
- `branch_id`: `uuid`

**Ответ:**
```json
{
  "client": {
    "id": "uuid",
    "visits_count": 5,
    "referrals_count": 2
  },
  "applicable_promotions": [
    {
      "id": "uuid",
      "type": "free_after_n_visits",
      "title_ru": "Бесплатно после 5 визитов"
    }
  ],
  "applied_promotion": {
    "id": "uuid",
    "type": "free_after_n_visits"
  }
}
```

---

## Cron Jobs

### POST `/api/cron/close-shifts`

Автоматическое закрытие смен (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Ответ:**
```json
{
  "ok": true,
  "closed_shifts": 5,
  "errors": []
}
```

---

### POST `/api/cron/recalculate-ratings`

Пересчет рейтингов (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Параметры запроса:**
```json
{
  "date": "2024-01-15" // опционально, по умолчанию вчерашний день
}
```

**Ответ:**
```json
{
  "ok": true,
  "recalculated": 100
}
```

---

### POST `/api/cron/health-check-alerts`

Проверка здоровья системы и отправка алертов (вызывается по расписанию).

**Авторизация:**
- Требуется секретный ключ в заголовке `X-Cron-Secret`

**Ответ:**
```json
{
  "ok": true,
  "alerts_sent": 0
}
```

---

## Webhooks

### POST `/api/webhooks/whatsapp`

Webhook для получения сообщений от WhatsApp.

**Параметры запроса:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "string",
                "text": {
                  "body": "string"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

## Профиль

### POST `/api/profile/update`

Обновление профиля пользователя.

**Параметры запроса:**
```json
{
  "full_name": "string",
  "phone": "string",
  "email": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "user": {
    "id": "uuid",
    "full_name": "string",
    "phone": "string",
    "email": "string"
  }
}
```

---

### POST `/api/user/update-phone`

Обновление телефона пользователя.

**Параметры запроса:**
```json
{
  "phone": "string"
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

## Уведомления

### POST `/api/notify`

Отправка уведомления о бронировании.

**Параметры запроса:**
```json
{
  "type": "hold" | "confirm" | "cancel",
  "booking_id": "uuid"
}
```

**Ответ:**
```json
{
  "ok": true
}
```

---

### GET `/api/notify/ping`

Проверка доступности сервиса уведомлений.

**Ответ:**
```json
{
  "ok": true,
  "message": "pong"
}
```

---

## WhatsApp

### POST `/api/whatsapp/send-otp`

Отправка OTP кода через WhatsApp.

**Rate Limiting:** `auth` (5 req/15min)

**Параметры запроса:**
```json
{
  "phone": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "message_id": "string"
}
```

---

### POST `/api/whatsapp/verify-otp`

Проверка OTP кода.

**Rate Limiting:** `auth` (10 req/15min)

**Параметры запроса:**
```json
{
  "phone": "string",
  "code": "string"
}
```

**Ответ:**
```json
{
  "ok": true,
  "session": {
    "access_token": "string",
    "refresh_token": "string"
  }
}
```

---

## Rate Limiting

Все endpoints защищены rate limiting с различными конфигурациями:

- **`public`**: 100 запросов за 15 минут (публичные endpoints)
- **`normal`**: 60 запросов в минуту (обычные операции)
- **`critical`**: 30 запросов в минуту (критичные операции: открытие/закрытие смен)
- **`auth`**: 5-10 запросов за 15 минут (операции аутентификации)

При превышении лимита возвращается статус `429 Too Many Requests` с заголовками:
- `X-RateLimit-Limit`: максимальное количество запросов
- `X-RateLimit-Remaining`: оставшееся количество запросов
- `X-RateLimit-Reset`: время сброса лимита (Unix timestamp)

---

## Ошибки

Все ошибки возвращаются в формате:

```json
{
  "ok": false,
  "error": "error_code",
  "message": "Human readable error message",
  "details": {} // опционально, дополнительные детали
}
```

### Коды ошибок:

- `400` - Bad Request (неверные параметры)
- `401` - Unauthorized (не авторизован)
- `403` - Forbidden (нет доступа)
- `404` - Not Found (ресурс не найден)
- `429` - Too Many Requests (превышен лимит)
- `500` - Internal Server Error (ошибка сервера)

---

## Авторизация

Большинство endpoints требуют авторизации. Используется два метода:

1. **Bearer Token** (для мобильного приложения):
   ```
   Authorization: Bearer <access_token>
   ```

2. **Cookies** (для веб-версии):
   - Токены хранятся в HTTP-only cookies
   - Автоматически отправляются браузером

---

## Временные зоны

Все даты и время обрабатываются в таймзоне `Asia/Bishkek` (UTC+6).

Формат даты: `YYYY-MM-DD`
Формат времени: ISO 8601 с таймзоной, например: `2024-01-15T10:00:00+06:00`

---

## Версионирование

Текущая версия API: `v1` (неявная)

В будущем может быть добавлено версионирование через префикс пути: `/api/v1/...`

---

## Примеры использования

### Создание бронирования (мобильное приложение)

```bash
curl -X POST https://kezek.kg/api/quick-hold \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "biz_id": "123e4567-e89b-12d3-a456-426614174000",
    "branch_id": "123e4567-e89b-12d3-a456-426614174001",
    "service_id": "123e4567-e89b-12d3-a456-426614174002",
    "staff_id": "123e4567-e89b-12d3-a456-426614174003",
    "start_at": "2024-01-15T10:00:00+06:00"
  }'
```

### Открытие смены

```bash
curl -X POST https://kezek.kg/api/staff/shift/open \
  -H "Cookie: <session_cookie>" \
  -H "Content-Type: application/json"
```

### Получение финансовой статистики

```bash
curl -X GET "https://kezek.kg/api/dashboard/finance/all?period=month&branch_id=123e4567-e89b-12d3-a456-426614174001" \
  -H "Cookie: <session_cookie>"
```

---

## Примечания

- Все UUID должны быть в формате стандартного UUID v4
- Все суммы указываются в сомах (KGS)
- Все временные интервалы указываются в минутах
- Процентные значения указываются как числа (например, 50 для 50%)

---

*Последнее обновление: 2024-01-15*

