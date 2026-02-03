# Руководство по обработке ошибок в API Routes

## Обзор

Все API routes должны использовать централизованную обработку ошибок для обеспечения:
- Единого формата ответов
- Автоматического логирования
- Правильных HTTP статус кодов
- Безопасности (маскирование чувствительных данных)

## Стандартный формат ответов

### Успешный ответ

```typescript
{
  ok: true,
  data?: T,
  // дополнительные поля
}
```

### Ответ с ошибкой

```typescript
{
  ok: false,
  error: string,        // Тип ошибки (auth, validation, not_found и т.д.)
  message?: string,     // Человеко-читаемое сообщение
  details?: unknown     // Дополнительные детали (только в dev)
}
```

## Типы ошибок

Стандартные типы ошибок (из `ApiErrorType`):

- `auth` - Ошибка авторизации (401)
- `forbidden` - Доступ запрещен (403)
- `not_found` - Ресурс не найден (404)
- `validation` - Ошибка валидации (400)
- `conflict` - Конфликт данных (409)
- `rate_limit` - Превышен лимит запросов (429)
- `internal` - Внутренняя ошибка сервера (500)
- `service_unavailable` - Сервис недоступен (503)

## Использование

### Вариант 1: withErrorHandler (рекомендуется)

Обертка автоматически перехватывает все ошибки:

```typescript
import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';

export async function GET(req: Request) {
  return withErrorHandler('MyApi', async () => {
    // Ваш код
    const data = await fetchData();
    return createSuccessResponse(data);
  });
}
```

### Вариант 2: Ручная обработка

Если нужен более точный контроль:

```typescript
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/apiErrorHandler';

export async function POST(req: Request) {
  try {
    // Проверка авторизации
    if (!user) {
      return createErrorResponse('auth', 'Не авторизован', undefined, 401);
    }

    // Валидация
    if (!data.name) {
      return createErrorResponse('validation', 'Имя обязательно', undefined, 400);
    }

    // Бизнес-логика
    const result = await processData(data);
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'MyApi', 'Не удалось обработать запрос');
  }
}
```

### Вариант 3: С валидацией

Комбинирование с валидацией:

```typescript
import { validateRequest } from '@/lib/validation/apiValidation';
import { createErrorResponse, createSuccessResponse, handleApiError } from '@/lib/apiErrorHandler';
import { mySchema } from './schemas';

export async function POST(req: Request) {
  try {
    // Валидация (автоматически возвращает стандартизированную ошибку)
    const validationResult = await validateRequest(req, mySchema);
    if (!validationResult.success) {
      return validationResult.response;
    }

    const data = validationResult.data;

    // Бизнес-логика
    const result = await processData(data);
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error, 'MyApi');
  }
}
```

## Миграция существующих routes

### ❌ Было (неправильно):

```typescript
export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name) {
      return NextResponse.json({ ok: false, error: 'NAME_REQUIRED' }, { status: 400 });
    }
    // ...
    return NextResponse.json({ ok: true, data: result });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
```

### ✅ Стало (правильно):

```typescript
import { withErrorHandler, createErrorResponse, createSuccessResponse } from '@/lib/apiErrorHandler';

export async function POST(req: Request) {
  return withErrorHandler('MyApi', async () => {
    const body = await req.json();
    if (!body.name) {
      return createErrorResponse('validation', 'Имя обязательно', undefined, 400);
    }
    // ...
    const result = await processData(body);
    return createSuccessResponse(result);
  });
}
```

## Примеры для разных случаев

### Авторизация

```typescript
if (!user) {
  return createErrorResponse('auth', 'Не авторизован', undefined, 401);
}
```

### Доступ запрещен

```typescript
if (!hasPermission) {
  return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
}
```

### Ресурс не найден

```typescript
if (!resource) {
  return createErrorResponse('not_found', 'Ресурс не найден', undefined, 404);
}
```

### Валидация

```typescript
if (!isValid) {
  return createErrorResponse('validation', 'Неверные данные', { field: 'name' }, 400);
}
```

### Конфликт

```typescript
if (exists) {
  return createErrorResponse('conflict', 'Ресурс уже существует', undefined, 409);
}
```

### Обработка ошибок БД

```typescript
try {
  const result = await supabase.from('table').insert(data);
  if (result.error) {
    // handleApiError автоматически определит тип ошибки
    throw new Error(result.error.message);
  }
} catch (error) {
  return handleApiError(error, 'MyApi');
}
```

## Преимущества централизованной обработки

1. **Единый формат** - все ошибки имеют одинаковую структуру
2. **Автоматическое логирование** - все ошибки логируются безопасно
3. **Правильные статусы** - автоматическое определение HTTP статуса
4. **Безопасность** - маскирование чувствительных данных в dev режиме
5. **Типизация** - TypeScript типы для ответов

## Checklist для миграции

- [ ] Импортировать `withErrorHandler` или `createErrorResponse`/`handleApiError`
- [ ] Заменить `NextResponse.json({ ok: false, ... })` на `createErrorResponse`
- [ ] Заменить `NextResponse.json({ ok: true, ... })` на `createSuccessResponse`
- [ ] Обернуть handler в `withErrorHandler` или использовать try-catch с `handleApiError`
- [ ] Использовать правильные типы ошибок (auth, validation, not_found и т.д.)
- [ ] Убедиться, что все ошибки логируются

## Дополнительные ресурсы

- `apiErrorHandler.ts` - основной модуль обработки ошибок
- `errors.ts` - утилиты форматирования ошибок
- `validation/apiValidation.ts` - валидация с автоматической обработкой ошибок

