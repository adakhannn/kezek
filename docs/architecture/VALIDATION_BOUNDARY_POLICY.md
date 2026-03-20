# Граница между boundary и domain валидацией

**Дата:** 2026-03-19  
**Цель:** зафиксировать, где в проекте должна жить Zod-валидация входа, а где доменная проверка инвариантов.

---

## Короткое правило

**API boundary валидирует форму payload.**  
**Domain layer валидирует смысл и инварианты.**

Это означает:

- Zod на boundary отвечает за shape, типы и базовый формат данных;
- `packages/core-domain` отвечает за бизнес-смысл, допустимые комбинации и предметные ограничения;
- один и тот же инвариант не должен независимо жить и в Zod-схеме, и в domain helper, если это не осознанная временная совместимость.

---

## Что относится к boundary validation

Boundary validation живёт в `apps/web/src/lib/validation/*` и вызывается из route handlers.

Типичные задачи boundary-слоя:

- проверить, что `body` вообще является объектом;
- проверить обязательность полей на уровне HTTP-контракта;
- проверить типы: `string`, `number`, `boolean`, `array`, `object`;
- проверить формат:
  - `uuid`
  - `email`
  - `E.164 phone`
  - `ISO datetime`
  - `YYYY-MM-DD`
  - enum/query schema
- отсечь заведомо невалидный payload до входа в use case;
- нормализовать простые значения, если это часть boundary-контракта.

Примеры:

- [schemas.ts](C:\projects\kezek\apps\web\src\lib\validation\schemas.ts)
- [bookingSchemas.ts](C:\projects\kezek\apps\web\src\lib\validation\bookingSchemas.ts)
- [apiValidation.ts](C:\projects\kezek\apps\web\src\lib\validation\apiValidation.ts)

---

## Что относится к domain validation

Domain validation живёт в `packages/core-domain/*`.

Типичные задачи domain-слоя:

- проверить, допустим ли филиал для бронирования;
- проверить, допустим ли переход статуса;
- проверить, можно ли отменять/подтверждать/помечать посещение;
- проверить инварианты promotion semantics;
- проверить, какие статусы считаются active/past/cancelable;
- проверить предметные ограничения, которые должны одинаково работать в web/mobile/API.

Примеры:

- [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts)
- [statusTransitions.ts](C:\projects\kezek\packages\core-domain\src\booking\statusTransitions.ts)
- [dashboardFilters.ts](C:\projects\kezek\packages\core-domain\src\booking\dashboardFilters.ts)
- [clientSemantics.ts](C:\projects\kezek\packages\core-domain\src\booking\clientSemantics.ts)

---

## Разделение по ответственности

### Boundary спрашивает

- payload имеет правильную структуру?
- поле присутствует?
- строка похожа на UUID / email / дату?
- query/body соответствует контракту endpoint?

### Domain спрашивает

- payload имеет бизнес-смысл?
- допустима ли комбинация полей?
- не нарушен ли инвариант предметной области?
- одинаково ли должно это правило работать в web/mobile/API?

---

## Практическое правило для route handler

Правильная последовательность:

1. `validateRequest` / `validateQuery` + Zod schema
2. нормализованные данные передаются в domain helper / use case
3. domain layer проверяет инварианты
4. route преобразует результат в HTTP response

---

## Анти-паттерны

- дублировать одну и ту же бизнес-проверку и в Zod, и в `core-domain`;
- держать правила статусов или transition matrix внутри route/UI;
- валидировать business semantics только на уровне React screen;
- использовать `core-domain` для проверки чисто HTTP-форматных вещей вроде query-string shape.

---

## Временные исключения

Сейчас в проекте ещё есть переходные зоны, где `packages/core-domain/src/booking/validation.ts` частично повторяет boundary-проверки.

Это допустимо как переходное состояние, если:

- правило ещё не вынесено окончательно;
- нам нужна обратная совместимость со старым вызовом;
- есть явный план потом убрать дублирование.

Следующий шаг после этой политики:

- пройтись по кейсам дублирования между [schemas.ts](C:\projects\kezek\apps\web\src\lib\validation\schemas.ts) и [validation.ts](C:\projects\kezek\packages\core-domain\src\booking\validation.ts);
- оставить в domain только инварианты и смысловые проверки.
