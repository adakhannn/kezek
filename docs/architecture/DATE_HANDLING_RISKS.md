# Риски обработки дат (valid_from / valid_to и др.)

## Задача

Зафиксировать места с `toISOString().split('T')[0]` (и эквивалентами) для дат и риски по таймзонам (±1 день).

---

## 1. valid_from / valid_to (акции филиалов)

### Места в коде

| Файл | Строки | Что делается |
|------|--------|--------------|
| `apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts` | 147–148 | При создании акции: `valid_from` / `valid_to` из body преобразуются в YYYY-MM-DD через `new Date(valid_from).toISOString().split('T')[0]`. |
| `apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts` | 81–82 | При обновлении акции: то же преобразование для `body.valid_from` и `body.valid_to`. |

### Откуда приходят значения

- Форма в `BranchPromotionsPanel.tsx`: `<input type="date">` → `e.target.value` всегда строка **YYYY-MM-DD** (дата в локальной зоне пользователя, без времени).

### Риск по таймзонам

- Если с фронта **всегда** приходит только **YYYY-MM-DD** (как сейчас с `type="date"`), то:
  - `new Date("2025-03-05")` в JS трактуется как **полночь UTC** (по спецификации для date-only ISO).
  - `toISOString()` даёт `"2025-03-05T00:00:00.000Z"` → `split('T')[0]` = `"2025-03-05"` — день сохраняется корректно.
- Риск **появляется**, если:
  - В API начнут передавать дату-время без суффикса (например `"2025-03-05T00:00:00"`): парсинг тогда зависит от окружения (часто локальная зона), и `toISOString().split('T')[0]` может дать **соседний день** (UTC).
  - Или если дата будет собираться на сервере как «сегодня» через `new Date()` (см. п. 2).

**Рекомендация:** для приёма дат акций считать контракт «только YYYY-MM-DD»; при появлении формата с временем — парсить в целевой таймзон (или хранить даты без времени и не использовать `toISOString().split('T')[0]` для произвольных datetime).

---

## 2. Другие места с toISOString().slice(0, 10) / split('T')[0]

### Аналитика (диапазоны дат)

**Обновлено:** аналитика и cron переведены на общую модель дат (`todayDateString`, `addDaysToDateString`, `dateRangeInclusive`, `fromZonedTime` из `lib/time.ts`, эталонная таймзона `getTimezone()` — Asia/Bishkek). Дефолтные периоды и «вчера» считаются в этой таймзоне; при явной передаче `startDate`/`endDate` (YYYY-MM-DD) используются как есть.

