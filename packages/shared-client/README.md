# Shared Client Package

Общий пакет для web и mobile приложений, содержащий:

- **Безопасное логирование** — автоматическое маскирование чувствительных данных
- **Валидация данных** — общие валидаторы (телефон, email, UUID, цены, проценты)
- **Базовые типы DTO** — типы для бронирований, смен, промо, рейтингов

## Установка

Пакет уже включён в монорепозиторий через `pnpm-workspace.yaml`.

## Использование

### Логирование

#### Web приложение

```typescript
import { createLogger } from '@shared-client/log';

const { logDebug, logWarn, logError } = createLogger(() => process.env.NODE_ENV !== 'production');

logDebug('MyComponent', 'User action', { userId: '123' });
logWarn('MyComponent', 'Warning message', { data: '...' });
logError('MyComponent', 'Error occurred', { error: '...' });
```

#### Mobile приложение

```typescript
import { createLogger } from '@shared-client/log';

const { logDebug, logWarn, logError } = createLogger(() => __DEV__);

logDebug('MyScreen', 'User action', { userId: '123' });
logWarn('MyScreen', 'Warning message', { data: '...' });
logError('MyScreen', 'Error occurred', { error: '...' });
```

### Валидация

```typescript
import { validateEmail, validatePhone, isUuid, validatePercent } from '@shared-client/validation';

// Email
const emailResult = validateEmail('user@example.com');
if (!emailResult.valid) {
    console.error(emailResult.error);
}

// Телефон
const phoneResult = validatePhone('+996555123456', true);
if (!phoneResult.valid) {
    console.error(phoneResult.error);
}

// UUID
if (isUuid(someId)) {
    // валидный UUID
}

// Процент
const percentResult = validatePercent(50);
if (!percentResult.valid) {
    console.error(percentResult.error);
}
```

### Типы

```typescript
import type { BookingDto, Slot, StaffInfo, BranchInfo } from '@shared-client/types';

function processBooking(booking: BookingDto) {
    // ...
}

function filterSlots(slots: Slot[], staffId: string) {
    return slots.filter(s => s.staff_id === staffId);
}
```

### API клиент

#### Web приложение

```typescript
import { createApiClient } from '@shared-client/api';
import { supabase } from '@/lib/supabaseClient';

const { apiRequest } = createApiClient({
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'https://kezek.kg',
    getAuthToken: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    },
});

// Использование
const data = await apiRequest<{ bookings: BookingDto[] }>('/api/bookings');
```

#### Mobile приложение

```typescript
import { createApiClient } from '@shared-client/api';
import { supabase } from './supabase';

const { apiRequest } = createApiClient({
    baseUrl: process.env.EXPO_PUBLIC_API_URL || 'https://kezek.kg',
    getAuthToken: async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || null;
    },
});

// Использование
const data = await apiRequest<{ bookings: BookingDto[] }>('/api/bookings');
```

### i18n хэлперы

#### Web приложение

```typescript
import { getServiceName, formatStaffName, getStatusColorWeb, getStatusText } from '@shared-client/i18n';
import { useLanguage } from '@/app/_components/i18n/LanguageProvider';

function MyComponent() {
    const { locale } = useLanguage();
    
    const serviceName = getServiceName(service, locale);
    const staffName = formatStaffName(staff.full_name, locale);
    const statusColor = getStatusColorWeb('confirmed');
    const statusText = getStatusText('confirmed', locale);
    
    return (
        <div className={statusColor.className}>
            {statusText}
        </div>
    );
}
```

#### Mobile приложение

```typescript
import { getServiceName, formatStaffName, getStatusColorMobile, getStatusText } from '@shared-client/i18n';

const serviceName = getServiceName(service, 'ru');
const staffName = formatStaffName(staff.full_name, 'ru');
const statusColor = getStatusColorMobile('confirmed'); // '#3b82f6'
const statusText = getStatusText('confirmed', 'ru'); // 'Подтверждено'

<View style={{ backgroundColor: statusColor }}>
    <Text>{statusText}</Text>
</View>
```

## Структура

- `log.ts` — фабрика функций логирования
- `logSafe.ts` — утилиты для маскирования чувствительных данных
- `validation.ts` — функции валидации
- `types.ts` — базовые типы DTO
- `api.ts` — базовый HTTP клиент для API запросов
- `i18n.ts` — хэлперы для локализации (названия услуг, имена сотрудников, статусы)
- `transliterate.ts` — транслитерация кириллицы в латиницу
- `index.ts` — публичный API пакета

## Принципы

1. **Безопасность** — автоматическое маскирование токенов, паролей, ключей
2. **Единообразие** — одинаковые валидаторы и типы для web и mobile
3. **Типобезопасность** — все функции типизированы
4. **Чистые функции** — без side effects, без зависимостей от внешних сервисов

