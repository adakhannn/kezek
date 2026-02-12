# Синхронизация типов и схем

## Обзор

Этот модуль обеспечивает синхронизацию между Zod-схемами валидации и TypeScript-типами, используя автоматическую генерацию типов из схем.

## Принцип работы

1. **Zod-схемы** определяются в `schemas.ts` - это единый источник истины
2. **TypeScript-типы** генерируются автоматически из схем с помощью `z.infer<>` в `types.ts`
3. **Использование**: Импортируйте типы из `@/lib/validation/types` вместо ручного определения

## Преимущества

- ✅ **Единый источник истины**: Изменения в схеме автоматически отражаются в типах
- ✅ **Нет расхождений**: Типы всегда соответствуют валидации
- ✅ **Type Safety**: TypeScript проверяет корректность использования типов
- ✅ **Автоматическая синхронизация**: Не нужно вручную поддерживать типы и схемы

## Использование

### На бэкенде (API routes)

```typescript
import { validateRequest } from '@/lib/validation/apiValidation';
import { saveShiftItemsSchema } from '@/lib/validation/schemas';
import type { SaveShiftItemsRequest } from '@/lib/validation/types';

export async function POST(req: Request) {
    const result = await validateRequest(req, saveShiftItemsSchema);
    
    if (!result.success) {
        return result.response;
    }
    
    // result.data имеет тип SaveShiftItemsRequest
    const { items, staffId, shiftDate } = result.data;
}
```

### На фронтенде (React components)

```typescript
import type { ShiftItem } from '@/lib/validation/types';

interface Props {
    item: ShiftItem;
    onUpdate: (item: ShiftItem) => void;
}

function MyComponent({ item, onUpdate }: Props) {
    // item типизирован и соответствует схеме валидации
}
```

## Добавление новой схемы

1. Добавьте Zod-схему в `schemas.ts`:
```typescript
export const myNewSchema = z.object({
    field1: z.string().min(1),
    field2: z.number().positive(),
}).strict();
```

2. Экспортируйте тип в `types.ts`:
```typescript
export type MyNewType = z.infer<typeof myNewSchema>;
```

3. Используйте тип везде, где нужна типизация:
```typescript
import type { MyNewType } from '@/lib/validation/types';
```

## Миграция существующих типов

Если у вас есть ручные типы, которые должны быть синхронизированы со схемами:

1. Обновите Zod-схему, чтобы она соответствовала реальному использованию
2. Замените ручной тип на `z.infer<typeof schema>`
3. Обновите импорты в файлах, использующих старый тип

Пример:
```typescript
// ❌ Было (ручной тип)
export type ShiftItem = {
    id?: string;
    clientName: string;
    serviceAmount: number;
};

// ✅ Стало (из схемы)
export type ShiftItem = z.infer<typeof shiftItemSchema>;
```

## Проверка синхронизации

TypeScript автоматически проверяет соответствие типов. Если схема и тип расходятся, компилятор выдаст ошибку.

Для дополнительной проверки можно использовать:
```typescript
// Проверка, что тип соответствует схеме
const testItem: ShiftItem = shiftItemSchema.parse({
    // данные
});
```

## Рекомендации

1. **Всегда используйте типы из `@/lib/validation/types`** вместо ручного определения
2. **Изменяйте схемы, а не типы** - типы генерируются автоматически
3. **Документируйте схемы** - они служат документацией API
4. **Используйте `.strict()`** в схемах для защиты от лишних полей
5. **Добавляйте валидацию** в схемы (min, max, regex и т.д.)

