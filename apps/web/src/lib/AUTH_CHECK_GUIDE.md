# Руководство по проверке прав доступа в API endpoints

## Обзор

Все API endpoints должны проверять права доступа пользователя перед выполнением операций. Для этого используется централизованная утилита `@/lib/authCheck`.

## Основные утилиты

### `checkResourceBelongsToBusiness`

Проверяет, принадлежит ли ресурс указанному бизнесу.

```typescript
import { checkResourceBelongsToBusiness } from '@/lib/authCheck';

const check = await checkResourceBelongsToBusiness(
    'bookings',      // название таблицы
    bookingId,       // ID ресурса
    bizId,           // ID бизнеса
    'biz_id'         // название колонки с ID бизнеса (опционально, по умолчанию 'biz_id')
);

if (!check.belongs) {
    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
}
```

### Специализированные функции

Для удобства созданы специализированные функции для проверки конкретных типов ресурсов:

```typescript
import {
    checkBranchBelongsToBusiness,
    checkStaffBelongsToBusiness,
    checkServiceBelongsToBusiness,
    checkBookingBelongsToBusiness,
    checkPromotionBelongsToBusiness,
} from '@/lib/authCheck';

// Проверка филиала
const branchCheck = await checkBranchBelongsToBusiness(branchId, bizId);

// Проверка сотрудника
const staffCheck = await checkStaffBelongsToBusiness(staffId, bizId);

// Проверка услуги
const serviceCheck = await checkServiceBelongsToBusiness(serviceId, bizId);

// Проверка бронирования
const bookingCheck = await checkBookingBelongsToBusiness(bookingId, bizId);

// Проверка акции
const promotionCheck = await checkPromotionBelongsToBusiness(promotionId, bizId);
```

## Примеры использования

### Пример 1: Проверка доступа к бронированию

```typescript
export async function POST(req: Request) {
    return withErrorHandler('MyEndpoint', async () => {
        const { supabase } = await createSupabaseClients();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const body = await req.json();
        const bookingId = body.booking_id;

        // Проверяем, является ли пользователь клиентом бронирования
        const { data: booking } = await supabase
            .from('bookings')
            .select('client_id, biz_id')
            .eq('id', bookingId)
            .maybeSingle();

        if (!booking) {
            return createErrorResponse('not_found', 'Бронирование не найдено', undefined, 404);
        }

        const isClient = booking.client_id === user.id;

        // Если не клиент, проверяем, является ли пользователь менеджером бизнеса
        if (!isClient) {
            try {
                const { bizId } = await getBizContextForManagers();
                const check = await checkBookingBelongsToBusiness(bookingId, bizId);
                if (!check.belongs) {
                    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
                }
            } catch {
                return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
            }
        }

        // Продолжаем выполнение операции
        // ...
    });
}
```

### Пример 2: Проверка доступа менеджера к ресурсу

```typescript
export async function PATCH(req: Request, context: unknown) {
    return withErrorHandler('MyEndpoint', async () => {
        const resourceId = await getRouteParamUuid(context, 'id');
        const { bizId } = await getBizContextForManagers();
        
        // Проверяем, что ресурс принадлежит бизнесу менеджера
        const check = await checkResourceBelongsToBusiness('my_table', resourceId, bizId);
        
        if (!check.belongs) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Продолжаем выполнение операции
        // ...
    });
}
```

### Пример 3: Проверка принадлежности пользователя к ресурсу

```typescript
export async function DELETE(req: Request, context: unknown) {
    return withErrorHandler('MyEndpoint', async () => {
        const { supabase } = await createSupabaseClients();
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
            return createErrorResponse('auth', 'Не авторизован', undefined, 401);
        }

        const resourceId = await getRouteParamUuid(context, 'id');

        // Проверяем, что ресурс принадлежит пользователю
        const { data: resource } = await supabase
            .from('my_table')
            .select('user_id')
            .eq('id', resourceId)
            .maybeSingle();

        if (!resource) {
            return createErrorResponse('not_found', 'Ресурс не найден', undefined, 404);
        }

        if (resource.user_id !== user.id) {
            return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
        }

        // Продолжаем выполнение операции
        // ...
    });
}
```

## Рекомендации

1. **Всегда проверяйте авторизацию** перед проверкой прав доступа
2. **Используйте специализированные функции** для конкретных типов ресурсов
3. **Проверяйте принадлежность к бизнесу** для операций менеджеров
4. **Проверяйте принадлежность пользователю** для операций клиентов
5. **Возвращайте понятные сообщения об ошибках** (403 для запрета доступа, 404 для не найденных ресурсов)

## Интеграция с `getBizContextForManagers`

Для endpoints, доступных только менеджерам, используйте `getBizContextForManagers`:

```typescript
import { getBizContextForManagers } from '@/lib/authBiz';

const { bizId } = await getBizContextForManagers();
// Эта функция автоматически проверяет, что пользователь является менеджером бизнеса
```

## Обработка ошибок

Все функции проверки возвращают объект с полем `belongs` (boolean) и опциональным полем `error` (string):

```typescript
const check = await checkBookingBelongsToBusiness(bookingId, bizId);

if (check.error) {
    logError('MyEndpoint', 'Error checking booking', { error: check.error });
    return createErrorResponse('internal', 'Ошибка проверки доступа', undefined, 500);
}

if (!check.belongs) {
    return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
}
```

