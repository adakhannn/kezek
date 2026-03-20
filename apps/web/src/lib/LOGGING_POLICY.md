# Политика логирования в проекте Kezek

## 🎯 Цель

Обеспечить безопасное, контролируемое и структурированное логирование во всем приложении, предотвращая утечки чувствительных данных и проблемы с производительностью.

## 📋 Правила

### ✅ Обязательные правила

1. **Не используйте `console.log`, `console.warn`, `console.info`, `console.debug` напрямую в обычном приложенческом коде**
   - По умолчанию любой новый прямой `console.*` в feature/UI/API-коде считается нарушением
   - ESLint правило `no-console` и CI должны ловить такие случаи
   - Исключения допускаются только для явно перечисленных технических зон, см. раздел `Разрешенные исключения`

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
// ❌ НЕ ДЕЛАЙТЕ ТАК в feature/UI/API-коде
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

Разрешенные исключения должны оставаться редкими и технически обоснованными. Они не означают, что `console.*` можно свободно использовать в новом коде.

#### 1. Лог-утилиты и shared logger abstractions

Разрешено:

- `apps/web/src/lib/logSafe.ts`
- `packages/shared-client/src/log.ts`

Причина:

- это сами реализации логгеров и safe/fallback-оберток;
- здесь прямой `console.*` является частью инфраструктурного слоя.

#### 2. Dev-only debugging инструменты

Разрешено:

- `apps/web/src/hooks/useWhyDidYouRender.ts`
- `apps/web/src/hooks/useRenderCount.ts`
- dev-only ветки в `apps/web/src/lib/apiLogger.ts`
- dev-only ветки в `apps/web/src/lib/webVitals.ts`

Причина:

- эти модули используются только для локальной отладки и анализа в development.

#### 3. Observability / performance fallback

Временно допустимо:

- `apps/web/src/lib/webVitals.ts`
- `apps/web/src/lib/apiLogger.ts`
- `apps/web/src/lib/apiMetrics.ts`
- `apps/web/src/lib/funnelEvents.ts`

Причина:

- это технические observability-модули, где прямой `console.*` используется как fallback или dev/diagnostic output.

Ограничение:

- при доработке этих файлов нужно по возможности переходить на централизованный logger;
- не копировать этот паттерн в обычный feature-код.

#### 4. Инфраструктурные интеграции

Временно допустимо:

- `apps/web/src/lib/senders/whatsapp.ts`

Причина:

- сейчас там используется локальная safe-обертка для интеграционного логирования;
- в будущем файл желательно выровнять под единый logger API/infrastructure уровня.

#### Главное правило

Если файл не входит в список выше, прямой `console.*` в нем считается нарушением и должен быть заменен на `logDebug`, `logWarn`, `logError` или другой одобренный abstraction layer.

## 📚 Дополнительные ресурсы

- **Основной модуль**: `apps/web/src/lib/log.ts`
- **Утилиты маскирования**: `apps/web/src/lib/logSafe.ts`
- **Миграция**: `apps/web/src/lib/CONSOLE_LOG_MIGRATION.md`
- **Резюме миграции**: `docs/archive/MIGRATION_SUMMARY.md`

## ✅ Чеклист для разработчиков

Перед коммитом убедитесь:

- [ ] Нет новых прямых `console.log/warn/info/debug` в коде вне разрешенных исключений
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

Если у вас есть вопросы по политике логирования, обратитесь к:
- Документации: `apps/web/src/lib/CONSOLE_LOG_MIGRATION.md`
- Техническому лиду проекта

---

**Последнее обновление**: 2026-03-18  
**Статус**: ✅ Активно применяется, защищено ESLint и CI
