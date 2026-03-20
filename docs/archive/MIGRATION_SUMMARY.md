# Резюме миграции `console.*` на безопасное логирование

> Статус: исторический снимок промежуточного этапа миграции. Не использовать как источник текущих цифр без перепроверки.

## ✅ Выполнено

1. **Добавлено ESLint правило** - защита от бесконтрольного использования `console.log/warn/info/debug` в обычном приложенческом коде
2. **Мигрированы критичные API routes:**
   - ✅ `apps/web/src/app/api/staff/shift/today/route.ts` - 7 замен
   - ✅ `apps/web/src/app/api/auth/yandex/callback/route.ts` - 18 замен
3. **Мигрированы хуки:**
   - ✅ `apps/web/src/app/staff/finance/hooks/useShiftItems.ts` - 2 замены
4. **Созданы инструменты:**
   - ✅ Скрипт проверки: `scripts/check-console-logs.sh`
   - ✅ Документация прогресса: `apps/web/src/lib/CONSOLE_LOG_MIGRATION_PROGRESS.md`

## 📊 Историческая статистика

- **Всего заменено:** ~27 использований console.*
- **Осталось мигрировать:** ~312 использований (по оценке)

Эти числа относятся к промежуточному этапу миграции и уже не отражают текущее состояние репозитория.

Актуальный контекст теперь такой:

- проблема в основном локализована;
- прямые `console.*` больше не размазаны по большому числу feature/API файлов;
- оставшиеся вызовы в основном сосредоточены в лог-утилитах, dev-only инструментах, observability и части infra.

См.:

- `apps/web/src/lib/LOGGING_POLICY.md`
- `docs/CONSOLE_USAGE_AUDIT.md`

## 🔄 Следующие шаги на тот момент

### Приоритет 1: API Routes (осталось ~12 файлов)
- `apps/web/src/app/api/staff/create/route.ts`
- `apps/web/src/app/api/staff/create-from-user/route.ts`
- `apps/web/src/app/api/staff/avatar/upload/route.ts`
- `apps/web/src/app/api/staff/[id]/update/route.ts`
- `apps/web/src/app/api/auth/whatsapp/*`
- `apps/web/src/app/api/whatsapp/*`

### Приоритет 2: Критичные компоненты
- Client components с логированием
- Server components с логированием

### Приоритет 3: Утилиты и библиотеки
- `apps/web/src/lib/*`
- `apps/web/src/components/*`

## 🛠️ Инструменты

### Проверка прогресса
```bash
bash scripts/check-console-logs.sh
```

### Ручная замена
1. Найдите `console.log/warn/error`
2. Замените на `logDebug/logWarn/logError` из `@/lib/log`
3. Добавьте осмысленный scope

## 📝 Примеры замены

### console.log → logDebug
```typescript
// ❌ Было:
console.log('Debug info', data);

// ✅ Стало:
import { logDebug } from '@/lib/log';
logDebug('MyScope', 'Debug info', data);
```

### console.warn → logWarn
```typescript
// ❌ Было:
console.warn('Warning message');

// ✅ Стало:
import { logWarn } from '@/lib/log';
logWarn('MyScope', 'Warning message');
```

### console.error → logError
```typescript
// ❌ Было:
console.error('Error:', error);

// ✅ Стало:
import { logError } from '@/lib/log';
logError('MyScope', 'Error occurred', error);
```

## 🎯 Преимущества

1. ✅ **Автоматическое маскирование** чувствительных данных
2. ✅ **Контроль уровня логирования** - debug только в dev
3. ✅ **Единый формат** - структурированные логи
4. ✅ **Готовность к мониторингу** - легко интегрировать с Sentry/LogRocket

---

## Что считать актуальным сейчас

- Политика логирования и список разрешённых исключений: `apps/web/src/lib/LOGGING_POLICY.md`
- Актуальный аудит прямых `console.*`: `docs/CONSOLE_USAGE_AUDIT.md`
- Общий обзор проекта: `PROJECT_REVIEW.md`

