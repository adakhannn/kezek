# Миграция console.log на безопасное логирование

## Проблема

В проекте найдено **339 вхождений** `console.log/warn/error` в **82 файлах**. Это может привести к:
- Утечке чувствительных данных в логах
- Проблемам с производительностью в продакшене
- Неконтролируемому логированию

## Решение

Используйте безопасное логирование из `@/lib/log`:

### ✅ Правильно:

```typescript
import { logDebug, logWarn, logError } from '@/lib/log';

// Debug логи (только в dev)
logDebug('MyScope', 'User action', { userId: '123' });

// Предупреждения (только в dev)
logWarn('MyScope', 'Deprecated feature used');

// Ошибки (в dev и prod, автоматически маскируются)
logError('MyScope', 'Operation failed', error);
```

### ❌ Неправильно:

```typescript
// НЕ ДЕЛАЙТЕ ТАК!
console.log('User action', { userId: '123', token: 'secret' });
console.warn('Deprecated feature');
console.error('Error:', error);
```

## Преимущества безопасного логирования

1. **Автоматическое маскирование** чувствительных данных (токены, ключи, пароли)
2. **Контроль уровня логирования** - debug логи только в dev
3. **Единый формат** - все логи имеют структурированный формат
4. **Готовность к мониторингу** - легко интегрировать с Sentry/LogRocket

## Миграция

### Шаг 1: Замените прямые console.log

**Было:**
```typescript
console.log('Debug info', data);
```

**Стало:**
```typescript
import { logDebug } from '@/lib/log';
logDebug('MyScope', 'Debug info', data);
```

### Шаг 2: Замените console.warn

**Было:**
```typescript
console.warn('Warning message');
```

**Стало:**
```typescript
import { logWarn } from '@/lib/log';
logWarn('MyScope', 'Warning message');
```

### Шаг 3: Замените console.error

**Было:**
```typescript
console.error('Error:', error);
```

**Стало:**
```typescript
import { logError } from '@/lib/log';
logError('MyScope', 'Error occurred', error);
```

## Scope (область логирования)

Используйте осмысленные scope для группировки логов:
- `'Booking'` - для логирования бронирований
- `'Auth'` - для логирования авторизации
- `'Payment'` - для логирования платежей
- `'API'` - для логирования API запросов

## Статус миграции

### ✅ Обновлено:
- `apps/web/src/lib/log.ts` - безопасное логирование
- `apps/web/src/lib/logSafe.ts` - утилиты маскирования
- `apps/web/src/app/b/[slug]/view.tsx` - заменены debugLog/debugWarn
- `apps/web/src/app/b/[slug]/hooks/useBookingSteps.ts` - заменены console.log
- `apps/web/src/middleware.ts` - заменен console.warn
- `apps/web/src/lib/logger.ts` - обновлен для использования безопасного логирования

### ⏳ Требуют обновления (~75 файлов):
- API routes
- Client components
- Server components
- Утилиты

## Автоматизация

Для поиска всех console.log:

```bash
# Найти все console.log
grep -r "console\.log" apps/web/src

# Найти все console.warn
grep -r "console\.warn" apps/web/src

# Найти все console.error
grep -r "console\.error" apps/web/src
```

## Правила

1. **Никогда не логируйте** чувствительные данные напрямую
2. **Используйте logDebug** для отладочной информации (только dev)
3. **Используйте logWarn** для предупреждений (только dev)
4. **Используйте logError** для ошибок (dev и prod, автоматически маскируется)
5. **Всегда указывайте scope** для группировки логов

## Дополнительные ресурсы

- `LOGGING_SECURITY.md` - правила безопасного логирования
- `log.ts` - основной модуль логирования
- `logSafe.ts` - утилиты маскирования

