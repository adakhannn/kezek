# Задачи по улучшению раздела финансов

Документ содержит список задач по доработке раздела финансов (смены, клиенты, статистика) на основе анализа кода и UX. Приоритет: **P0** — критично, **P1** — важно, **P2** — желательно, **P3** — улучшения.

---

## 1. Критичные исправления (P0)

### 1.1 Закрытие смены владельцем при просмотре смены сотрудника

**Проблема:** На странице `/dashboard/staff/[id]/finance` при открытой смене сотрудника владелец видит кнопку «Закрыть смену». При нажатии вызывается `POST /api/staff/shift/close`, который использует `getStaffContext()` — контекст **текущего** пользователя (владельца), а не сотрудника. В результате может закрыться не та смена (смена владельца, если он тоже в штате) или вернуться ошибка.

**Файлы:**  
- `apps/web/src/app/staff/finance/hooks/useFinanceMutations.ts` — `closeShift()` всегда вызывает `/api/staff/shift/close` без `staffId`.  
- `apps/web/src/app/api/staff/shift/close/route.ts` — принимает только тело запроса, не поддерживает закрытие смены «чужого» сотрудника.

**Варианты решения (выбрать один):**

- **A)** Скрыть кнопку «Закрыть смену» и «Переоткрыть» для владельца при просмотре смены сотрудника (`staffId` передан). В интерфейсе оставить только просмотр и добавление/редактирование клиентов; закрывать смену может только сам сотрудник в своём кабинете.
- **B)** Добавить API закрытия смены от имени менеджера: например, `POST /api/dashboard/staff/[id]/shift/close` с телом как в `closeShiftSchema` (items/totalAmount). В `useFinanceMutations.closeShift` при наличии `staffId` вызывать этот endpoint и передавать `staffId` в URL.

**Реализовано: вариант B** (API закрытия смены менеджером).

**Задачи:**

- [x] Выбрать и реализовать вариант A или B.
- [x] Если выбран B: добавлен `POST /api/dashboard/staff/[id]/shift/close?date=YYYY-MM-DD`; тело — `closeShiftSchema`; в роуте используется `withManagerContext` и проверка принадлежности сотрудника бизнесу; `staffId` берётся из URL, дата — из query.
- [x] Добавить/обновить тесты (e2e или API) на сценарий «владелец на странице финансов сотрудника» (API: `apps/web/src/__tests__/api/dashboard/staff/shift-close.test.ts`).

---

## 2. Консистентность и надёжность (P1)

### 2.1 Единая проверка принадлежности сотрудника бизнесу

**Проблема:** В `dashboard/staff/[id]/finance/page.tsx` используется нормализация `biz_id` через `String(...).trim()` и отдельная проверка на `null`. В `dashboard/staff/[id]/finance/stats/page.tsx` — просто `String(staff.biz_id) !== String(bizId)`. При граничных значениях (пробелы, null) поведение может различаться.

**Файлы:**  
- `apps/web/src/app/dashboard/staff/[id]/finance/page.tsx`  
- `apps/web/src/app/dashboard/staff/[id]/finance/stats/page.tsx`

**Задачи:**

- [x] Вынести проверку «staff принадлежит biz» в общий хелпер (`checkResourceBelongsToBiz` в `@/lib/dbHelpers`, нормализация `biz_id`: null-safe + trim).
- [x] Использовать этот хелпер в обоих page.tsx (finance и finance/stats), чтобы логика и нормализация были одинаковыми.

### 2.2 Обработка ошибок в stats/page.tsx

**Проблема:** В `stats/page.tsx` нет try/catch и нет логирования при ошибке `getBizContextForManagers()`. В `finance/page.tsx` ошибки логируются и пробрасываются для layout.

**Задачи:**

- [x] Добавить в `stats/page.tsx` обработку ошибок по аналогии с `finance/page.tsx`: try/catch, логирование (кроме NO_BIZ_ACCESS/UNAUTHORIZED), повторный throw для layout.

### 2.3 Обновление статистики без полной перезагрузки страницы

**Проблема:** В `StaffFinanceStats.tsx` после успешного «Исправить часы» вызывается `window.location.reload()`, из-за чего теряется состояние (скролл, раскрытые карточки, выбранный период/дата).

