# Schedule Domain Module

Доменный модуль для работы с расписаниями и слотами.  
Содержит чистые функции без зависимостей от HTTP-слоя или Supabase-клиента.

> Основной расчёт свободных слотов (`get_free_slots_service_day_v2`) выполняется на стороне БД (SQL/RPC).  
> Этот модуль отвечает за пост‑обработку результатов и учёт временных переводов на фронтенде.

---

## Структура

- **`types.ts`** — типы для слотов, временных переводов и контекста фильтрации
- **`helpers.ts`** — чистые функции:
  - `resolveScheduleContext` — определение контекста расписания (временный перевод, целевой филиал)
  - `filterSlotsByContext` — фильтрация слотов по мастеру, филиалу и минимальному времени
- **`index.ts`** — публичный API модуля

---

## Использование

### Импорт

```ts
import {
  type RawSlot,
  type Slot,
  type TemporaryTransfer,
  type StaffInfo,
  type ScheduleContext,
  type SlotFilterContext,
  resolveScheduleContext,
  filterSlotsByContext,
} from '@core-domain/schedule';
```

### Пример: учёт временного перевода и фильтрация слотов

```ts
const scheduleCtx = resolveScheduleContext({
  staffId,
  dayStr,
  selectedBranchId: branchId,
  temporaryTransfers,
  staff,
});

const filteredSlots = filterSlotsByContext(allSlotsFromRpc, {
  staffId,
  branchId,
  targetBranchId: scheduleCtx.targetBranchId,
  isTemporaryTransfer: scheduleCtx.isTemporaryTransfer,
  minStart: new Date(Date.now() + 30 * 60 * 1000), // минимум через 30 минут
});
```

---

## Принципы

1. **Чистые функции** — модуль не делает сетевых запросов, не логирует и не работает с React.
2. **Повторное использование** — общая логика фильтрации слотов и учёта временных переводов используется:
   - в публичном потоке бронирования (`useSlotsLoader`);
   - на странице свободных слотов сотрудника в дашборде.
3. **Чёткий контракт** — вся завязанная на Supabase/HTTP логика остаётся в `apps/web`, а модуль оперирует только данными (массивы слотов, переводы, сотрудники).

---

## Интеграция с текущим кодом

Модуль подключён через TS path `@core-domain/*` и используется в:

- `apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts` — загрузка слотов для публичного бронирования;
- `apps/web/src/app/dashboard/staff/[id]/slots/Client.tsx` — отображение свободных слотов по сотруднику.

---

## Расширение

При изменении формата RPC или добавлении новой логики слотов:

1. Обновите тип `RawSlot` в `types.ts`, если структура результата RPC изменилась.
2. При необходимости адаптируйте `filterSlotsByContext` (например, учёт дополнительных статусов).
3. Если появятся новые сценарии (другие виды временных переводов/правил), добавьте отдельные функции‑помощники, не смешивая их с HTTP/RPC-кодом.


