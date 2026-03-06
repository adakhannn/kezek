# Политика логирования в проекте Kezek

## 🎯 Цель

Обеспечить безопасное, контролируемое и структурированное логирование во всем приложении, предотвращая утечки чувствительных данных и проблемы с производительностью.

## 📋 Правила

### ✅ Обязательные правила

1. **НИКОГДА не используйте `console.log`, `console.warn`, `console.info`, `console.debug` напрямую в продакшен-коде**
   - ESLint правило `no-console` настроено как `error` - любой `console.*` (кроме `console.error` в лог-утилитах) сломает сборку
   - CI автоматически проверяет это на каждом `push`/PR

2. **Всегда используйте безопасные утилиты из `@/lib/log`**:
   ```typescript
   import { logDebug, logWarn, logError } from '@/lib/log';
   ```

3. **Всегда указывайте осмысленный `scope`** для группировки логов:
   - `'Booking'` - для логирования бронирований
   - `'Auth'` - для логирования авторизации
   - `'Payment'` - для логирования платежей
   - `'API'` - для логирования API запросов
   - `'Staff'` - для логирования операций с сотрудниками
   - и т.д.

### 📝 Примеры использования

#### ✅ Правильно: Debug логирование (только в dev)

```typescript
import { logDebug } from '@/lib/log';

// Логирует только в development режиме
logDebug('Booking', 'User selected service', { 
  serviceId: '123',
  userId: '456' 
});
```

#### ✅ Правильно: Предупреждения (только в dev)

```typescript
import { logWarn } from '@/lib/log';

// Логирует только в development режиме
logWarn('Auth', 'Deprecated authentication method used', {
  method: 'legacy-oauth'
});
```

#### ✅ Правильно: Ошибки (в dev и prod, автоматически маскируются)

```typescript
import { logError } from '@/lib/log';

// Логирует в dev и prod, автоматически маскирует чувствительные данные
try {
  await processPayment(data);
} catch (error) {
  logError('Payment', 'Payment processing failed', {
    error,
    userId: '123',
    amount: 1000,
    // Токены и ключи будут автоматически замаскированы
    apiKey: 'secret-key-123' // → 'secr*****23'
  });
}
```

#### ❌ НЕПРАВИЛЬНО: Прямое использование console.*

```typescript
// ❌ НЕ ДЕЛАЙТЕ ТАК! Это сломает сборку из-за ESLint правила
console.log('User action', { userId: '123', token: 'secret' });
console.warn('Warning message');
console.error('Error:', error);
```

## 🔒 Безопасность

### Автоматическое маскирование

Все функции логирования (`logDebug`, `logWarn`, `logError`) автоматически маскируют чувствительные данные:

- **Токены**: `access_token`, `refresh_token`, `bearer_token`
- **Ключи**: `api_key`, `apiKey`, `secret`, `secret_key`
- **Пароли**: `password`, `passwd`, `pwd`
- **Авторизация**: `authorization`, `auth`, `cookie`, `cookies`
- **Специфичные для проекта**: `supabase_key`, `resend_api_key`, `whatsapp_token`, `telegram_token`

**Пример маскирования:**
```typescript
logDebug('Auth', 'Token received', {
  access_token: 'sk_live_1234567890abcdef' 
  // → 'sk_l*****cdef (length: 24)'
});
```

Подробнее о маскировании и безопасном выводе: **`apps/web/src/lib/LOGGING_SECURITY.md`**.

### Что НЕ логировать

**НИКОГДА не логируйте:**
- Пароли пользователей
- Полные токены доступа (они маскируются автоматически, но лучше не передавать)
- Кредитные карты и платежные данные
- Персональные данные без необходимости (GDPR)
- Служебные ключи API

## 🎛️ Уровни логирования

### `logDebug(scope, message, extra?)`
- **Когда использовать**: Отладочная информация, детали выполнения операций
- **Видимость**: Только в `development` режиме (`NODE_ENV !== 'production'`)
- **Примеры**: 
  - Выбор пользователем услуги
  - Параметры запроса к API
  - Состояние компонента

### `logWarn(scope, message, extra?)`
- **Когда использовать**: Предупреждения о потенциальных проблемах, устаревших методах
- **Видимость**: Только в `development` режиме
- **Примеры**:
  - Использование deprecated API
  - Неоптимальные запросы к БД
  - Неожиданные, но некритичные ситуации

### `logError(scope, message, extra?)`
- **Когда использовать**: Ошибки, исключения, критические проблемы
- **Видимость**: В `development` и `production` режимах
- **Автоматическое маскирование**: Да
- **Примеры**:
  - Ошибки обработки платежей
  - Сбои API запросов
  - Ошибки валидации данных

## 🛠️ Технические детали

### ESLint правило

В `apps/web/eslint.config.mjs` настроено строгое правило:
```javascript
"no-console": ["error", { 
  allow: ["error"] // console.error разрешен только в log.ts и logSafe.ts
}]
```

### CI проверка

В `.github/workflows/ci.yml` автоматически запускается:
```bash
pnpm -C apps/web lint
```

Любой `console.*` (кроме разрешенных) приведет к падению сборки.

### Разрешенные исключения

`console.error` разрешен только в:
- `apps/web/src/lib/log.ts` - основной модуль логирования
- `apps/web/src/lib/logSafe.ts` - утилиты маскирования

Эти файлы используют `eslint-disable-next-line no-console` для обоснованных случаев.

## Миграция с console.log

Миграция с прямых вызовов `console.*` на `logDebug`/`logWarn`/`logError` из `@/lib/log` завершена: ESLint и CI не допускают появления новых `console.*` в коде. Если в старом коде или при ревью встречается `console.log`/`warn`/`error`, замените по образцу:

```typescript
// Было:
console.log('Debug info', data);

// Стало:
import { logDebug } from '@/lib/log';
logDebug('MyScope', 'Debug info', data);
```

История миграции и детальные инструкции (для справки): **docs/archive/** — файлы `CONSOLE_LOG_MIGRATION.md`, `CONSOLE_LOG_MIGRATION_PROGRESS.md`, `MIGRATION_SUMMARY.md`.

## 📚 Дополнительные ресурсы

- **Основной модуль**: `apps/web/src/lib/log.ts`
- **Утилиты маскирования**: `apps/web/src/lib/logSafe.ts`
- **Безопасность логирования**: `apps/web/src/lib/LOGGING_SECURITY.md`

## ✅ Чеклист для разработчиков

Перед коммитом убедитесь:

- [ ] Нет прямых `console.log/warn/info/debug` в коде (кроме разрешенных файлов)
- [ ] Используются `logDebug`, `logWarn`, `logError` из `@/lib/log`
- [ ] Указан осмысленный `scope` для каждого лога
- [ ] Чувствительные данные не передаются напрямую (они маскируются автоматически, но лучше не передавать)
- [ ] Локально запущен `pnpm lint` и нет ошибок

## 🚨 Что делать, если сборка падает из-за console.*

1. Найдите проблемный файл в ошибке ESLint
2. Замените `console.log` → `logDebug`, `console.warn` → `logWarn`, `console.error` → `logError`
3. Добавьте импорт: `import { logDebug, logWarn, logError } from '@/lib/log';`
4. Добавьте осмысленный `scope` в качестве первого параметра
5. Запустите `pnpm lint` локально для проверки

## 📞 Вопросы?

Если у вас есть вопросы по политике логирования, обратитесь к этому документу и к `LOGGING_SECURITY.md`; история миграции с console.log — в `docs/archive/`.

---

**Последнее обновление**: 2026-02-18  
**Статус**: ✅ Активно применяется, защищено ESLint и CI
