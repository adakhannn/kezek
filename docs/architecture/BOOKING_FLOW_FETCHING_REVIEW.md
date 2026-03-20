# Booking Flow Fetching Review

**Дата проверки:** 2026-03-19  
**Источник правды:** CLIENT_DATA_FETCHING_STANDARD.md и booking-flow hooks/components  
**Когда пересматривать:** при следующем пересмотре useSlotsLoader или query-layer migration


**Статус:** актуален  
**Цель:** зафиксировать разбор `apps/web/src/app/b/[slug]/hooks/useSlotsLoader.ts` по слоям ответственности и обозначить следующий шаг миграции.

---

## 1. Что сейчас делает `useSlotsLoader`

Внутри одного hook сейчас смешаны четыре разных типа логики:

- `fetch`
  - RPC `get_free_slots_service_day_v2`
  - проверка schedule rule для временного перевода
- `cache`
  - локальный `Map` с TTL
  - debounce
  - cleanup interval
- `post-processing`
  - преобразование ошибок RPC в user-facing сообщения
  - сортировка слотов
- `domain filtering`
  - `resolveScheduleContext`
  - фильтрация по branch/staff/temporary transfer/min start

---

## 2. Что уже вынесено

В этой волне из `useSlotsLoader.ts` вынесены переиспользуемые части:

- `buildSlotsCacheKey`
- `mapSlotsRpcErrorToMessage`
- `filterAndSortVisibleSlots`

Файл:

- `apps/web/src/app/b/[slug]/hooks/slotsLoaderHelpers.ts`

Это не переводит загрузку слотов на query layer, но делает `useSlotsLoader` ближе к orchestration-уровню и убирает часть смешения ответственности.

---

## 3. Что остаётся внутри `useSlotsLoader`

Пока внутри hook остаются:

- cache lifecycle
- debounce orchestration
- сам RPC/fetch слой
- runtime logging
- временная проверка schedule rule для transfer case

Это нормально как промежуточное состояние, потому что именно эти части сильнее всего завязаны на текущий hot-path UX.

---

## 4. Решение по query layer

На текущем этапе принято решение **не переводить `useSlotsLoader` на `React Query` прямо сейчас**.

Статус решения:

- `useSlotsLoader` остаётся специальным исключением;
- `React Query` остаётся общим стандартом проекта;
- сам `useSlotsLoader` не считается шаблоном для нового кода.

Почему решение именно такое:

- сценарий чувствителен к latency и частым переключениям параметров;
- в нём уже есть короткоживущий cache, debounce и защита от лишних повторных запросов;
- сначала выгоднее было разделить post-processing и domain filtering, чем сразу менять весь механизм загрузки;
- мгновенная миграция на query layer сейчас дала бы высокий риск усложнить hot-path без гарантированного выигрыша.

Что считаем обязательным инвариантом для этого исключения:

- cache policy должна оставаться локальной и явно ограниченной по TTL/size;
- invalidation должен быть контролируемым через параметры сценария и `slotsRefreshKey`;
- логика вне fetch/cache не должна снова разрастаться внутрь hook;
- новый booking code не должен копировать этот паттерн по умолчанию.

Когда решение нужно пересмотреть:

- если `fetch` будет полностью отделён от cache policy;
- если появится понятная query-key модель без регресса по UX;
- если мы захотим разделить prefetch/background refresh и hot-path selection state;
- если special-case станет дороже в поддержке, чем controlled migration на query abstraction.

Практический вывод:

- в этой волне `useSlotsLoader` остаётся special-case;
- следующими кандидатами на реальную query-миграцию должны быть не он, а менее чувствительные search/list flows вроде `useQuickDeskClient.ts`.
