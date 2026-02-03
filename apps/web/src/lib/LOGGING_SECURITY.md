# Безопасное логирование

## Проблема

Логирование чувствительных данных (токены, ключи, пароли) может привести к утечке информации, если логи попадут в руки злоумышленников.

## Решение

Создан модуль `apps/web/src/lib/logSafe.ts` для автоматического маскирования чувствительных данных при логировании.

## Использование

### Базовое использование

```typescript
import { logSafe, logErrorSafe, logDebugSafe } from '@/lib/logSafe';

// Автоматически маскирует чувствительные поля
logSafe('MyScope', 'User logged in', {
    userId: '123',
    token: 'secret-token-here', // Будет замаскирован
    apiKey: 'key-12345', // Будет замаскирован
    email: 'user@example.com' // Останется как есть
});

// Вывод:
// [MyScope] User logged in { userId: '123', token: 'secr****oken', apiKey: 'key-****45', email: 'user@example.com' }
```

### Использование существующих функций

Функции `logDebug`, `logError`, `logWarn` из `@/lib/log` автоматически используют безопасное логирование:

```typescript
import { logError, logDebug } from '@/lib/log';

// Токены автоматически замаскируются
logError('QuickHold', 'Auth failed', {
    token: 'secret-token',
    error: 'Invalid token'
});
```

### Маскирование токенов вручную

```typescript
import { maskToken } from '@/lib/logSafe';

const token = 'very-secret-token-12345';
console.log('Token:', maskToken(token));
// Вывод: Token: very****2345
```

### Маскирование URL

```typescript
import { maskUrl } from '@/lib/logSafe';

const url = 'https://api.example.com/endpoint?token=secret&key=123';
console.log('URL:', maskUrl(url));
// Вывод: URL: https://api.example.com/endpoint?token=secr****ret&key=123
```

## Что маскируется автоматически

Следующие поля автоматически маскируются:

- `token`, `access_token`, `refresh_token`, `bearer_token`
- `api_key`, `apiKey`, `apikey`
- `secret`, `secret_key`, `secretKey`
- `password`, `passwd`, `pwd`
- `authorization`, `auth`
- `key`, `private_key`, `privateKey`
- `service_role_key`, `serviceRoleKey`
- `supabase_key`, `supabaseKey`
- `resend_api_key`, `resendApiKey`
- `whatsapp_access_token`, `whatsappAccessToken`
- `telegram_token`, `telegramToken`
- `session`, `session_id`, `sessionId`
- `cookie`, `cookies`

И любые другие поля, содержащие эти слова в названии.

## Формат маскирования

- **Короткие значения (≤8 символов)**: `****`
- **Средние значения (9-16 символов)**: `ab****cd` (первые 2 и последние 2 символа)
- **Длинные значения (>16 символов)**: `abcd****wxyz (length: 32)` (первые 4 и последние 4 символа + длина)

## Правила безопасного логирования

### ✅ МОЖНО логировать:

- User IDs (UUID)
- Email адреса (но не пароли!)
- Имена пользователей
- Номера телефонов (но не полные с кодом доступа)
- Общие метрики и статистику
- Ошибки без чувствительных данных

### ❌ НЕЛЬЗЯ логировать:

- Токены доступа (access tokens, refresh tokens)
- API ключи
- Пароли (даже хешированные)
- Service Role Keys
- Сессионные данные
- Полные URL с токенами в query параметрах
- Персональные данные (ПДн) без согласия

### ⚠️ ОСТОРОЖНО:

- Email адреса (могут быть ПДн)
- Номера телефонов (могут быть ПДн)
- IP адреса (могут быть ПДн)
- Геолокация (может быть ПДн)

## Примеры

### ❌ НЕПРАВИЛЬНО:

```typescript
// НЕ ДЕЛАЙТЕ ТАК!
console.log('Token:', bearerToken);
logError('Auth', 'Failed', { token: bearerToken });
logDebug('API', 'Request', { apiKey: process.env.API_KEY });
```

### ✅ ПРАВИЛЬНО:

```typescript
// Используйте безопасное логирование
import { logError, logDebug } from '@/lib/log';

logError('Auth', 'Failed', { 
    hasToken: !!bearerToken,
    tokenLength: bearerToken?.length 
    // Токен автоматически замаскируется
});

logDebug('API', 'Request', { 
    hasApiKey: !!process.env.API_KEY 
    // Ключ не логируется вообще
});
```

## Интеграция с системами мониторинга

При интеграции с Sentry, LogRocket и другими системами мониторинга:

1. **Используйте безопасное логирование перед отправкой:**
   ```typescript
   import { sanitizeObject } from '@/lib/logSafe';
   import * as Sentry from '@sentry/nextjs';
   
   Sentry.captureException(error, {
       extra: sanitizeObject(sensitiveData)
   });
   ```

2. **Настройте фильтры на стороне мониторинга:**
   - Sentry: Data Scrubbing
   - LogRocket: Privacy settings

## Проверка логов

Перед деплоем проверьте логи на наличие чувствительных данных:

```bash
# Поиск потенциальных утечек
grep -r "token.*=" logs/ | grep -v "masked\|****"
grep -r "api.*key" logs/ | grep -v "masked\|****"
grep -r "password" logs/ | grep -v "masked\|****"
```

## Миграция существующего кода

1. Замените `console.log/error/warn` на `logSafe/logErrorSafe/logDebugSafe`
2. Или используйте существующие функции из `@/lib/log` (они уже безопасны)
3. Удалите явное логирование токенов и ключей
4. Используйте `maskToken()` для ручного маскирования при необходимости

## Дополнительные ресурсы

- [OWASP: Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP: Data Protection](https://owasp.org/www-project-data-security-top-10/)

