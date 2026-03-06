# Прогресс миграции console.log (архив)

**Архив.** Миграция завершена; актуальная политика — [LOGGING_POLICY.md](../../apps/web/src/lib/LOGGING_POLICY.md).

---

## Статус

- ✅ ESLint правило добавлено (предупреждение при использовании console.log)
- ✅ Система безопасного логирования готова (`@/lib/log`)
- ✅ Миграция завершена (защита через ESLint и CI)

## Мигрированные файлы (на момент архивации)

### API Routes (приоритет 1)
- ✅ `apps/web/src/app/api/staff/shift/today/route.ts` - все console.error заменены на logError
- ✅ `apps/web/src/app/api/auth/yandex/callback/route.ts` - все console.log/error заменены на logDebug/logError

### Компоненты (приоритет 2)
- ⏳ В процессе

### Утилиты (приоритет 3)
- ⏳ В процессе

## Инструкции по миграции

### Замена console.log
```typescript
// ❌ Было:
console.log('Debug info', data);

// ✅ Стало:
import { logDebug } from '@/lib/log';
logDebug('MyScope', 'Debug info', data);
```

### Замена console.warn
```typescript
// ❌ Было:
console.warn('Warning message');

// ✅ Стало:
import { logWarn } from '@/lib/log';
logWarn('MyScope', 'Warning message');
```

### Замена console.error
```typescript
// ❌ Было:
console.error('Error:', error);

// ✅ Стало:
import { logError } from '@/lib/log';
logError('MyScope', 'Error occurred', error);
```

## Scope (область логирования)

Используйте осмысленные scope для группировки логов:
- `'Auth'` - для логирования авторизации
- `'Booking'` - для логирования бронирований
- `'Payment'` - для логирования платежей
- `'API'` - для логирования API запросов
- `'StaffShift'` - для логирования смен сотрудников
