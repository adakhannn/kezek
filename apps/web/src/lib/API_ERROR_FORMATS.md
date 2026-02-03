# Форматы ошибок API

## Стандартный формат ответов

Все API endpoints возвращают ответы в едином формате для обеспечения согласованности и простоты обработки на клиенте.

### Успешный ответ

```json
{
  "ok": true,
  "data": {
    // Данные ответа
  }
}
```

**Примеры:**

```json
// Простой успешный ответ
{
  "ok": true,
  "data": { "id": "123" }
}

// Успешный ответ с дополнительными полями
{
  "ok": true,
  "data": { "id": "123" },
  "count": 1,
  "user_linked": true
}
```

### Ответ с ошибкой

```json
{
  "ok": false,
  "error": "error_type",
  "message": "Человеко-читаемое сообщение",
  "details": {
    // Дополнительные детали (только в dev режиме)
  }
}
```

## Типы ошибок

### `auth` (401) - Ошибка авторизации

Пользователь не авторизован или токен недействителен.

```json
{
  "ok": false,
  "error": "auth",
  "message": "Не авторизован"
}
```

**Примеры использования:**
- Отсутствует токен авторизации
- Токен истек
- Неверный формат токена

### `forbidden` (403) - Доступ запрещен

Пользователь авторизован, но не имеет прав доступа к ресурсу.

```json
{
  "ok": false,
  "error": "forbidden",
  "message": "Доступ запрещен"
}
```

**Примеры использования:**
- Попытка доступа к ресурсу другого пользователя
- Недостаточно прав для выполнения действия
- Попытка доступа к админ-панели без прав администратора

### `validation` (400) - Ошибка валидации

Неверные входные данные или отсутствуют обязательные поля.

```json
{
  "ok": false,
  "error": "validation",
  "message": "Ошибка валидации",
  "details": {
    "errors": [
      {
        "path": "email",
        "message": "Неверный формат email"
      }
    ]
  }
}
```

**Примеры использования:**
- Отсутствуют обязательные поля
- Неверный формат данных (email, телефон и т.д.)
- Значения вне допустимого диапазона
- Ошибки валидации Zod

### `not_found` (404) - Ресурс не найден

Запрашиваемый ресурс не существует.

```json
{
  "ok": false,
  "error": "not_found",
  "message": "Ресурс не найден"
}
```

**Примеры использования:**
- Запрос несуществующего ID
- Ресурс был удален
- Неверный путь к ресурсу

### `conflict` (409) - Конфликт данных

Конфликт с текущим состоянием ресурса.

```json
{
  "ok": false,
  "error": "conflict",
  "message": "Ресурс уже существует"
}
```

**Примеры использования:**
- Попытка создать дубликат
- Ресурс уже существует
- Конфликт версий

### `rate_limit` (429) - Превышен лимит запросов

Превышен лимит запросов для данного endpoint.

```json
{
  "ok": false,
  "error": "rate_limit",
  "message": "Превышен лимит запросов",
  "details": {
    "retryAfter": 60
  }
}
```

**Примеры использования:**
- Слишком много запросов за короткое время
- Rate limiting сработал

### `internal` (500) - Внутренняя ошибка сервера

Непредвиденная ошибка на сервере.

```json
{
  "ok": false,
  "error": "internal",
  "message": "Внутренняя ошибка сервера",
  "details": {
    // Детали ошибки (только в dev режиме)
  }
}
```

**Примеры использования:**
- Ошибка базы данных
- Неожиданное исключение
- Ошибка внешнего сервиса

### `service_unavailable` (503) - Сервис недоступен

Временная недоступность сервиса.

```json
{
  "ok": false,
  "error": "service_unavailable",
  "message": "Сервис временно недоступен"
}
```

**Примеры использования:**
- Внешний сервис недоступен
- Техническое обслуживание
- Перегрузка сервера

## Примеры ответов для разных endpoints

### POST /api/staff/create

**Успех:**
```json
{
  "ok": true,
  "data": {
    "id": "uuid",
    "user_linked": true,
    "schedule_initialized": true,
    "schedule_days_created": 14
  }
}
```

**Ошибка валидации:**
```json
{
  "ok": false,
  "error": "validation",
  "message": "Имя и филиал обязательны"
}
```

**Ошибка доступа:**
```json
{
  "ok": false,
  "error": "forbidden",
  "message": "Доступ запрещен"
}
```

### POST /api/bookings/[id]/cancel

**Успех:**
```json
{
  "ok": true
}
```

**Ошибка доступа:**
```json
{
  "ok": false,
  "error": "forbidden",
  "message": "Доступ запрещен"
}
```

**Ошибка валидации:**
```json
{
  "ok": false,
  "error": "validation",
  "message": "Не удалось отменить бронирование"
}
```

### POST /api/services/create

**Успех:**
```json
{
  "ok": true,
  "data": {
    "count": 3,
    "ids": ["uuid1", "uuid2", "uuid3"]
  }
}
```

**Ошибка валидации:**
```json
{
  "ok": false,
  "error": "validation",
  "message": "Название услуги обязательно"
}
```

## Обработка ошибок на клиенте

### TypeScript типы

```typescript
import type { ApiErrorResponse, ApiSuccessResponse } from '@/lib/apiErrorHandler';

// Успешный ответ
type MyData = { id: string; name: string };
type MyResponse = ApiSuccessResponse<MyData>;

// Ответ с ошибкой
type MyError = ApiErrorResponse;
```

### Пример обработки

```typescript
async function createStaff(data: StaffData) {
  const response = await fetch('/api/staff/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!result.ok) {
    // Обработка ошибки
    switch (result.error) {
      case 'auth':
        // Перенаправить на страницу входа
        break;
      case 'forbidden':
        // Показать сообщение о недостатке прав
        break;
      case 'validation':
        // Показать ошибки валидации
        break;
      default:
        // Общая ошибка
    }
    throw new Error(result.message || 'Произошла ошибка');
  }

  return result.data;
}
```

## Миграция существующих endpoints

При миграции существующих endpoints на новый формат:

1. Замените `NextResponse.json({ ok: false, ... })` на `createErrorResponse()`
2. Замените `NextResponse.json({ ok: true, ... })` на `createSuccessResponse()`
3. Используйте `withErrorHandler()` для автоматической обработки ошибок
4. Убедитесь, что все ошибки имеют правильный тип (`auth`, `validation`, и т.д.)

См. `ERROR_HANDLING_GUIDE.md` для подробных инструкций по миграции.