**Файл:** `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`

**Задачи:**

- [x] После успешного ответа `POST /api/dashboard/staff-shifts/${shift.id}/update-hours` вызывать `loadStats()` вместо `window.location.reload()`.
- [x] Перезапрашивать данные через `loadStats()` после успешного обновления часов.

---

## 3. API и валидация (P1)

### 3.1 Deprecated endpoint для данных смены

**Проблема:** Существует deprecated роут `GET /api/dashboard/staff/[id]/finance?date=...`, клиент использует `GET /api/staff/finance?staffId=...&date=...`. В коде есть ссылки на старый endpoint.

**Задачи:**

- [x] Убедиться, что ни один клиентский код не вызывает deprecated endpoint (в `apps/web/src` прямых вызовов `GET /api/dashboard/staff/[id]/finance` не найдено; остались только тесты и сам deprecated route). Зафиксировать использование только `/api/staff/finance?staffId=&date=`.

### 3.2 Валидация и типы для закрытия смены (при выборе варианта B в 1.1)

**Задачи:**

- [x] Если реализуется закрытие смены владельцем: описать в API документации, что `POST /api/dashboard/staff/[id]/shift/close` ожидает тело как у `closeShiftSchema` (добавлено в `apps/web/src/lib/API_ERROR_FORMATS.md`).
- [x] Проверить, что лимиты (например, max items в `closeShiftSchema`) и сообщения об ошибках валидации согласованы между фронтом и бэкендом (оба endpoint используют `validateRequest(..., closeShiftSchema)`).

---

## 4. UX и интерфейс (P2)

### 4.2 Редактирование часов в статистике: замена window.prompt

**Проблема:** «Исправить часы» в `StaffFinanceStats` использует `window.prompt`, что плохо смотрится и не подходит для мобильных устройств.

**Файл:** `apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceStats.tsx`

**Задачи:**

- [x] Заменить `window.prompt` на inline-редактирование в карточке смены: поле ввода + кнопки «Сохранить» / «Отмена».
- [x] Добавить валидацию (число, ≥ 0, разумный максимум часов) и отображение ошибок через toast.

### 4.3 Состояние загрузки при смене периода/даты в статистике

**Проблема:** При переключении периода или даты в `StaffFinanceStats` вызывается `loadStats()`, но можно улучшить отзывчивость (например, скелетон или сохранение предыдущих данных до прихода новых).

**Задачи:**

- [x] Показывать предыдущие данные с индикатором фоновой загрузки при `loading === true` и уже имеющихся `stats` (без «мигания»).

---

## 5. Интернационализация (P2)

### 5.1 Отсутствующие или разные ключи i18n

**Проблема:** Часть ключей используется с fallback в коде (например, `finance.staffStats.subtitle`, `staff.finance.backToShift`, `staff.finance.shift.title`). В словарях `finance.ru.ts` / `finance.en.ts` / `finance.ky.ts` не все ключи присутствуют или совпадают по смыслу между страницами дашборда и кабинета сотрудника.

**Задачи:**

- [x] Добавить в словари недостающие ключи, используемые в дашборде: `finance.staffStats.subtitle`, `finance.staffStats.editHoursHint`, `staff.finance.backToShift`, `staff.finance.shift.title`, `staff.finance.shift.subtitle` (ru/en/ky).
- [x] Ключи дашборда приведены в соответствие; полный аудит на дублирование по смыслу при необходимости можно провести отдельно.

### 5.2 Хардкод строк в validation и ошибках

**Проблема:** В `apps/web/src/app/staff/finance/utils/validation.ts` сообщения об ошибках захардкожены на русском («Имя клиента обязательно» и т.д.).

**Задачи:**

- [x] Выносить сообщения валидации в i18n (ключи типа `staff.finance.validation.clientNameRequired`) и использовать `t()` в компонентах при отображении ошибок; в validation можно возвращать ключ или код ошибки, а текст подставлять в UI.
  - **Сделано:** В `validation.ts` введён объект `VALIDATION_KEYS` с i18n-ключами; все сообщения возвращаются как ключи. В `ClientEditForm` и `FinancePage` при показе ошибок вызывается `t(key)`. В словари `staff.ru/en/ky` добавлены ключи `staff.finance.validation.*`. В хуке `useShiftItems` добавлен опциональный параметр `t` для перевода сообщений при автосохранении.

