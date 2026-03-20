# Аудит границ `core-domain`

**Дата проверки:** 2026-03-19  
**Источник правды:** PROJECT_DOCUMENTATION.md, packages/core-domain/* и текущий app-layer code  
**Когда пересматривать:** после каждого заметного переноса правил из apps/* в core-domain


**Дата:** 2026-03-19  
**Цель:** определить, какие бизнес-правила всё ещё живут в `apps/web` и `apps/mobile`, хотя по смыслу должны жить в `packages/core-domain`.

---

## Короткий вывод

Сейчас `packages/core-domain` уже покрывает часть доменной логики для:

- booking;
- schedule.

Но граница ещё неполная. Наиболее заметные бизнес-правила всё ещё живут в app-слоях:

- часть booking availability и schedule-transfer логики;
- часть booking timeline semantics;
- отдельные мобильные правила вокруг offline booking/shift flows.

Обновление на 2026-03-19:

- `booking` dashboard filter/status semantics уже перенесены в `packages/core-domain/src/booking/dashboardFilters.ts`;
- finance / shift compensation rules уже перенесены в `packages/core-domain/src/finance/*`;
- в `apps/web` для этих зон оставлен совместимый re-export слой, чтобы не ломать текущие импорты.

Главная проблема не в том, что логика “нечистая”, а в том, что она уже:

- используется в нескольких местах;
- влияет на поведение системы, а не только на UI;
- может расходиться между web/mobile/API при дальнейших изменениях.

---

## Что уже находится в `packages/core-domain`

### Booking

В `packages/core-domain/src/booking` уже есть:

- use cases для создания/подтверждения/отмены бронирования;
- правила выбора активного филиала;
- status transitions и attendance decision;
- часть валидации booking/promotion payload.

Ключевые файлы:

- [useCases.ts](C:\projects\kezek\packages\core-domain\src\booking\useCases.ts)
- [statusTransitions.ts](C:\projects\kezek\packages\core-domain\src\booking\statusTransitions.ts)
- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)

### Schedule

В `packages/core-domain/src/schedule` уже есть:

- `resolveScheduleContext`;
- `filterSlotsByContext`;
- `filterServicesForStaff`.

Ключевой файл:

- [helpers.ts](C:\projects\kezek\packages\core-domain\src\schedule\helpers.ts)

Это хороший фундамент: booking и schedule уже начали переходить от app-логики к доменной.

---

## Бизнес-правила, которые ещё живут в `apps/web`

### 1. Finance / shift compensation rules

Статус: перенесено в `packages/core-domain/src/finance`, в `apps/web/src/lib/financeDomain/*` оставлен совместимый слой реэкспортов.

Где сейчас живут:

- [index.ts](C:\projects\kezek\apps\web\src\lib\financeDomain\index.ts)
- [shares.ts](C:\projects\kezek\apps\web\src\lib\financeDomain\shares.ts)
- [guarantee.ts](C:\projects\kezek\apps\web\src\lib\financeDomain\guarantee.ts)
- [useShiftCalculations.ts](C:\projects\kezek\apps\web\src\app\staff\finance\hooks\useShiftCalculations.ts)

Что здесь доменное:

- нормализация процентов мастера/салона;
- правило “расходники всегда идут бизнесу”;
- расчёт базовых долей;
- расчёт гарантированной суммы;
- расчёт доплаты при гарантии;
- финальные display shares для открытой/закрытой смены.

Почему это должно жить в `core-domain`:

- это не UI-правила и не web-specific логика;
- эти расчёты уже описаны как “единый доменный слой”, но физически находятся в `apps/web`;
- mobile и API тоже зависят от тех же инвариантов.

Решение:

- вынести finance domain из `apps/web/src/lib/financeDomain` в `packages/core-domain/src/finance`.

Результат:

- выполнено;
- ключевые runtime-импорты уже переведены на `@core-domain/finance`;
- legacy-импорты продолжают работать через совместимый re-export слой.

Приоритет:

- **закрыто в первой волне миграции**.

### 2. Booking status filtering semantics

Статус: частично перенесено. Dashboard filter/status semantics уже вынесены в `packages/core-domain/src/booking/dashboardFilters.ts`, но timeline и смежные mobile/client rules ещё остаются в app-слоях.

Где сейчас живёт:

- [dashboardBookingsLogic.ts](C:\projects\kezek\apps\web\src\lib\dashboardBookingsLogic.ts)

Что здесь доменное:

- какие статусы считаются “active”;
- что входит в `holdConfirmed`;
- что значит `all` для списка бронирований;
- как пресеты отражают смысловые группы статусов.

Почему это должно жить в `core-domain`:

- это уже не просто формат UI-фильтра, а semantic grouping booking statuses;
- такие правила легко начинают расходиться между dashboard, mobile cabinet и будущими отчётами.

Решение:

- вынести статусные группы и функции-предикаты в `packages/core-domain/src/booking`.

Результат:

- базовые dashboard status predicates и preset filters уже перенесены;
- оставшийся хвост здесь теперь связан не с фильтрами, а с timeline/cancelability semantics.

Приоритет:

- **частично закрыто, продолжить следующей волной**.

### 3. Часть schedule / booking availability rules

Статус: частично перенесено. Правило доступности мастеров по филиалу и временным переводам уже вынесено в `packages/core-domain/src/schedule/availability.ts`, но slot loading orchestration и часть availability-логики всё ещё живут в app-слое.

Где сейчас живут:

- [useBookingAvailability.ts](C:\projects\kezek\apps\web\src\app\b\[slug]\hooks\useBookingAvailability.ts)
- [useSlotsLoader.ts](C:\projects\kezek\apps\web\src\app\b\[slug]\hooks\useSlotsLoader.ts)

Что здесь доменное:

- правила доступности мастера в филиале на день;
- учёт временных переводов;
- выбор staff/service с учётом transfer context;
- проверка наличия расписания для временно переведённого мастера;
- правила показа/отсечения слотов на основе schedule context.

Что уже перенесено:

- `resolveScheduleContext`
- `filterSlotsByContext`
- `filterServicesForStaff`
- `filterStaffByBookingAvailability`

Что ещё осталось в apps:

- orchestration вокруг schedule availability всё ещё частично знает доменные правила;
- в `useSlotsLoader.ts` остаётся логика о том, что считать валидным расписанием и как трактовать отсутствие schedule в контексте перевода;
- в `useBookingAvailability.ts` ещё остаются app-level derivations вроде service fallback/resolution, но правило выбора доступных мастеров уже вынесено в доменный слой.

Решение:

- продолжить перенос schedule/availability правил в `packages/core-domain/src/schedule`;
- оставить в hooks только orchestration и data loading.

Приоритет:

- **высокий**.

### 4. Часть promotion / booking validation semantics

Где сейчас живёт:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)
- одновременно используются web boundary schemas и app-specific flows в `apps/web`.

Проблема:

- часть promotion/booking validation уже в `core-domain`, но граница между boundary validation и domain invariants ещё не до конца чистая;
- из-за этого часть правил может дублироваться между Zod-схемами и доменными проверками.

Решение:

- не “переносить из apps в core-domain” как отдельный новый кусок, а дочистить границу:
  - формат и shape payload оставить на boundary;
  - смысловые инварианты закрепить в `core-domain`.

Приоритет:

- **средний**.

---

## Бизнес-правила, которые ещё живут в `apps/mobile`

### 1. Booking status semantics в client flows

Где сейчас живут:

- [HomeScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\HomeScreen.tsx)
- [CabinetScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\CabinetScreen.tsx)
- [BookingDetailsScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\BookingDetailsScreen.tsx)

Что здесь доменное:

- какие статусы считать активными/предстоящими;
- какие считать прошедшими;
- когда запись доступна для отмены;
- как строится timeline бронирования по статусу.

Примеры:

- в `HomeScreen.tsx` upcoming bookings исключают `cancelled` и `no_show`;
- в `CabinetScreen.tsx` active/past logic определяется напрямую в экране;
- в `BookingDetailsScreen.tsx` `canCancel` и timeline steps зависят от статуса.

Почему это должно жить в `core-domain`:

- это единая предметная логика клиента по бронированиям;
- она уже начинает расползаться по нескольким экранам;
- часть этих правил должна совпадать с web interpretation статусов.

Решение:

- вынести booking status predicates и timeline/status grouping rules в `packages/core-domain/src/booking`.

Приоритет:

- **высокий**.

### 2. Shift / finance rules в mobile shift screens

Где сейчас живут:

- [ShiftQuickScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\ShiftQuickScreen.tsx)
- [ShiftsScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\ShiftsScreen.tsx)

Что здесь доменное:

- интерпретация состояния смены;
- условия around guaranteed payment;
- business meaning полей `master_share`, `salon_share`, `hourly_rate`, `guaranteed_amount`;
- отдельные решения вроде `isDayOff` как фактора доступности shift actions.

Почему это должно жить в `core-domain`:

- mobile screen не должен быть носителем shift semantics;
- эти правила тесно связаны с тем же finance domain, который уже живёт в `apps/web`.

Решение:

- после появления `packages/core-domain/src/finance` перевести mobile shift screens на shared finance/shift rules.

Приоритет:

- **очень высокий**.

### 3. Offline booking/shift semantics

Где сейчас живут:

- [ShiftQuickScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\ShiftQuickScreen.tsx)
- [CabinetScreen.tsx](C:\projects\kezek\apps\mobile\src\screens\CabinetScreen.tsx)
- [offlineBookingsStorage.ts](C:\projects\kezek\apps\mobile\src\lib\offlineBookingsStorage.ts)

Что здесь доменное, а что нет:

- offline queue/storage сами по себе — не domain, а application/infra;
- но типы допустимых booking statuses и смысл client-visible transitions внутри offline layer уже пересекаются с доменом.

Решение:

- infra/offline storage оставить в mobile;
- статусы и rules интерпретации подтянуть из `core-domain`.

Приоритет:

- **средний**.

---

## Что пока можно оставить вне `core-domain`

Не всё, что “умное”, обязано переезжать в доменный пакет.

Можно оставить в `apps/*`:

- чисто UI-derived presentation state;
- analytics side effects;
- cache/prefetch/offline queue orchestration;
- navigation-specific правила;
- boundary-level fetch/query composition.

Критерий для переноса в `core-domain`:

- правило влияет на смысл предметной области, а не только на отображение;
- правило нужно более чем в одном app/flow;
- правило должно быть одинаковым в web/mobile/API.

---

## Приоритет переноса по волнам

### Волна 1

1. finance domain из `apps/web/src/lib/financeDomain` в `packages/core-domain/src/finance`
2. booking status predicates / grouping rules
3. mobile shift screens на shared finance rules

### Волна 2

1. остаточная schedule/availability логика из booking hooks
2. booking timeline / cancelability rules для mobile client flows

### Волна 3

1. дочистка границы validation между boundary и domain
2. унификация offline booking semantics вокруг shared status rules

---

## Практический вывод

Сейчас главные “утечки домена” из `core-domain` находятся не в случайных местах, а в трёх предсказуемых зонах:

- finance / shift compensation;
- booking status semantics;
- остаточные schedule availability rules.

Это хороший знак: перенос можно делать не хаотично, а понятными блоками. Самый важный следующий шаг здесь — вынести finance domain в `packages/core-domain`, потому что именно он уже фактически существует как доменный слой, но всё ещё живёт внутри `apps/web`.
