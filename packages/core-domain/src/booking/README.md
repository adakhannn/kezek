# Booking Domain Module

Доменный модуль для бронирований и промоакций. Содержит чистые функции без зависимостей от HTTP-слоя или Supabase-клиента.

## Структура

- **`types.ts`** — типы для бронирований, промоакций и их параметров
- **`dto.ts`** — DTO (Data Transfer Objects) и функции преобразования данных БД в доменные объекты
- **`validation.ts`** — функции валидации входных данных
- **`index.ts`** — публичный API модуля

## Использование

### Импорт

```typescript
import {
    // Типы
    type CreateBookingParams,
    type CreateGuestBookingParams,
    type BookingDto,
    type PromotionDto,
    type PromotionApplied,
    
    // Валидация
    validateCreateBookingParams,
    validateCreateGuestBookingParams,
    validatePromotionParams,
    extractBookingId,
    
    // Преобразование данных
    transformBookingToDto,
    normalizePromotionApplied,
    transformPromotionToDto,
} from '@core-domain/booking';
```

### Примеры

#### Валидация параметров создания бронирования

```typescript
const validation = validateCreateBookingParams({
    biz_id: '...',
    service_id: '...',
    staff_id: '...',
    start_at: '2024-01-15T10:00:00+06:00',
    branch_id: '...', // опционально
});

if (!validation.valid) {
    return createErrorResponse('validation', validation.error, undefined, 400);
}

const params = validation.data; // CreateBookingParams
```

#### Извлечение booking_id из RPC результата

```typescript
const { data: rpcData } = await supabase.rpc('hold_slot', { ... });
const bookingId = extractBookingId(rpcData);

if (!bookingId) {
    return createErrorResponse('validation', 'Unexpected RPC result', undefined, 400);
}
```

#### Преобразование данных бронирования в DTO

```typescript
const booking = await supabase
    .from('bookings')
    .select('*')
    .single();

const bookingDto = transformBookingToDto(booking);
```

#### Нормализация promotion_applied

```typescript
const booking = await supabase
    .from('bookings')
    .select('promotion_applied')
    .single();

const promotionApplied = normalizePromotionApplied(booking.promotion_applied);
// promotionApplied: PromotionApplied | null
```

## Принципы

1. **Чистые функции** — без side effects, без зависимостей от внешних сервисов
2. **Типобезопасность** — все функции типизированы, используются TypeScript типы
3. **Валидация** — централизованная валидация входных данных
4. **Преобразование** — единообразное преобразование данных БД в DTO

## Интеграция с API

Модуль используется в следующих API endpoints:

- `/api/quick-hold` — создание бронирования для авторизованных пользователей
- `/api/quick-book-guest` — создание гостевой брони
- `/api/bookings/[id]/mark-attendance` — отметка посещения с применением промоакций

## Расширение

При добавлении новых типов промоакций или полей бронирования:

1. Обновите типы в `types.ts`
2. Добавьте валидацию в `validation.ts` (если нужна специфичная логика)
3. Обновите функции преобразования в `dto.ts` (если нужна нормализация)
4. Экспортируйте новые функции через `index.ts`