---

## 6. Код и архитектура (P2–P3)

### 6.1 Дублирование типов смены и позиций

**Проблема:** Типы вроде `Shift`, `ShiftItem`, структура ответа stats дублируются между `StaffFinanceStats.tsx`, API stats route и общими типами в `staff/finance/types.ts` и `@/lib/validation/types`.

**Задачи:**

- [x] По возможности описать общие типы (например, смена с полями для статистики, элемент смены для списка клиентов) в одном месте (`@/lib/validation/types` или отдельный модуль типов домена финансов) и импортировать в компоненты и API.
  - **Сделано:** Добавлен модуль `apps/web/src/lib/finance/types.ts` с типами `StaffFinanceStats*` (payload stats, shift, shift item) — намеренно в `snake_case`, т.к. API stats отдаёт структуру близкую к БД.
- [x] В API stats по возможности возвращать структуру, совместимую с общими типами, чтобы не дублировать поля вручную.
  - **Сделано:** `GET /api/dashboard/staff/[id]/finance/stats` и компонент `StaffFinanceStats.tsx` теперь используют общие типы из `@/lib/finance/types` (локальные `type ShiftItem/Shift/Stats/Period` удалены).

### 6.2 Единая точка входа для «проверка прав менеджера + сотрудник принадлежит бизнесу»

**Проблема:** Несколько роутов подряд делают одно и то же: `withManagerContext` → загрузка staff по id → проверка `staff.biz_id === bizId`. Это можно сократить до одного слоя (мидлварь или хелпер).

**Задачи:**

- [x] Рассмотреть хелпер вида `withManagerAndStaffContext(req, context, staffIdParamName, handler)`, который получает контекст менеджера, загружает staff по `staffId` из route params, проверяет принадлежность бизнесу и вызывает `handler` с `{ ...managerContext, staff }` или возвращает 404. Подключить в `finance/page`, `finance/stats`, `shift/open`, `finance/audit-log`, `finance/stats` API.
  - **Сделано:** Добавлен `apps/web/src/lib/withManagerAndStaffContext.ts`. Подключён в:
    - `GET /api/dashboard/staff/[id]/finance/stats`
    - `GET /api/dashboard/staff/[id]/finance/audit-log`
    - `POST /api/dashboard/staff/[id]/shift/open`
    - `GET /api/dashboard/staff/[id]/finance` (deprecated endpoint)
  - **Поведение:** при `staffId` из другого бизнеса возвращаем **404** (`not_found`), чтобы не “светить” чужие ID.

### 6.3 Логирование в FinanceSettingsAuditLog

**Проблема:** При ошибке загрузки audit log в компоненте только выставляется `setError`; в консоль или мониторинг ошибка не попадает.

**Файл:** `apps/web/src/app/dashboard/staff/[id]/finance/components/FinanceSettingsAuditLog.tsx`

**Задачи:**

- [x] При ошибке в `fetch` вызывать `logError` (или аналог) с контекстом (staffId, причина), чтобы сбои были видны в логах.
  - **Сделано:** В `FinanceSettingsAuditLog.tsx` добавлен `logError('FinanceSettingsAuditLog', ...)` с `{ staffId, url, message }` при ошибке загрузки.

---

## 7. Тесты и документация (P2)

### 7.1 E2E или сценарии для раздела финансов

**Задачи:**

- [x] Добавить e2e (Playwright) или расширить существующие: вход как владелец → переход к финансам сотрудника → открытие смены (если разрешено) → добавление клиента → проверка отображения; вход как сотрудник → открытие/закрытие смены и сохранение клиентов.
  - **Сделано:** Расширен `apps/web/e2e/staff-finance-pages.spec.ts` (владелец: `/dashboard/staff/[id]/finance` → открыть смену (если доступно) → добавить клиента). Сценарий сотрудника покрыт в `apps/web/e2e/shift-management.spec.ts`.
