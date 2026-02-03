# Руководство по тестированию API Routes

## Обзор

Это руководство описывает подход к тестированию API routes в проекте. Цель - обеспечить покрытие тестами всех критичных endpoints.

## Структура тестов

### Расположение файлов
```
apps/web/src/__tests__/api/
├── testHelpers.ts          # Общие утилиты и моки
├── quick-hold.test.ts      # Пример теста
├── quick-book-guest.test.ts
├── staff/
│   └── create.test.ts
├── bookings/
│   └── cancel.test.ts
└── TESTING_GUIDE.md        # Это руководство
```

### Именование
- Файлы тестов: `[route-name].test.ts`
- Группировка по папкам соответствует структуре API routes

## Инфраструктура

### testHelpers.ts

Содержит общие утилиты:
- `createMockRequest()` - создание мок Request
- `createMockSupabase()` - создание мок Supabase клиента
- `setupApiTestMocks()` - настройка стандартных моков
- `expectSuccessResponse()` - проверка успешного ответа
- `expectErrorResponse()` - проверка ответа с ошибкой

### Стандартные моки

Все тесты должны мокировать:
- `@/lib/rateLimit` - rate limiting
- `next/headers` - cookies и headers
- `@supabase/supabase-js` - Supabase клиент
- `@supabase/ssr` - SSR Supabase клиент

## Структура теста

```typescript
import { POST } from '@/app/api/route-name/route';
import { setupApiTestMocks, createMockRequest, ... } from './testHelpers';

setupApiTestMocks();

import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

describe('/api/route-name', () => {
    const mockSupabase = createMockSupabase();

    beforeEach(() => {
        jest.clearAllMocks();
        // Настройка моков
    });

    describe('Авторизация', () => {
        test('должен вернуть 401 если не авторизован', async () => {
            // Тест
        });
    });

    describe('Валидация', () => {
        test('должен вернуть 400 при невалидных данных', async () => {
            // Тест
        });
    });

    describe('Успешный сценарий', () => {
        test('должен успешно выполнить операцию', async () => {
            // Тест
        });
    });

    describe('Обработка ошибок', () => {
        test('должен обработать ошибку БД', async () => {
            // Тест
        });
    });
});
```

## Что тестировать

### Обязательные тесты для каждого route:

1. **Авторизация** (если требуется)
   - 401 при отсутствии авторизации
   - 403 при недостаточных правах

2. **Валидация входных данных**
   - 400 при отсутствии обязательных полей
   - 400 при невалидном формате данных
   - 400 при невалидных типах данных

3. **Успешный сценарий**
   - 200 с корректными данными
   - Проверка вызова правильных методов БД
   - Проверка структуры ответа

4. **Обработка ошибок**
   - Ошибки БД (RPC, queries)
   - Ошибки валидации
   - Edge cases (не найдено, конфликты)

### Дополнительные тесты (по необходимости):

- Rate limiting
- Логирование
- Уведомления
- Сложная бизнес-логика

## Примеры

### Простой GET endpoint

```typescript
describe('/api/staff/shift/today', () => {
    test('должен вернуть смену на сегодня', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
        });

        mockSupabase.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            single: jest.fn().mockResolvedValue({
                data: { id: 'shift-id', date: '2024-01-01' },
            }),
        });

        const req = createMockRequest('http://localhost/api/staff/shift/today');
        const res = await GET(req);
        const data = await expectSuccessResponse(res);

        expect(data.id).toBe('shift-id');
    });
});
```

### POST endpoint с валидацией

```typescript
describe('/api/services/create', () => {
    test('должен вернуть 400 при отсутствии name', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
        });

        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: {
                branch_id: 'branch-id',
                duration_min: 30,
                // name отсутствует
            },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400);
    });
});
```

### Endpoint с RPC

```typescript
describe('/api/bookings/[id]/cancel', () => {
    test('должен вызвать RPC cancel_booking', async () => {
        // Настройка моков...

        mockSupabase.rpc.mockResolvedValueOnce({
            data: { id: bookingId, status: 'cancelled' },
            error: null,
        });

        const req = createMockRequest(`http://localhost/api/bookings/${bookingId}/cancel`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: bookingId } });
        
        expect(mockSupabase.rpc).toHaveBeenCalledWith(
            'cancel_booking',
            expect.objectContaining({ p_booking_id: bookingId })
        );
    });
});
```

## Приоритеты тестирования

### Высокий приоритет (критичные endpoints):
1. ✅ `quick-hold` - быстрое создание брони
2. ✅ `quick-book-guest` - гостевая бронь
3. ⏳ `bookings/[id]/cancel` - отмена брони
4. ⏳ `bookings/[id]/mark-attendance` - отметка посещения
5. ⏳ `staff/shift/close` - закрытие смены
6. ⏳ `notify` - отправка уведомлений

### Средний приоритет:
- CRUD операции (staff, services, branches)
- Финансовые endpoints
- Dashboard endpoints

### Низкий приоритет:
- Admin endpoints
- Debug endpoints
- Health checks

## Запуск тестов

```bash
# Все тесты
npm test

# Только API тесты
npm test -- __tests__/api

# Конкретный файл
npm test -- quick-hold.test.ts

# С покрытием
npm test -- --coverage
```

## Покрытие

Цель: **80%+ покрытие для критичных endpoints**

Текущее состояние:
- ✅ `quick-hold` - покрыт
- ✅ `quick-book-guest` - покрыт
- ⏳ Остальные ~90+ routes - требуют тестов

## Best Practices

1. **Используйте общие утилиты** из `testHelpers.ts`
2. **Группируйте тесты** по функциональности (describe blocks)
3. **Тестируйте edge cases** - не только happy path
4. **Проверяйте вызовы** методов БД (mockSupabase.rpc, mockSupabase.insert)
5. **Используйте типизацию** - TypeScript помогает избежать ошибок
6. **Документируйте сложные тесты** - комментарии для неочевидных случаев

## Следующие шаги

1. Создать тесты для всех критичных endpoints (высокий приоритет)
2. Добавить тесты для CRUD операций
3. Настроить CI/CD для автоматического запуска тестов
4. Добавить тесты производительности для медленных endpoints