| Файл | Статус |
|------|--------|
| `apps/web/src/app/api/dashboard/analytics/overview/route.ts`, `load/route.ts` | Используют `todayDateString`, `addDaysToDateString` |
| `apps/web/src/app/admin/api/analytics/*` (overview, load, promotions, conversion-funnel) | То же; conversion-funnel — границы дня в TZ через `fromZonedTime` |
| `apps/web/src/app/admin/api/system-analytics/overview/route.ts` | То же |
| `apps/web/src/app/api/cron/analytics/daily/route.ts`, `hourly-load/route.ts` | «Вчера» и диапазон через `dateRangeInclusive`/TZ; границы дня в `recalcForDate`/`recalcHourlyForDate` — `fromZonedTime` |
| `apps/web/src/app/api/cron/recalculate-ratings/route.ts` | Дата для лога — `addDaysToDateString(todayDateString(), -1)` |
| `apps/web/src/app/api/admin/initialize-ratings/route.ts` | Диапазон из body — только валидация YYYY-MM-DD, строки передаются в RPC как есть |
| `apps/web/src/app/api/admin/ratings/debug-entities/route.ts` | Окно «последние N дней» — `addDaysToDateString(todayDateString(), -days)` |
| Страницы аналитики (dashboard/analytics, admin/analytics/*, system) | Дефолтные даты и пресеты — `todayDateString()`, `addDaysToDateString()` на клиенте |

### «Сегодня» на сервере

Все перечисленные ранее места переведены на `todayDateString()` (эталонная таймзона через `getTimezone()`). В том числе:

- `apps/web/src/app/api/staff/[id]/update/route.ts` — при смене филиала сотрудника используется `const today = todayDateString()` для `valid_from`/`valid_to` в `staff_branch_assignments`.

### Нормализация уже пришедшей даты (без смены дня)

Используется только обрезка до даты от уже сохранённого значения (без перевода «сейчас» в дату), риск сдвига дня ниже, но формат должен быть согласован:

| Файл | Строки |
|------|--------|
| `apps/web/src/app/staff/finance/services/shiftDataService.ts` | 438 |
| `apps/web/src/app/staff/finance/hooks/useShiftStats.ts` | 49 |
| `apps/web/src/app/api/staff/shift/today/route.ts` | 206 |

### E2E-тесты

Используют `toISOString().split('T')[0]` для выбора «завтра»/«вчера» в календаре — зависимость от локальной зоны машины, где запускаются тесты (при необходимости стабилизировать через фиксированную зону или mock даты).

---

## 3. Где уже учтена таймзона

Для «сегодня» и дат в зоне пользователя в коде используется `formatInTimeZone(..., TZ, 'yyyy-MM-dd')` или `todayDateString()` (эталонная таймзона через `getTimezone()`), что избегает сдвига на день:

- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
- `apps/web/src/app/api/dashboard/staff-shifts/...`
- `apps/web/src/app/api/staff/[id]/update/route.ts` — при смене филиала сотрудника (`valid_from`/`valid_to` в assignments)
- `apps/web/src/app/api/staff/shift/close/route.ts`
- `apps/web/src/lib/time.ts`, `staffSchedule.ts`, `dateFormat.ts`
- и другие модули, работающие с датами смен и отчётов.

---

## 4. Краткие выводы

- **valid_from / valid_to (акции):** при текущем контракте «только YYYY-MM-DD» с фронта риск ±1 день **низкий**; риск возрастает при появлении формата с временем или при формировании даты на сервере через `new Date()`.
- **Аналитика и крон:** переведены на общую модель дат (см. [DATE_HANDLING_MODEL.md](DATE_HANDLING_MODEL.md)): эталонная таймзона `getTimezone()`, `todayDateString`, `addDaysToDateString`, `dateRangeInclusive`, границы дня через `fromZonedTime` где нужен диапазон по `created_at`/timestamp.
- **Серверное «сегодня»:** в `api/staff/[id]/update/route.ts` и остальных критичных местах используется `todayDateString()` (эталонная таймзона).
- **Рекомендация:** для новых мест использовать целевую модель из DATE_HANDLING_MODEL.md; при приёме valid_from/valid_to сохранять строку YYYY-MM-DD как есть или парсить явно без перевода в UTC-полночь и обратно.

---

## 5. Что уже снято в последних волнах

Риски ниже уже не являются приоритетными источниками скрытых timezone-багов:

- `apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts`
- `apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts`
- `apps/web/src/app/api/dashboard/staff/finance/all/route.ts`
- `apps/web/src/app/api/staff/finance/route.ts`
- `apps/web/src/app/api/staff/shift/open/route.ts`
- `apps/web/src/app/api/staff/shift/close/route.ts`
- `apps/web/src/app/api/staff/shift/today/route.ts`
- `apps/web/src/app/api/staff/shift/items/shiftItemsShiftResolver.ts`
- `apps/web/src/app/cabinet/bookings/page.tsx`
- `apps/web/src/app/cabinet/components/BookingCard.tsx`
- `apps/web/src/app/dashboard/bookings/components/BookingsList.tsx`

Почему:

- manager/staff context теперь поднимают `businessTz`;
- day-based `shift` / `finance` сценарии больше не должны опираться на глобальный `TZ`, если бизнес уже известен;
- `cabinet` больше не делит `upcoming/past` через глобальную timezone, если timezone бизнеса записи доступна.

---

## 6. Оставшиеся приоритетные риски

После текущей волны главный residual risk сместился сюда:

- `apps/web/src/app/dashboard/staff/[id]/schedule/Client.tsx`
- `apps/web/src/app/staff/finance/**/*`
- `apps/web/src/lib/staffSchedule.ts`
- `apps/web/src/app/api/webhooks/whatsapp/route.ts`
- mobile booking / cabinet сценарии

То есть самые дорогие серверные timezone-ошибки уже в основном сняты, а следующий фокус теперь на `schedule`, legacy UI и mobile.
