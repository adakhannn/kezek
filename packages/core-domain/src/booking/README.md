# Booking Domain Module

Доменный модуль для бронирований и промоакций. Содержит чистые функции без зависимостей от HTTP-слоя или Supabase-клиента.

## Граница создания и подтверждения

Обновлено 2026-11-10. Public/guest/mobile создание проходит через HTTP quick-hold/quick-book-guest с сохранённым клиентским request ID. [Атомарная команда](../../../../supabase/migrations/20261110101000_atomic_booking_requests.sql) хранит receipt; [service-only boundary](../../../../supabase/migrations/20261110123000_service_only_booking_commands.sql) принимает проверенного HTTP actor явно. Прямой browser RPC создания и раздельные legacy hold-вызовы запрещены. Guest secret и actor взаимно исключаются; JWT claims не подменяются. Создание сразу записывает правильный client ID, подтверждение и outbox принадлежат той же транзакции.

Публичные `confirm_booking` и `cancel_booking` разрешают собственный client booking, owner/business manager, admin конкретного филиала, активного назначенного сотрудника или platform admin. Service role сохраняет доверенный backend-путь для проверенного WhatsApp sender. Общий частный helper блокирует staff перед booking, согласованно с финансовыми командами. Отмена допускает hold/confirmed; cancelled повторяется без эффекта. Paid, связанная позиция смены или применённая льгота требуют отдельного финансового возврата (`BOOKING_FINANCIAL_REVERSAL_REQUIRED`, HTTP409); автоматического возврата денег/посещений нет. Неизвестный ID — явный отказ, не успех.

Прямые INSERT/UPDATE/DELETE и дополнительные write grants таблицы bookings отозваны у browser-ролей, включая column grants; SELECT/RLS сохранены. Запасные прямые UPDATE отмены удалены. QuickDesk/staff создание проходит через `POST /api/bookings/internal` и [отдельную service-only команду](../../../../supabase/migrations/20261110133000_internal_booking_requests.sql). Она хранит receipt с namespace `internal` и проверенным actor отдельно от client_id записи, повторяет подтверждённый результат и сохраняет единый rollback состава услуг/outbox. Старые simple/complex internal RPC становятся owner-only; их отсутствие ключа попытки нельзя использовать для обхода нового протокола.

HTTP command ограничен 10 секундами, SQL ожидание блокировки — 5 секундами; timeout возвращает uncertain503 и сохраняет request identity для повтора. Внутренние helpers не имеют внешних EXECUTE grants. Нужен согласованный rollout миграции и клиентов. [HTTP contract](../../../../docs/api/BOOKING_AND_CATALOG.md), [booking SQL runner](../../../../scripts/test-booking-requests-isolated.cjs) и [реальные гонки с Save/Close](../../../../scripts/test-booking-finance-boundary-isolated.mjs) описывают проверенную границу; это изолированные проверки без реальных сообщений.

Анонимная страница receipt по непрозрачному UUID намеренно читает `booking_receipt_public`: время, статус, имя мастера и состав услуг, без клиентских контактов и без права изменения записи. UUID в таком URL является доступом к этому ограниченному представлению. Неиспользуемый старый `booking_view_public` закрыт для browser-ролей [отдельной миграцией](../../../../supabase/migrations/20261110140000_booking_legacy_surface.sql).

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
const rpcData: unknown = { booking_id: '55555555-5555-4555-8555-555555555555' };
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

