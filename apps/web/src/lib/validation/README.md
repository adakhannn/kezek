# Валидация данных в API Routes

Этот модуль предоставляет утилиты для валидации входных данных в API routes с использованием Zod.

## Быстрый старт

### Базовое использование

```typescript
import { validateRequest } from '@/lib/validation/apiValidation';
import { z } from 'zod';

export async function POST(req: Request) {
    const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
        age: z.number().int().positive(),
    });
    
    const result = await validateRequest(req, schema);
    
    if (!result.success) {
        return result.response; // NextResponse с ошибкой валидации
    }
    
    // result.data типизирован и валидирован
    const { name, email, age } = result.data;
    
    // Ваш код здесь
    return NextResponse.json({ ok: true });
}
```

### Использование готовых схем

```typescript
import { validateRequest } from '@/lib/validation/apiValidation';
import { quickHoldSchema } from '@/lib/validation/bookingSchemas';

export async function POST(req: Request) {
    const result = await validateRequest(req, quickHoldSchema);
    
    if (!result.success) {
        return result.response;
    }
    
    const { biz_id, service_id, staff_id, start_at } = result.data;
    // Все поля валидированы и типизированы
}
```

## Доступные схемы

### Общие схемы (`schemas.ts`)

- `uuidSchema` - UUID валидация
- `emailSchema` - Email валидация (опциональный)
- `phoneSchema` - Телефон в формате E.164
- `nameSchema` - Имя (2-100 символов)
- `isoDateTimeSchema` - ISO дата-время
- `positiveNumberSchema` - Положительное число
- `slugSchema` - Slug (латиница, цифры, дефисы)
- `urlSchema` - URL
- `latSchema`, `lonSchema` - Координаты

### Схемы бронирования (`bookingSchemas.ts`)

- `quickHoldSchema` - Быстрое бронирование для авторизованных
- `quickBookGuestSchema` - Гостевое бронирование
- `markAttendanceSchema` - Отметка посещения

## Создание собственных схем

```typescript
import { z } from 'zod';
import { uuidSchema, nameSchema, emailSchema } from './schemas';

export const myCustomSchema = z.object({
    id: uuidSchema,
    name: nameSchema,
    email: emailSchema,
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
});
```

## Валидация query параметров

```typescript
import { validateQuery } from '@/lib/validation/apiValidation';
import { z } from 'zod';

export async function GET(req: Request) {
    const url = new URL(req.url);
    const schema = z.object({
        page: z.string().transform(Number).pipe(z.number().int().positive()).optional(),
        limit: z.string().transform(Number).pipe(z.number().int().positive().max(100)).optional(),
    });
    
    const result = validateQuery(url, schema);
    
    if (!result.success) {
        return result.response;
    }
    
    const { page = 1, limit = 20 } = result.data;
    // ...
}
```

## Обработка ошибок

При ошибке валидации возвращается стандартизированный ответ:

```json
{
  "ok": false,
  "error": "validation",
  "message": "Validation failed",
  "details": {
    "errors": [
      {
        "path": "email",
        "message": "Invalid email format"
      },
      {
        "path": "age",
        "message": "Must be a positive number"
      }
    ]
  }
}
```

HTTP статус: `400 Bad Request`

## Преимущества

1. **Type Safety** - TypeScript знает типы валидированных данных
2. **Безопасность** - Защита от SQL injection, XSS через валидацию типов
3. **Единообразие** - Стандартизированные ответы об ошибках
4. **Переиспользование** - Готовые схемы для частых случаев
5. **Документация** - Схемы служат документацией API

## Миграция существующих routes

### До (без валидации):

```typescript
export async function POST(req: Request) {
    const body = await req.json();
    
    if (!body.name || !body.email) {
        return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
    }
    
    // Использование body.name, body.email
}
```

### После (с валидацией):

```typescript
import { validateRequest } from '@/lib/validation/apiValidation';
import { z } from 'zod';

export async function POST(req: Request) {
    const schema = z.object({
        name: z.string().min(1),
        email: z.string().email(),
    });
    
    const result = await validateRequest(req, schema);
    if (!result.success) {
        return result.response;
    }
    
    const { name, email } = result.data; // Типизировано!
}
```