- [x] Покрыть сценарий «владелец на странице статистики сотрудника»: выбор периода, обновление, при наличии — «Исправить часы» (с модалкой после 4.2).
  - **Сделано:** Добавлен сценарий в `apps/web/e2e/staff-finance-pages.spec.ts`: `/dashboard/staff/[id]/finance/stats` → выбор периода → «Обновить» → при наличии кнопки «Исправить часы» — ввод и сохранение (проверка запроса `/api/dashboard/staff-shifts/:id/update-hours`).

### 7.2 Документация по API финансов

**Задачи:**

- [x] В `docs/` или в коде описать основные endpoints:  
  - `GET /api/staff/finance?staffId=&date=` — данные смены;  
  - `POST /api/staff/shift/open` и `POST /api/dashboard/staff/[id]/shift/open?date=` — открытие смены;  
  - `POST /api/staff/shift/close` (и при варианте B — `POST /api/dashboard/staff/[id]/shift/close`);  
  - `POST /api/staff/shift/items` — сохранение клиентов;  
  - `GET /api/dashboard/staff/[id]/finance/stats?period=&date=` — статистика;  
  - `GET /api/dashboard/staff/[id]/finance/audit-log` — аудит настроек.  
  - **Сделано:** добавлен файл `docs/FINANCE_API.md` с описанием перечисленных endpoints, query/body и форматом ответа; также описан `POST /api/dashboard/staff-shifts/[id]/update-hours`.
- [x] Указать, какие роли (сотрудник / менеджер) могут вызывать какой endpoint и при каких условиях (например, закрытие только своей смены или и смены сотрудника при варианте B).
  - **Сделано:** в `docs/FINANCE_API.md` добавлена секция «Роли и условия вызова» с таблицей: сотрудник — только свои смены/items; менеджер — смены сотрудников своего бизнеса, отдельно закрытие своей смены vs закрытие смены сотрудника (вариант B).

---

## Оптимизация загрузки страницы финансов (P2)

**Цель:** Уменьшить время до первого отображения контента на `/dashboard/staff/[id]/finance`.

**Сделано:**

- [x] **Серверный prefetch:** В `page.tsx` после проверки сотрудника вызывается `getShiftData(..., useServiceClient: true)` для сегодняшней даты; результат приводится к формату API через `buildFinanceResponsePayload()` и передаётся в `StaffFinancePageClient` как `initialData`. Клиентский `useFinanceData` использует `initialData` при запросе на «сегодня» — отдельный запрос к `/api/staff/finance` не выполняется при первой загрузке.
- [x] **Один батч запросов в сервисе:** В `shiftDataService` загрузка `allShifts` для сегодняшней даты перенесена в первый `Promise.all` (вместе с staff, shift, bookings, services, day-off проверками), убран второй последовательный `await`.
- [x] **Общий форматтер ответа:** В `shiftDataService` добавлены `buildFinanceResponsePayload()` и тип `FinanceResponsePayload`; API route использует их вместо дублирования маппинга items.
- [x] **Скелетон при навигации:** Добавлен `loading.tsx` для маршрута — при переходе на страницу сразу показывается скелетон, пока выполняется серверный рендер.

**Дополнительно (по желанию):**

- Prefetch при наведении на ссылку «Финансы» со страницы сотрудника (`queryClient.prefetchQuery` по ключу `['finance', staffId, todayStr]`).
- Индексы БД: убедиться в наличии индексов по `staff_shifts(staff_id, shift_date)`, `bookings(staff_id, start_at)`.
- Кэш/ревалидация: при необходимости увеличить `staleTime` для дашборда (данные меняются реже, чем у сотрудника).

---

## Сводка по приоритетам

| Приоритет | Количество задач | Фокус |
|-----------|------------------|--------|
| P0        | 1 блок (1.1)     | Закрытие смены владельцем — корректное поведение или ограничение |
| P1        | 4 блока          | Консистентность проверок, обработка ошибок, обновление без reload, API |
| P2        | 6 блоков         | UX (подсказки, модалка часов, загрузка), i18n, типы, логирование, тесты, документация |
| P3        | в составе 6.x     | Общие хелперы и уменьшение дублирования кода |

Рекомендуемый порядок: сначала **1.1** (P0), затем **2.1, 2.2, 2.3** (P1), после этого — задачи P2 по мере возможности.
