# API сотрудников, смен и финансов

Статус: справочник реализации по исходникам. Статическая сверка: **1 ноября 2026**. Ответственная роль за актуальность: разработчик API сотрудников и финансов. Здесь разобраны 25 сочетаний метода и пути из прежних разделов «Сотрудники» и «Дашборд» общей API-документации. Контракты Save/Close/Open обновлены 10 ноября 2026 по локальному исправлению; остальные даты сверки указаны в разделах.

Сверены route, HTTP-обработчики, сервисы, используемые схемы и отдельные определения SQL. Для пакета смен 10 ноября выполнены локальные unit/API-тесты и [транзакционные проверки](../../scripts/test-finance-transactions.mjs) в одноразовом PostgreSQL 16 на синтетических данных без сети. Live HTTP/удалённая БД не использовались; deployment миграций, фактические RLS/ACL окружения, полнота реальных данных и предел нагрузки не подтверждены. Открытые риски — [ENGINEERING_FINDINGS](../ENGINEERING_FINDINGS.md); актуальное состояние — [PROJECT_STATUS](../PROJECT_STATUS.md). WEB-кампания остаётся закрытой, автоматизация PAUSED; правила дальнейшей проверки — [handoff](../WEB_AGENT_HANDOFF.md).

Навигация: [API-карта](../../API_DOCUMENTATION.md), [общий индекс](../README.md), [финансовый указатель](../FINANCE_API.md).

## Содержание

- [Общие правила чтения контракта](#общие-правила-чтения-контракта)
- [Смены и рабочее место сотрудника](#смены-и-рабочее-место-сотрудника): open, finance, close, items, today
- [Управление сотрудниками](#управление-сотрудниками): create, update, delete, restore, dismiss, transfer, create-from-user, старый update, avatar
- [Финансовый дашборд](#финансовый-дашборд): общая статистика, данные сотрудника, детальная статистика
- [Акции филиала](#акции-филиала): create, list, update, delete
- [Управление сменами из дашборда](#управление-сменами-из-дашборда): open, update-hours

## Общие правила чтения контракта

**Ответы.** Если ниже указано «`data` содержит …», полный успешный ответ — HTTP 200 с `ok: true` и этим полем `data`. Без данных ответ — только `{"ok":true}`. Ошибки HTTP/service обычно имеют `ok: false`, строковый `error`, необязательные `message` и `details`. Не следует выводить HTTP-статус только из `error`: например, закрытие смены возвращает `409 / validation`. Источник: [apiErrorHandler](../../apps/web/src/lib/apiErrorHandler.ts).

**Авторизация.** Названия контекстов ниже обозначают конкретную цепочку кода:

| Контекст | Что делает реализация |
| --- | --- |
| Staff request | `getStaffContextForRequest`: Bearer-токен при подходящем `Authorization`, иначе cookie-сессия; требуется активная запись staff, связанная с пользователем |
| Staff cookie | `getStaffContext`: серверная cookie-сессия и активная запись staff; request Bearer этой веткой не читается |
| Manager direct | `getBizContextForManagers`: cookie-сессия и выбранный бизнес через resolver прав управления; тело запроса не выбирает `bizId` |
| Manager wrapper | `withManagerContext`: тот же resolver; `NOT_AUTHENTICATED` преобразуется в 401, прочие `BizAccessError` — в 403 |
| Manager + staff | `withManagerAndStaffContext`: manager wrapper, UUID пути и проверка staff.biz_id; отсутствие/ошибка чтения/другой бизнес возвращают 404 |

Resolver управления учитывает owner/admin/manager, super_admin с выбранным бизнесом и owner_id fallback; это не обещание одинакового допуска для всех маршрутов: отдельные сервисы выполняют дополнительные проверки. Получение staff-контекста также пытается добавить отсутствующую роль staff, поэтому даже GET может иметь такой побочный эффект. Источники: [authBiz](../../apps/web/src/lib/authBiz.ts), [staffRoleSync](../../apps/web/src/lib/staffRoleSync.ts), [requestAuthContext](../../apps/web/src/lib/requestAuthContext.ts), [bizContextResolver](../../apps/web/src/lib/bizContextResolver.ts), [manager wrapper](../../apps/web/src/lib/withManagerContext.ts), [manager + staff](../../apps/web/src/lib/withManagerAndStaffContext.ts).

**Ошибки исключений.** У manager direct и старых staff-cookie обработчиков внешняя `withErrorHandler` классифицирует исключения по тексту. `UNAUTHORIZED` даёт 401, но `NO_BIZ_ACCESS`/`NO_STAFF_RECORD` не дают автоматически 403/401 и могут закончиться 500. В разделе endpoint перечислены явные ветки сервиса; к ним добавляется обработка исключений из [apiErrorHandler](../../apps/web/src/lib/apiErrorHandler.ts). Где собственный HTTP catch отличается, это отмечено отдельно. Неверный UUID, проверенный `getRouteParamUuid`, обычно даёт 400 через внешнюю обёртку; `getRouteParamRequired` сам UUID не проверяет. [routeParams](../../apps/web/src/lib/routeParams.ts).

**Limiter.** С 2026-11-10 каждый wrapper имеет явный стабильный routeId и отдельный method budget; query/UUID не создают новый counter. Staff Open/Save/Close и manager Close используют ingress600/min, затем verified user5/30 и business×60 budgets после auth. Отказ429 `rate_limit_exceeded`; missing/error Redis или неподтверждённая trusted-ingress policy —503 `service_unavailable`, до handler. Остальные normal/critical presets относятся к scope конкретного callsite. Детали и границы — [RATE_LIMITING](../../RATE_LIMITING.md).

**Валидация и SQL.** TypeScript `Body` не равнозначен проверке входящего JSON. Строгие схемы отмечены явно. Настройка `SCHEDULE_V2_ENABLED === 'true'` выбирает ветки explicit scheduling в [config](../../apps/web/src/lib/scheduling/config.ts); фактическое значение окружения не проверялось. Описанные SQL-ветки — определения в репозитории, не подтверждение их deployment. Наличие manager-контекста или RLS не доказывает атомарность и полную проверку вложенных ID: см. ENG-02/03/05 в [реестре](../ENGINEERING_FINDINGS.md).

## Смены и рабочее место сотрудника
### POST `/api/staff/shift/open`

<!-- api-contract: POST /api/staff/shift/open -->

Первичная сверка 30 октября; RPC Open и локальные SQL-регрессии обновлены 10 ноября 2026.

Открывает смену для сотрудника из `getStaffContextForRequest`. Тело не читается; `staffId`, `bizId` и филиал берутся из контекста. Необязательный query `date=YYYY-MM-DD` проверяет день загруженного черновика: он должен совпасть с текущим днём бизнеса, иначе 409. Без date день определяет scoped SQL calendar по businesses.tz. Перед RPC проверяется наличие рабочих часов/выходного дня.

**Rate Limiting:** ingress600/min; после verified staff context — user5/min и business300/min, отдельно от других method/route budgets. [Контракт и503](../../RATE_LIMITING.md).

**Успех:** HTTP 200, обёртка `{ ok: true, data: { shift } }`. `shift` передаётся из результата `open_staff_shift_safe`; отдельных верхнеуровневых `shift_id` и `date` обработчик не создаёт. Уже открытая смена возвращается как успех; повторное открытие закрытой смены разрешено manager и сохраняет исходное opened_at/late, повышая revision. Новая смена создаётся только за business-local today с фактическим временем SQL; future и отсутствующая historical смена дают 409. [Calendar/Open SQL](../../supabase/migrations/20261110114000_finance_calendar.sql) проверяет actor/business/staff/branch, сериализует команды блокировкой staff и пересчитывает затронутые агрегаты при reopen. Прямые authenticated-изменения статуса и финансовых полей запрещены trigger; deployment не подтверждён.

**Установленные ветки ошибок:**

- `400 / validation` — неверная календарная дата, выходной или отсутствие назначенных рабочих часов.
- `403 / forbidden` — SQL отверг actor/scope или попытку staff повторно открыть закрытую смену.
- `409 / validation` — день черновика изменился либо SQL отклонил выбранный день.
- `401 / auth` — исключение контекста классифицировано HTTP-обработчиком как ошибка авторизации.
- `429` — отказ limiter; ответ содержит `retryAfter` и заголовок `Retry-After`.
- `500 / internal` — ошибка RPC, его неуспешный/неполный результат либо другое исключение.

Ошибки HTTP/service-слоя имеют обёртку `{ ok: false, error, message? }`; ответ limiter формируется отдельно. Наличие открытой смены не является подтверждённой причиной `400`, как утверждала прежняя редакция.

Источники: [route](../../apps/web/src/app/api/staff/shift/open/route.ts), [HTTP](../../apps/web/src/lib/staffShiftOpenHttpService.ts), [service](../../apps/web/src/lib/staffShiftOpenService.ts), [обёртки ответов](../../apps/web/src/lib/apiErrorHandler.ts).

---

### GET `/api/staff/finance`

<!-- api-contract: GET /api/staff/finance -->

Сверено по route, HTTP/route-service, query schema и построителю payload 30 октября 2026; runtime-проверка этой редакцией не выполнялась.

Возвращает данные финансового рабочего места. Без `staffId` используется `getStaffContextForRequest`; с `staffId` — `getBizContextForManagers` и проверка принадлежности выбранного сотрудника текущему бизнесу. Это описание кода, а не подтверждение полной изоляции данных; открытые ограничения перечислены в [финансовом указателе](../FINANCE_API.md).

**Query:** строгая `staffFinanceQuerySchema`.

| Поле | Контракт schema/route |
| --- | --- |
| `staffId` | Необязательный UUID; выбирает manager-ветку |
| `date` | Необязательная существующая календарная дата `YYYY-MM-DD`, год 1900–2100; при отсутствии SQL выбирает текущую дату в timezone бизнеса; явная дата передаётся строкой без преобразования через серверный Date |

Неизвестные query-поля отклоняются схемой. В текущем route нет вызова `withRateLimit`; прежнее указание `normal (60 req/min)` для этого endpoint неверно. Внешние ограничения хостинга этой сверкой не установлены.

**Успех:** HTTP 200, `{ ok: true, data: FinanceResponsePayload }`. Полная форма — тип `FinanceResponsePayload` и `buildFinanceResponsePayload` в [shiftDataService.ts](../../apps/web/src/app/staff/finance/services/shiftDataService.ts).

В `data` входят `calendar` (`date`, `todayDate`, `timezone`, UTC `dayStart`/`dayEnd`, `dayHours`), `today`, `bookings`, `services`, `allShifts`, финансовые настройки и текущие расчёты, `isDayOff`, `stats`. Смена и позиции находятся в `data.today`, а не непосредственно в `data.shift`/`data.items`. `today.shift.ledger_revision` и полные items читаются одним invoker SQL JSON-снимком `read_staff_shift_snapshot` под caller RLS, без ограничения REST max_rows; пара shift.id/revision является основой Save/Close. Элементы `today.items` формируются в camelCase: `clientName`, `serviceName`, `serviceAmount`, `consumablesAmount`, `bookingId`, `createdAt` и `id`. Остальные вложенные структуры следует брать из указанного типа, не из старого JSON-примера.

**Установленные ветки ошибок:**

- `400 / validation` — query не соответствует schema.
- `401 / auth` — HTTP catch получил `UNAUTHORIZED`, `NO_STAFF_RECORD` или `NO_BIZ_ACCESS`.
- `404 / not_found` — в manager-ветке сотрудник не найден, его бизнес не совпал с контекстом либо запрос проверки сотрудника вернул ошибку.
- `500 / internal` — другое исключение в цепочке.

Обёртка ошибок: `{ ok: false, error, message? }`. Универсальное обещание `403` для чужого сотрудника из прежнего описания не соответствует указанной manager-ветке.

Источники: [route](../../apps/web/src/app/api/staff/finance/route.ts), [HTTP](../../apps/web/src/lib/staffFinanceHttpService.ts), [route service](../../apps/web/src/lib/staffFinanceRouteService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts), [обёртки ответов](../../apps/web/src/lib/apiErrorHandler.ts).

---

### POST `/api/staff/shift/close`

<!-- api-contract: POST /api/staff/shift/close -->

Первичная сверка 30 октября; атомарная команда Close и локальные API/SQL-регрессии обновлены 10 ноября 2026.

Закрывает смену expectedShiftId сотрудника из `getStaffContextForRequest`; persisted shift_date определяет её финансовый день. Выбранный сотрудник или дата из query/body этим обработчиком не принимаются.

**Rate Limiting:** ingress600/min; после verified staff context — user5/min и business300/min. [Контракт и503](../../RATE_LIMITING.md).

**Body:** строгая `closeShiftSchema`.

| Поле | Контракт schema |
| --- | --- |
| `expectedShiftId` | Обязательный UUID смены из прочитанного снимка |
| `expectedRevision` | Обязательное целое 0…Number.MAX_SAFE_INTEGER из `shift.ledger_revision` того же снимка |
| `items` | Необязательный массив `shiftItemSchema`, максимум 1000 позиций |
| `totalAmount` | Необязательное неотрицательное число |
| `consumablesAmount` | Необязательное неотрицательное число |

Схема требует непустой `items` либо присутствующий `totalAmount` (включая 0). Другие поля, в том числе прежний пример `hoursWorked`, отклоняются. Поля отдельной позиции и ограничения описаны в [schemas.ts](../../apps/web/src/lib/validation/schemas.ts).

Закрытие проверяет идентичность и версию исходного клиентского снимка, затем сравнивает сохранённые позиции с присланным финансовым снимком через [matchesSavedShiftLedger](../../apps/web/src/lib/staffShift/savedLedger.ts). Оно не служит сохранением новых клиентов: при несовпадении версии, состава, сумм или связей возвращается 409. Web-клиент последовательно сохраняет изменённый черновик, получает новую revision и только затем вызывает Close. Новые правки во время этого Save отменяют попытку Close, сохраняя черновик; сама Close блокирует поля формы. Если `items` не передан, HTTP-слой передаёт пустой массив; поэтому прохождение schema с одним `totalAmount` не гарантирует закрытие смены с сохранёнными позициями.

**Успех:** HTTP 200, `{ ok: true, data: { shift } }`; форма строки смены определяется `StaffShiftRow` в [service](../../apps/web/src/lib/staffShiftCloseService.ts) и результатом RPC. Верхнеуровневого `shift` без `data` этот обработчик не возвращает.

**Установленные ветки ошибок:**

- `400 / validation` — неверный JSON/schema, выбранная expectedShiftId смена не найдена либо SQL отверг входные данные. Уже закрытая смена возвращается как идемпотентный успех.
- `401 / auth` — исключение классифицировано HTTP catch как ошибка авторизации.
- `403 / forbidden` — SQL отверг actor/business/staff или вложенную связь.
- `409 / validation` — идентичность смены, версия исходного черновика, снимок позиций, настройки или применённая цена изменились; черновик нельзя автоматически отправлять со свежей версией.
- `429` — отказ limiter с `retryAfter` и `Retry-After`.
- `500 / internal` — ошибка загрузки, непредвиденная ошибка RPC/агрегатов или неполный результат команды.

Обёртка ошибок: `{ ok: false, error, message? }`. Backend сверяет клиентские expectedShiftId/revision с прочитанной сменой, рассчитывает суммы общим core-domain и вызывает service-only `close_staff_shift_command` с actor, той же клиентской revision и настройками. Команда блокирует staff/shift/bookings, проверяет revision/настройки/суммы ledger и в одной транзакции обновляет attendance, пакет/акцию, смену и агрегаты. Отсутствующие hold переводятся в no_show; отсутствующие confirmed не меняются. Ошибка любого шага откатывает команду. Уведомление выполняется после commit, его ошибка логируется и не превращает commit в HTTP-ошибку; доставка не гарантируется. Повторное закрытие не начисляет пакет/агрегаты повторно. [Команда и DML-guards](../../supabase/migrations/20261109091100_atomic_shift_commands.sql), [tenant/package guards](../../supabase/migrations/20261109090100_tenant_finance_rpc_guards.sql), [адаптер](../../apps/web/src/lib/staffShift/financeCommand.ts).

При пустом ledger manual API сохраняет прежний ввод totalAmount/consumablesAmount. Смена выбирается по expectedShiftId внутри staff+biz; manager query date, если задан, должен совпасть с её датой. Полный service-only close snapshot содержит revision, ledger, настройки, business timezone и UTC-границы shift_date. Время Close — минимум фактического момента и конца этого локального дня; открытие вне него требует проверки (409). Часы ограничены фактической длиной суток (23/24/25 при DST), без произвольного ограничения всех дат 24 часами. Гарантия считается по этим часам; изменение revision между чтениями даёт 409, без автоматической подмены версии. [Snapshot helper](../../apps/web/src/lib/staffShift/closeSnapshot.ts), [актуальная SQL-миграция](../../supabase/migrations/20261110113000_shift_close_backlog.sql), [DST/backlog SQL-регрессии](../../scripts/test-shift-close-backlog.mjs).

SQL Save/Close и item-trigger сопоставляют дату booking с shift_date в businesses.tz, fallback Asia/Bishkek; новая миграция не означает изменения default-даты каждого Open/Save/клиентского календаря.

Источники: [route](../../apps/web/src/app/api/staff/shift/close/route.ts), [HTTP](../../apps/web/src/lib/staffShiftCloseHttpService.ts), [service](../../apps/web/src/lib/staffShiftCloseService.ts), [обёртки ответов](../../apps/web/src/lib/apiErrorHandler.ts).

---

### POST `/api/staff/shift/items`

<!-- api-contract: POST /api/staff/shift/items -->

Первичная сверка 30 октября; единая команда Save и локальные API/SQL-регрессии обновлены 10 ноября 2026.

Сохраняет позиции смены. Без `staffId` используется контекст сотрудника; с `staffId` — manager-контекст и проверка принадлежности целевого сотрудника бизнесу. В manager-ветке сервис может создать отсутствующую смену на выбранную дату; существующая закрытая смена отклоняется. Это описание текущей цепочки, не полномочие изменять финансовые данные.

**Rate Limiting:** ingress600/min; после verified staff/manager context — user30/min и business1800/min. [Контракт и503](../../RATE_LIMITING.md).

**Body:** строгая `saveShiftItemsSchema`.

| Поле | Контракт schema/route |
| --- | --- |
| `items` | Обязательный массив `shiftItemSchema`, максимум 1000; пустой массив допустим схемой |
| `staffId` | Необязательный UUID, выбирающий manager-ветку |
| `shiftDate` | Необязательная существующая дата `YYYY-MM-DD`, год 1900–2100; без неё SQL использует persisted date указанного expectedShiftId; при null/null — текущий день бизнеса |
| `expectedShiftId` | Обязательный UUID исходной смены; null только когда прочитанный снимок не содержал смены |
| `expectedRevision` | Обязательное целое 0…Number.MAX_SAFE_INTEGER из исходного `shift.ledger_revision`; null только в паре с null expectedShiftId |

Каждая позиция также проверяется строгой схемой. `id` — необязательный UUID или `null`; `clientId` — необязательный UUID черновика; `bookingId` — необязательный UUID или `null`. `clientName` и `serviceName` необязательны, допускают пустую строку/`null`, максимум 200 символов. `serviceAmount` и `consumablesAmount` — числа от 0 до 100 000 000, значение по умолчанию 0. `createdAt` — необязательная строка или `null`. Полный контракт — [shiftItemSchema и saveShiftItemsSchema](../../apps/web/src/lib/validation/schemas.ts); старые требования «имена обязательны / максимум 255 / суммы до 1 000 000» отменены этой сверкой.

**Успех:** HTTP 200, `{ ok: true, data: { shiftId, revision, items } }`. `revision` — фактическая версия после всей транзакции, не обязательно предыдущая + 1. `items` — сохранённые camelCase-позиции с ID и фактическими суммами после пакетов/скидок; их нужно использовать для следующего черновика. Полная строка shift здесь не возвращается.

**Установленные ветки ошибок:**

- `400 / validation` — неверный JSON/schema, нет открытой смены в staff-ветке, повторяющийся bookingId, отменённая связанная бронь либо защитный отказ очистки более 10 позиций.
- `401 / auth` — явная ветка manager-проверки, когда `auth.getUser()` не вернул пользователя.
- `403 / forbidden` — actor/staff/business, ID позиции или вложенная booking не прошли проверку принадлежности смене/бизнесу/сотруднику/дате.
- `409 / validation` — смена закрыта или переданная expectedRevision устарела.
- `429` — отказ limiter с `retryAfter` и `Retry-After`.
- `500 / internal` — прочие ошибки команды, неподтверждённый результат или общий HTTP catch.

HTTP/service-ошибки имеют форму `{ ok: false, error, message? }`. Исключения из получения контекста попадают в общий catch 500, поэтому эта реализация не гарантирует 401 для каждого auth-сбоя.

Save передаёт все позиции одним RPC `save_staff_shift_command`: проверка actor/вложенных ID, статусы, пакет/акция, замена ledger и итоги входят в одну транзакцию. Максимум 1000 позиций ограничивает команду; отдельного запроса на каждую позицию больше нет. Повтор clientId сохраняет идентичность и created_at; одинаковые walk-in позиции с разными ID остаются разными. Один bookingId разрешён только в одной позиции; отменённая бронь не превращается в paid. Пакет выбирается в бизнесе booking. SQL-ошибка откатывает все эти записи.

**Протокол черновика (10 ноября):** GET finance читает `ledger_revision` и полные связанные items одним SQL JSON-снимком. Save заменяет только указанную пару shiftId/revision; null/null позволяет manager создать отсутствующую смену только за business-local today, но не перезаписать уже созданную конкурентом. Новая [миграция](../../supabase/migrations/20261110100000_finance_draft_revision.sql) возвращает revision и канонические items в той же транзакции; прежний внутренний Save недоступен API-ролям. Прямые INSERT/UPDATE/DELETE позиций от anon/authenticated блокирует invoker-trigger; проверенные SECURITY DEFINER-команды и доверенные серверные writers сохраняют доступ. Web [FinanceDraftSession](../../apps/web/src/app/staff/finance/services/financeDraftSession.ts) последовательно выполняет Save/Close, применяет подтверждённые ID/скидки только к полям без более поздней локальной правки и не заменяет dirty draft при refetch. При 409 или неизвестном исходе сетевого запроса черновик остаётся на экране, автозапись блокируется до явного отказа от черновика и загрузки актуального снимка. Дата входит в состояние черновика: новый бизнес-день при refetch не переносит dirty items, даже если оба снимка без смены. Open/Save/Close и явный reload используют захваченный день; конфликт требует ручной сверки. [Calendar SQL](../../supabase/migrations/20261110114000_finance_calendar.sql) проверяет соответствие explicit date сохранённому shiftId, не создаёт прошлую/будущую смену. Повтор старой Save после commit может получить 409; это не команда с сохранённым idempotency key, автоматического перебазирования нет.

Это изменение обязательного HTTP-контракта: старые клиенты без пары expectedShiftId/expectedRevision получают 400. Обновление клиента/API и применение зависимых миграций нужно согласовать; наличие файлов в репозитории не подтверждает готовность окружения к новому контракту.

[Атомарный Save/Close](../../supabase/migrations/20261109091100_atomic_shift_commands.sql), [tenant/package guards](../../supabase/migrations/20261109090100_tenant_finance_rpc_guards.sql), [воспроизводимый SQL runner](../../scripts/test-finance-transactions.mjs). Перед применением unique-index нужна проверка существующих повторных bookingId; миграция не удаляет/не исправляет данные автоматически. Локальные тесты и синтетическая PostgreSQL не подтверждают применение к рабочей БД или её фактические grants/RLS.

Источники: [route](../../apps/web/src/app/api/staff/shift/items/route.ts), [HTTP](../../apps/web/src/lib/staffShiftItemsHttpService.ts), [route service](../../apps/web/src/lib/staffShiftItemsRouteService.ts), [service](../../apps/web/src/lib/staffShiftItemsService.ts), [обёртки ответов](../../apps/web/src/lib/apiErrorHandler.ts).

---

### GET `/api/staff/shift/today`

<!-- api-contract: GET /api/staff/shift/today -->

Устаревающий обработчик: HTTP-слой пишет предупреждение с рекомендацией перейти на `/api/staff/finance`. Это действующая реализация, не redirect и не 410.

| Часть | Контракт |
| --- | --- |
| Доступ | Staff cookie; query/body не читаются |
| Limiter | Нет в route |
| Успех | `data` содержит `today`, `allShifts`, `bookings`, `services`, `staffPercentMaster`, `staffPercentSalon`, `hourlyRate`, `currentHoursWorked`, `currentGuaranteedAmount`, `isDayOff`, `stats` |
| Нет смены | `data.today`: `exists: false`, `status: none`, `shift: null`, `items: []` |
| Ошибки | 500 при ошибке чтения смены или истории; исключения контекста — по общей обёртке |

При наличии смены `today` содержит `exists`, `status`, `shift` и `items`; позиции здесь используют поля БД в snake_case. Это не прежний компактный ответ `shift/date/items_count` и не полная замена camelCase-payload нового `/staff/finance`. День выбирается текущим временем/веткой расписания. Ошибки дополнительных запросов настроек, позиций, записей или услуг могут приводить к значениям по умолчанию/пустым массивам при 200. История `allShifts` читается целиком одним `read_staff_finance_history` JSON-снимком для staff+biz под caller RLS; ошибка этой финансовой зависимости даёт 500. [SQL](../../supabase/migrations/20261110110000_reporting_completeness.sql).

Источники: [route](../../apps/web/src/app/api/staff/shift/today/route.ts), [HTTP](../../apps/web/src/lib/staffShiftTodayHttpService.ts), [service и построение полного data](../../apps/web/src/lib/staffShiftTodayService.ts).

## Управление сотрудниками

### POST `/api/staff/create`

<!-- api-contract: POST /api/staff/create -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; дополнительная проверка роли owner/admin/manager в текущем бизнесе |
| Limiter | `normal` |
| Body | `full_name`, `branch_id`, `is_active`; необязательные `email`, `phone` |
| Успех | `data`: `id`, `user_linked`, `schedule_initialized`, `schedule_days_created`, `schedule_error` |
| Ошибки | 400 validation при неверном JSON, отсутствии имени/филиала или ошибке вставки; 403 forbidden при провале дополнительной проверки роли; 500 internal если не получен ID; исключения — по общей обёртке |

`Body` — TypeScript-тип, строгой JSON-schema здесь нет. Сервис проверяет truthiness `full_name`/`branch_id`, приводит `is_active` через `!!` (пропуск даёт false). Поля `biz_id` и `user_id` из прежнего примера не выбирают бизнес/пользователя: бизнес берётся из контекста, привязка пользователя ищется по email/phone среди **первых 200** auth users. Сервис не выполняет отдельную проверку UUID/принадлежности филиала перед вставкой; ограничения БД не заменяют документированную проверку HTTP-слоя.

После вставки отдельно создаётся назначение филиала, добавляется роль связанного пользователя и в legacy-ветке инициализируется расписание. При explicit scheduling инициализация пропускается. Эти действия не составляют подтверждённую общую транзакцию; `schedule_initialized: false` и `schedule_error` следует обрабатывать отдельно, а не считать 200 гарантией готового расписания.

Источники: [route](../../apps/web/src/app/api/staff/create/route.ts), [HTTP](../../apps/web/src/lib/staffCreateHttpService.ts), [Body, service и вспомогательные шаги](../../apps/web/src/lib/staffCreateService.ts).

### POST `/api/staff/[id]/update`

<!-- api-contract: POST /api/staff/[id]/update -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; UUID `id`; проверяется принадлежность сотрудника и целевого филиала текущему бизнесу |
| Limiter | Нет в route |
| Body | `full_name`, `branch_id`, `is_active`; необязательные `email`, `phone`, `percent_master`, `percent_salon`, `hourly_rate` |
| Успех | `data: { transferred: boolean }`; строка staff в ответ не включается |
| Ошибки | 400 validation при неверном JSON/имени/филиале/сумме процентов; 403 forbidden при недоступном сотруднике; ошибки записей — 400 internal; исключения — по общей обёртке |

Проверки и преобразования не являются строгой schema:

| Поле | Фактическая обработка |
| --- | --- |
| `full_name` | Должно быть строкой с непустым `trim()`; в payload передаётся исходная строка |
| `branch_id` | Непустая строка; филиал должен быть доступен в бизнесе и активен |
| `email`, `phone` | При пропуске становятся `null` |
| `is_active` | Приведение через `!!`; пропуск становится false |
| `percent_master`, `percent_salon` | Применяются только когда **оба** поля имеют JS-тип number; сумма должна отличаться от 100 не более чем на 0.01. Проверка диапазона каждого 0–100 в этом сервисе отсутствует |
| `hourly_rate` | Если передан, `null`, NaN или значение <= 0 превращаются в `null`; остальные проходят `Number(...)` |

Сначала обновляются основные поля, затем отдельными запросами выполняются запись аудита финансовых настроек и перенос назначений/основного филиала, если филиал изменился. Ошибка позднего шага не откатывает предыдущие HTTP-запросы к БД. Ошибка вставки аудита не проверяется. При установленном SQL guard explicit scheduling прямое изменение основного филиала может быть отклонено; для перевода существует отдельный endpoint ниже. HTTP 200 не доказывает полноту аудита.

Источники: [route](../../apps/web/src/app/api/staff/[id]/update/route.ts), [HTTP](../../apps/web/src/lib/staffUpdateByIdHttpService.ts), [service и Body](../../apps/web/src/lib/staffUpdateByIdService.ts), [определение guard](../../supabase/migrations/20260918133000_atomic_staff_home_transfer.sql).

### POST `/api/staff/[id]/delete`

<!-- api-contract: POST /api/staff/[id]/delete -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; UUID `id`; в legacy-сервисе — проверка сотрудника в бизнесе |
| Вход | Только путь; body/query не читаются |
| Limiter | Нет в route |
| Успех | Только `{"ok":true}`; поля `deleted` нет |
| Ошибки | 409 conflict при включённом explicit scheduling; 404 not_found при недоступном staff в legacy-ветке; 409 conflict при будущих неотменённых записях; 400 internal при ошибках чтения/удаления; 500 internal при невозможности получить роль client; исключения — по общей обёртке |

При explicit scheduling HTTP-слой сразу запрещает удаление ради сохранения истории. В legacy-ветке будущими блокирующими записями считаются `start_at > now` и `status != cancelled`, а не только confirmed. Затем сервис последовательно удаляет прошедшие bookings, working_hours, service_staff, назначения филиалов, правила расписания и time_off, меняет роли связанного пользователя и удаляет staff. Он удаляет **все роли пользователя в данном бизнесе, кроме client**, а не только staff; upsert роли client не проверяет результат. Явного удаления всех staff_shifts в сервисе нет: прежнее обещание этого эффекта исключено, фактические cascade-зависимости требуют отдельной проверки схемы. Возможны частичные удаления до ошибки следующего шага.

Источники: [route](../../apps/web/src/app/api/staff/[id]/delete/route.ts), [HTTP](../../apps/web/src/lib/staffDeleteHttpService.ts), [service](../../apps/web/src/lib/staffDeleteService.ts).

### POST `/api/staff/[id]/restore`

<!-- api-contract: POST /api/staff/[id]/restore -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; ID пути через `getRouteParamRequired`; проверка staff в бизнесе |
| Вход | Body/query не читаются; явной UUID-проверки ID в HTTP нет |
| Limiter | Нет в route |
| Успех | Только `{"ok":true}` |
| Ошибки | 404 not_found при недоступном staff; 400 validation при ошибке активации; 500 internal если не найдена роль staff; исключения — по общей обёртке |

Выставляет `is_active: true`; если staff связан с user, отдельно пытается назначить роль staff. Ошибка upsert роли не проверяется. Активация может уже состояться до последующей ошибки поиска роли; успешный ответ также не доказывает, что роль добавлена. Удалённую строку staff endpoint не создаёт заново.

Источники: [route](../../apps/web/src/app/api/staff/[id]/restore/route.ts), [HTTP](../../apps/web/src/lib/staffRestoreHttpService.ts), [service](../../apps/web/src/lib/staffRestoreService.ts).

### POST `/api/staff/[id]/dismiss`

<!-- api-contract: POST /api/staff/[id]/dismiss -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; ID пути через `getRouteParamRequired`; проверка staff в бизнесе |
| Вход | Body/query не читаются |
| Limiter | Нет в route |
| Успех | Только `{"ok":true}` |
| Ошибки | 404 not_found при недоступном staff; 409 conflict при будущих неотменённых bookings; 400 validation при ошибках чтения/деактивации/удаления ролей; 500 internal при ошибке роли client; исключения — по общей обёртке |

Проверка будущих записей использует `start_at > now` и `status != cancelled`. Затем ставится `is_active: false`. Для связанного user отдельно удаляются **все не-client роли в текущем бизнесе**, добавляется client; результат последнего upsert не проверяется. Это несколько запросов: ошибка ролей не откатывает деактивацию. Увольнение не удаляет строку staff, поэтому восстановление использует `/restore`.

Источники: [route](../../apps/web/src/app/api/staff/[id]/dismiss/route.ts), [HTTP](../../apps/web/src/lib/staffDismissHttpService.ts), [service](../../apps/web/src/lib/staffDismissService.ts).

### POST `/api/staff/[id]/transfer`

<!-- api-contract: POST /api/staff/[id]/transfer -->

Доступ — Manager direct, limiter — `normal`. Тело JSON; неверный JSON даёт 400 validation. Контракт существенно зависит от [explicit scheduling](../../apps/web/src/lib/scheduling/config.ts).

| Режим | Вход и действия | Успех |
| --- | --- | --- |
| Explicit scheduling | UUID пути, `target_branch_id` и **`expected_branch_id`** обязательны; вызывает `transfer_staff_home`. `copy_schedule` не используется | `data` передаётся непосредственно из RPC; репозиторное определение возвращает `note: HOME_BRANCH_CHANGED_SCHEDULE_PRESERVED` |
| Legacy | `target_branch_id` — непустая после trim строка; необязательный `copy_schedule` приводится к boolean. Проверяются staff/целевой филиал в бизнесе и активность филиала | Обычно только `{"ok":true}`; возможны `data.note: ALREADY_ACTIVE_IN_TARGET` либо `data.warning: SCHEDULE_COPY_FAILED` и `data.detail` |

Explicit-ветка отображает RPC-коды следующим образом:

| HTTP | `error` |
| --- | --- |
| 400 | `validation` при входных UUID; `SCHEDULE_INVALID_BRANCH` или `SCHEDULE_SAME_BRANCH` из RPC |
| 403 | `SCHEDULE_FORBIDDEN` |
| 404 | `SCHEDULE_NOT_FOUND` |
| 409 | `SCHEDULE_STALE`, `SCHEDULE_BOOKING_CONFLICT`, `SCHEDULE_FUTURE_ASSIGNMENT` |
| 500 | `internal` для нераспознанной ошибки RPC |

Определение SQL блокирует целевой филиал/staff, проверяет ожидаемый основной филиал, будущие назначения и совместимость бронирований; изменение членства, назначения и аудит выполняются внутри RPC. Это факт определения, не гарантия, что сервер использует эту версию. Опубликованные планы сохраняют свой филиал.

Legacy-ветка возвращает 403 forbidden при недоступном staff/филиале, 400 validation при том же/неактивном филиале и ошибках основных записей. Она изменяет назначения и `staff.branch_id` отдельными запросами; fallback может создать назначение со следующего дня. При `copy_schedule` переустанавливает строки working_hours; ошибка копирования допускает успех с warning. Общей атомарности legacy-ветки нет. Все режимы также допускают 429 и ошибки общей внешней обёртки.

Источники: [route](../../apps/web/src/app/api/staff/[id]/transfer/route.ts), [HTTP и таблица RPC-ошибок](../../apps/web/src/lib/staffTransferHttpService.ts), [legacy service](../../apps/web/src/lib/staffTransferService.ts), [SQL-определение](../../supabase/migrations/20260918133000_atomic_staff_home_transfer.sql).

### POST `/api/staff/create-from-user`

<!-- api-contract: POST /api/staff/create-from-user -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; проверяется филиал текущего бизнеса |
| Limiter | `normal` |
| Body | `user_id`, `branch_id`; необязательный `is_active`, по умолчанию true. Строгой schema нет, обязательность проверяется truthiness |
| Успех | `data`: `id`, `schedule_initialized`, `schedule_days_created`, `schedule_error` |
| Ошибки | 400 validation при неверном JSON/отсутствии обязательных полей/ошибках auth list или записей; 403 forbidden при недоступном филиале; 404 not_found если user не найден в полученной странице; 500 internal при отсутствии роли staff/ID; исключения — по общей обёртке |

`full_name` из тела не используется: имя берётся из metadata (`full_name`, затем `fullName`), email либо «Без имени». Пользователь ищется только в `listUsers(page: 1, perPage: 200)` — 404 не доказывает отсутствия пользователя за этой страницей.

Существующий staff ищется по **совпадению full_name в бизнесе**, а не по user_id. При совпадении запись переиспользуется; user_id назначается только если он пустой, а имеющаяся связь не заменяется. Поэтому это не контракт «создать ровно одну новую запись или отклонить уже существующего пользователя». Роль переданному user, назначение филиала и legacy-расписание обрабатываются отдельно; часть ошибок только логируется. Explicit scheduling пропускает инициализацию расписания. Успешный ответ не подтверждает согласованность всех этих сущностей.

Источники: [route](../../apps/web/src/app/api/staff/create-from-user/route.ts), [HTTP](../../apps/web/src/lib/staffCreateFromUserHttpService.ts), [service](../../apps/web/src/lib/staffCreateFromUserService.ts).

### POST `/api/staff/update`

<!-- api-contract: POST /api/staff/update -->

Старый статический маршрут. Для интеграций используется `/api/staff/[id]/update` выше.

**Обнаруженная несовместимость исходников:** маршрут `/api/staff/update` не содержит `[id]`, но HTTP-helper первым действием требует `getRouteParamUuid(context, 'id')`. ID из body/query не читается. При обычном внешнем вызове без этого route-параметра цепочка выбрасывает `Missing required route parameter: id`; внешняя обёртка классифицирует его как 500 internal. Runtime здесь не проверялся; документировать этот маршрут как рабочую альтернативу нельзя.

Limiter — `normal` (429 возможен до helper). За проверкой ID код предусматривает Manager direct и дополнительную проверку роли owner/admin/manager, Body с `full_name`, `branch_id`, `is_active`, optional `email`/`phone` и условный успех `data: { user_linked }`. Этот внутренний контракт не устраняет несовместимость пути и не означает, что тело с `id` позволит его вызвать.

Источники: [route](../../apps/web/src/app/api/staff/update/route.ts), [HTTP](../../apps/web/src/lib/staffUpdateHttpService.ts), [внутренний service](../../apps/web/src/lib/staffUpdateService.ts), [routeParams](../../apps/web/src/lib/routeParams.ts).

### POST `/api/staff/avatar/upload`

<!-- api-contract: POST /api/staff/avatar/upload -->

| Часть | Контракт |
| --- | --- |
| Доступ | Staff cookie; меняется аватар сотрудника из контекста |
| Вход | `multipart/form-data`, поле `file` |
| Проверки | Файл присутствует, заявленный MIME начинается с `image/`, размер не более 5 × 1024 × 1024 байт |
| Limiter | Нет в route |
| Успех | `data: { url: string }`; верхнеуровневого `avatar_url` нет |
| Ошибки | 400 validation при проверке файла, ошибке Storage upload или записи URL; Storage-ошибка может попасть в `details`; исключения formData/контекста — по общей обёртке |

Проверка `image/*` не является проверкой содержимого/декодированием изображения; runtime-тип значения `file` строго не проверяется. Старый объект Storage пытаются удалить **до** загрузки нового. Затем загружается `avatars/staff-avatars/<staffId>-<timestamp>.<extension>`, строится public URL и записывается staff.avatar_url. Это разные операции; сбой может оставить старый URL без объекта или новый объект без обновлённого URL. Возвращённый URL сам по себе не подтверждает доступность объекта через настроенный Storage.

Источники: [route](../../apps/web/src/app/api/staff/avatar/upload/route.ts), [HTTP](../../apps/web/src/lib/staffAvatarUploadHttpService.ts), [service](../../apps/web/src/lib/staffAvatarUploadService.ts).

### POST `/api/staff/avatar/remove`

<!-- api-contract: POST /api/staff/avatar/remove -->

| Часть | Контракт |
| --- | --- |
| Доступ | Staff cookie; body/query не читаются |
| Limiter | Нет в route |
| Успех | Обычно только `{"ok":true}`; если URL не найден — `data: { message: "Аватарка не найдена" }` |
| Ошибки | 400 validation при ошибке очистки staff.avatar_url; исключения — по общей обёртке |

Ошибка чтения staff отдельно не проверяется и может выглядеть как отсутствие аватара. Ошибка удаления объекта Storage только логируется, после чего URL в staff очищается; 200 не означает, что файл физически удалён.

Источники: [route](../../apps/web/src/app/api/staff/avatar/remove/route.ts), [HTTP](../../apps/web/src/lib/staffAvatarRemoveHttpService.ts), [service](../../apps/web/src/lib/staffAvatarRemoveService.ts).
## Финансовый дашборд

### GET `/api/dashboard/finance/all`

<!-- api-contract: GET /api/dashboard/finance/all -->

Этот маршрут экспортирует обработчик `/api/dashboard/staff/finance/all`. Это **два пути к одной реализации**, а не разные форматы агрегатов. Доступ, вход, ответ, ограничения и ошибки полностью описаны в следующем разделе; limiter отсутствует в обоих route. Источники: [alias route](../../apps/web/src/app/api/dashboard/finance/all/route.ts), [исходный route](../../apps/web/src/app/api/dashboard/staff/finance/all/route.ts).

### GET `/api/dashboard/staff/finance/all`

<!-- api-contract: GET /api/dashboard/staff/finance/all -->

Доступ — Manager wrapper. Данные выбираются для текущего бизнеса. Limiter в route отсутствует. Query проверяется строгой `financeAllQuerySchema`:

| Поле | Допустимое значение |
| --- | --- |
| `period` | `day`, `month` или `year`; по умолчанию `day` |
| `date` | Необязательно: для day — существующая `YYYY-MM-DD`; для month — `YYYY-MM`; для year — `YYYY`. Год 1900–2100. При отсутствии/пустой строке используется today бизнеса из scoped SQL calendar |
| `branchId` | Необязательный UUID; фильтрует staff по текущему `staff.branch_id`, открытые смены — по `shift.branch_id`, передаётся в RPC |

`week`, `start_date`, `end_date` и `branch_id` не являются этим контрактом: неизвестные поля/неподходящий period отклоняются. SQL проверяет принадлежность branchId к bizId до чтения снимка.

Успех — `data` следующей формы; поля таблицы находятся внутри `data`, не в корне ответа:

| Поле | Содержимое |
| --- | --- |
| `period`, `dateFrom`, `dateTo`, `branchId` | Период, включительные границы `YYYY-MM-DD`, фильтр либо null |
| `branches` | Массив `{ id, name }` филиалов текущего бизнеса |
| `staffStats` | Для каждого staff: `staffId`, `staffName`, `isActive`, `shiftsCount`, `openShiftsCount`, `closedShiftsCount`, `totalAmount`, `totalMaster`, `totalSalon`, `totalConsumables`, `totalLateMinutes` |
| `totalStats` | `totalAmount`, `totalMaster`, `totalSalon`, `totalConsumables`, `totalLateMinutes`, `totalShifts`, `totalOpenShifts`, `totalClosedShifts` |

Пример корректного query: `?period=month&date=2026-10`. Это пример синтаксиса, запрос не выполнялся.

Ошибки: 400 validation для query; 401/403 от manager wrapper; 500 internal при ошибке или неполном RPC-снимке. С 2026-11-10 service-only `read_finance_report_snapshot` возвращает филиалы, staff, агрегаты закрытых смен и полные позиции открытых смен одним SQL-снимком за выбранные день/месяц/год (не более 366 дат). JSON-результат не обрезается PostgREST max_rows. Закрытые суммы берутся из сохранённых итогов; открытые учитываются один раз, включая расходники в доле бизнеса. Фильтр филиала сохраняет закрытые суммы сотрудника после его перевода. [Адаптер](../../apps/web/src/lib/finance/reportSnapshot.ts), [SQL и grants](../../supabase/migrations/20261110110000_reporting_completeness.sql). Проверено в mocked tests и изолированном PostgreSQL на >1000 сущностей; это не замер production-нагрузки.

Источники: [route](../../apps/web/src/app/api/dashboard/staff/finance/all/route.ts), [HTTP](../../apps/web/src/lib/financeAllDashboardHttpService.ts), [service, полная сборка data и диапазона](../../apps/web/src/lib/financeAllDashboardService.ts), [financeAllQuerySchema](../../apps/web/src/lib/validation/schemas.ts).

### GET `/api/dashboard/staff/[id]/finance`

<!-- api-contract: GET /api/dashboard/staff/[id]/finance -->

Устаревающий endpoint: HTTP логирует рекомендацию `/api/staff/finance?staffId={id}`. Он по-прежнему исполняет собственный сервис, поэтому нельзя считать его простым alias нового payload.

| Часть | Контракт |
| --- | --- |
| Доступ | Manager + staff; `id` — UUID |
| Query | Строгая `staffFinanceByIdQuerySchema`: только необязательная календарная `date` в `YYYY-MM-DD`, год 1900–2100; без неё текущая дата |
| Limiter | Нет в route |
| Успех | `data`: `today`, `bookings`, `services`, `allShifts`, `staffPercentMaster`, `staffPercentSalon`, `hourlyRate`, `currentHoursWorked`, `currentGuaranteedAmount`, `isDayOff`, `stats` |
| Ошибки | 400 validation для query/UUID; 401/403 от manager wrapper; 404 not_found при staff-проверке; 500 internal при ошибках смен/истории; прочие исключения — по общей обёртке |

`today` содержит `exists`, `status`, `shift`, `items`; без смены это false/none/null/пустой массив. Вложенная смена и позиции строятся отдельным legacy-сервисом; полная форма — в источнике ниже. Query `period`, `start_date`, `end_date` из старого описания отклоняются. Часть ошибок загрузки позиций/bookings/services сводится к пустым данным; история без пагинации. Нельзя обещать ни тот же формат, ни те же расчёты, что у `/staff/finance`, без сравнения построителей.

Источники: [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/route.ts), [HTTP](../../apps/web/src/lib/deprecatedStaffFinanceHttpService.ts), [legacy service и сборка data](../../apps/web/src/lib/deprecatedStaffFinanceService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts).

Для `allShifts` canonical и legacy finance readers используют [readStaffHistory](../../apps/web/src/lib/finance/staffHistory.ts): один staff+biz, полная история без REST cap, caller RLS, non-success при ошибке. All-time история сохранена для выбора периода в клиенте; её объём не ограничен календарным годом. Закрытые master_share/salon_share — уже итоговые выплаты, гарантия и topup повторно не применяются.

### GET `/api/dashboard/staff/[id]/finance/stats`

<!-- api-contract: GET /api/dashboard/staff/[id]/finance/stats -->

Это подробная статистика со сменами и позициями, а не прежний пример из четырёх итоговых полей. Limiter в route отсутствует.

| Ветка доступа | Поведение |
| --- | --- |
| Заголовок начинается с `Bearer ` | Staff request; UUID пути обязан совпасть со staffId пользователя, иначе 403 forbidden. Staff дополнительно читается с фильтром бизнеса; ошибка/отсутствие — 404 |
| Без такого заголовка | Manager + staff; 401/403 от manager wrapper и 404 при недоступном staff |

| Query | Фактическая обработка |
| --- | --- |
| `period` | `month` или `year` выбирают эти периоды; **любое другое значение**, включая неизвестное, нормализуется в `day` |
| `date` | Необязательно; `YYYY-MM-DD` для day, `YYYY-MM` для month, `YYYY` для year. Проверяются календарь/месяц и год 1900–2100; при отсутствии/пустой строке берётся today бизнеса из scoped SQL calendar |
| Прочие поля | Парсер их не читает; строгой query-schema здесь нет |

Успех: `data: { stats: StaffFinanceStatsPayload }`. Полная форма `stats` — тип **StaffFinanceStatsPayload** в [finance/types.ts](../../apps/web/src/lib/finance/types.ts) и объект `stats` в сервисе. Он включает `period`, `dateFrom`, `dateTo`, `staffName`, количества смен/клиентов, финансовые итоги, признаки гарантированной оплаты и `shifts` с snake_case финансовыми полями и `items`. Соседний тип `StaffFinanceStatsResponse` в том же файле описывает плоскую `stats`; фактический HTTP использует **data.stats**, поэтому этот response-тип не служит точным описанием wire-обёртки.

Ошибки: 400 validation от парсера даты; 500 internal при ошибке основного запроса смен. В Bearer catch `UNAUTHORIZED`/`NO_STAFF_RECORD`/auth-подобные исключения дают 401, остальные — 500 (в том числе исключение неверного UUID этой ветки); manager-ветка неверный UUID передаёт в общую обёртку как 400. Дополняются явными 403/404 выше.

**Календарь и версия:** снимок содержит ledger_revision, timezone, day_start/day_end и day_hours для каждой смены. Начальная дата в обоих web stats hooks берётся из server dateFrom, выбранная человеком дата остаётся буквальной календарной меткой. Устаревшие ответы другого периода/сотрудника не заменяют текущие данные. Открытая гарантия ограничена концом исходного локального дня; закрытая выплата и ставка берутся из сохранённой смены. [SQL календаря и снимка](../../supabase/migrations/20261110131000_shift_hours_adjustment.sql).

**Границы периода:** смены и их полные позиции читаются одним `read_finance_report_snapshot` с dateFrom/dateTo; отдельного добавления сегодняшней смены нет. Ошибка зависимости или неполный снимок — 500, без пустой fallback-map. Закрытые суммы/выплаты берутся из сохранённого результата закрытия; открытые рассчитываются по ledger. Исторические месяц/год, високосный февраль и >1000 позиций проверены локально. `totalClients` по-прежнему считает позиции, а не уникальных людей. [SQL](../../supabase/migrations/20261110110000_reporting_completeness.sql), [read adapter](../../apps/web/src/lib/finance/reportSnapshot.ts).

Источники: [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts), [HTTP и две auth-ветки](../../apps/web/src/lib/staffFinanceStatsHttpService.ts), [service, парсер и расчёты](../../apps/web/src/lib/staffFinanceStatsService.ts), [типы payload](../../apps/web/src/lib/finance/types.ts).

## Акции филиала

Общий контекст четырёх операций — Manager wrapper. UUID пути проходят `getRouteParamUuid`; 400 для неверного UUID, 401/403 от manager wrapper и обработка непредвиденных исключений добавляются к ошибкам ниже. POST/PATCH выполняют `req.json()` без локального catch до manager wrapper: для синтаксически неверного JSON нет отдельной стабильной ветки 400, исключение классифицируется общей обёрткой по тексту.

`PromotionBody`/`PromotionUpdateBody` — TypeScript-типы, а не строгие схемы. Объявленные типы акции: `free_after_n_visits`, `referral_free`, `referral_discount_50`, `birthday_discount`, `first_visit_discount`. Сервис не проверяет входное значение по полному enum; перечисление описывает ожидаемые значения, не подтверждает отказ HTTP на всех прочих.

### POST `/api/dashboard/branches/[branchId]/promotions`

<!-- api-contract: POST /api/dashboard/branches/[branchId]/promotions -->

Создаёт акцию после проверки филиала в текущем бизнесе. Limiter — `normal`.

| Body | Контракт реализации |
| --- | --- |
| `promotion_type`, `title_ru` | Обязательны по truthiness; строгой проверки строк/длины нет |
| `params` | Объект параметров, при falsy используется `{}` |
| `params.visit_count` | Для `free_after_n_visits` требуется number >= 1; ключ **visit_count**, не `n_visits`; целочисленность не проверяется |
| `params.discount_percent` | Для `birthday_discount`/`first_visit_discount` требуется number от 1 до 100 |
| `title_ky`, `title_en`, `description_ru`, `description_ky`, `description_en` | Необязательные локализованные строки; falsy превращается в null |
| `is_active` | По умолчанию true, если поле отсутствует |
| `valid_from`, `valid_to` | Необязательные строки/null; `toNormalizedDateString` берёт начало `YYYY-MM-DD` из даты/ISO, иначе null. Полный календарь и порядок границ этим helper не проверяются |

Успех: `data: { promotion }`, где promotion — возвращённая БД строка после `select('*')`. Поля `promotion_id` в корне нет. Ошибки: 404 not_found при ошибке/отсутствии филиала; 400 validation при перечисленных ручных проверках, иногда `details.field`; 500 internal при ошибке вставки; 429 от limiter и общие ошибки контекста/исключений.

Пример тела, соответствующий ручной валидации:

```json
{
  "promotion_type": "free_after_n_visits",
  "title_ru": "Пятый визит бесплатно",
  "params": { "visit_count": 5 },
  "is_active": true
}
```

Создание строки само по себе не подтверждает применение скидки к бронированиям: это справочник CRUD акции, механизм начисления здесь не проверялся.

Источники: [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts), [HTTP](../../apps/web/src/lib/branchPromotionsHttpService.ts), [service, PromotionBody и validatePromotionBody](../../apps/web/src/lib/branchPromotionsService.ts), [нормализация дат](../../apps/web/src/lib/dateUtils.ts).

### GET `/api/dashboard/branches/[branchId]/promotions`

<!-- api-contract: GET /api/dashboard/branches/[branchId]/promotions -->

| Часть | Контракт |
| --- | --- |
| Вход | UUID `branchId`; query-параметры не читаются |
| Limiter | Нет в route |
| Успех | `data: { promotions }`; массив строк `branch_promotions` с добавленным `usage_count`, сортировка created_at по убыванию |
| Ошибки | 404 not_found при недоступном филиале; 500 internal при ошибке списка; общие ошибки контекста/UUID/исключений |

Выбирает акции филиала и бизнеса без фильтра `is_active` и без пагинации. Для **каждой** акции запускается отдельный count в `client_promotion_usage` через `Promise.all`. Ошибка/отсутствующий count может превратиться в `usage_count: 0`; нулевой счётчик не доказывает отсутствие использований. API не принимает page/limit и не сообщает усечение серверным лимитом строк.

Источники: [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/route.ts), [HTTP](../../apps/web/src/lib/branchPromotionsHttpService.ts), [listBranchPromotions](../../apps/web/src/lib/branchPromotionsService.ts).

### PATCH `/api/dashboard/branches/[branchId]/promotions/[promotionId]`

<!-- api-contract: PATCH /api/dashboard/branches/[branchId]/promotions/[promotionId] -->

| Часть | Контракт |
| --- | --- |
| Вход | UUID `branchId`, `promotionId`; JSON с любым набором полей `PromotionUpdateBody` |
| Limiter | Нет в route |
| Успех | `data: { promotion }`, возвращённая строка БД |
| Ошибки | 404 not_found при отсутствии/ошибке проверки акции с данным филиалом и бизнесом; 400 validation при ручных проверках параметров; 500 internal при ошибке update; общие ошибки контекста/UUID/JSON |

Все поля POST-формы необязательны; изменяются только переданные поля. `params` заменяется целиком, не объединяется с прежним объектом. При переданных `promotion_type`/`params` проверяются только **присутствующие** `visit_count` или `discount_percent` по тем же диапазонам; смена типа не требует автоматически полного нового params. Непустой `title_ru`, строгий enum типа и непустой patch не проверяются сервисом. Локализованные необязательные строки при falsy становятся null; даты проходят ту же нормализацию, что в POST. Полная форма — `PromotionUpdateBody` в источнике.

Источники: [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts), [HTTP](../../apps/web/src/lib/branchPromotionHttpService.ts), [service и валидация PATCH](../../apps/web/src/lib/branchPromotionService.ts).

### DELETE `/api/dashboard/branches/[branchId]/promotions/[promotionId]`

<!-- api-contract: DELETE /api/dashboard/branches/[branchId]/promotions/[promotionId] -->

| Часть | Контракт |
| --- | --- |
| Вход | UUID обоих параметров пути; body/query не читаются |
| Limiter | Нет в route |
| Успех | Только `{"ok":true}` |
| Ошибки | 404 not_found при отсутствии/ошибке проверки акции в данном филиале/бизнесе; 500 internal при ошибке delete; общие ошибки контекста/UUID/исключений |

После отдельной проверки принадлежности удаляется строка `branch_promotions` по ID. Сервис не делает soft delete и не проверяет отсутствие использований; поведение связанных FK/cascade зависит от фактической схемы БД и здесь не подтверждено. Повторный запрос после удаления обычно попадает в проверку not_found, а не обещает идемпотентный 200.

Источники: [route](../../apps/web/src/app/api/dashboard/branches/[branchId]/promotions/[promotionId]/route.ts), [HTTP](../../apps/web/src/lib/branchPromotionHttpService.ts), [deleteBranchPromotion](../../apps/web/src/lib/branchPromotionService.ts).

## Управление сменами из дашборда

### POST `/api/dashboard/staff/[id]/shift/open`

<!-- api-contract: POST /api/dashboard/staff/[id]/shift/open -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager + staff; `id` — UUID сотрудника |
| Query | Необязательный `date`: существующая `YYYY-MM-DD`; без него business-local today из scoped SQL calendar |
| Body | Не читается |
| Limiter | ingress600/min; после verified manager context user5/min + business300/min |
| Успех | `data: { shift }` |
| Ошибки | 400 validation при неверной дате, отсутствии филиала у новой смены или рабочих часов в explicit-ветке; 409 при future/no-row historical date или SQL-конфликте; 401/403 manager wrapper/RPC; 404 staff-проверки; 500 internal при ошибках чтения/RPC; 429 limiter; прочие исключения — по общей обёртке |

Сервис вызывает тот же checked RPC `open_staff_shift_safe` через authenticated-клиент; его staff/shift locks сериализуют создание и reopen с Save/Close. Все успешные ветки возвращают полную строку shift, включая ledger_revision. Уже открытая смена возвращается без повторной записи.

Новая смена разрешена только за today бизнеса; SQL ставит фактическое opened_at и не принимает придуманное время прошлого дня. Существующая закрытая смена переоткрывается manager: исходные opened_at/expected_start/late_minutes сохраняются, closed_at сбрасывается, revision повышается, закрытые агрегаты пересчитываются. Future дата отвергается даже при наличии строки. Explicit scheduling проверяется при новом открытии; исторический reopen не требует повторно изобретать изменившееся расписание. [Calendar/Open implementation](../../supabase/migrations/20261110114000_finance_calendar.sql).

Источники: [route](../../apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts), [HTTP](../../apps/web/src/lib/dashboardStaffShiftOpenHttpService.ts), [service](../../apps/web/src/lib/dashboardStaffShiftOpenService.ts).

### POST `/api/dashboard/staff-shifts/[id]/update-hours`

<!-- api-contract: POST /api/dashboard/staff-shifts/[id]/update-hours -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager wrapper передаёт проверенный userId как actor. UUID смены валидируется; SQL повторно проверяет actor, бизнес и статус под блокировкой |
| Body | Строгий JSON: конечное number hours_worked 0–25 и обязательный целый expectedRevision ≥0. Часы округляются до двух знаков; фактический предел — длина локального дня смены (23/24/25) |
| Limiter | normal |
| Успех | data: { shift } с канонической полной строкой и повышенным ledger_revision |
| Ошибки | 400 JSON/schema/UUID/выход за локальный день; 401/403 контекст или actor; 404 смена отсутствует в бизнесе; 409 устаревшая версия или переоткрытие; 500 запись не подтверждена; 429 limiter |

```json
{ "hours_worked": 8.5, "expectedRevision": 7 }
```

Сверено по исходникам и изолированным synthetic PostgreSQL/UI/service tests 10 ноября 2026; это не свидетельство deployment. Клиент получает revision, timezone и day_hours вместе с финансовым снимком, захватывает исходную версию при открытии редактора и не заменяет её при фоновом обновлении. Во время запроса ввод блокируется; 409 или неподтверждённый результат сохраняют черновик и требуют явного discard/reload. Автоматического переноса ввода на новую версию нет.

Сервис читает scoped snapshot и вызывает общий calculateShiftFinancials с сохранёнными total_amount, consumables_amount, percent_master/percent_salon и hourly_rate. Текущие условия сотрудника не переоценивают закрытую смену. Service-only command блокирует staff → shift, повторно проверяет closed + expectedRevision и границы дня по TZ бизнеса, затем атомарно меняет часы/выплаты и пересчитывает day/month/year aggregates. Ledger, cash totals и исторические ставки не переписываются. Ошибка агрегатов откатывает всю команду, включая revision. Обычный день не допускает 25 часов.

Источники: [route](../../apps/web/src/app/api/dashboard/staff-shifts/[id]/update-hours/route.ts), [HTTP](../../apps/web/src/lib/dashboardStaffShiftUpdateHoursHttpService.ts), [service](../../apps/web/src/lib/dashboardStaffShiftUpdateHoursService.ts), [core-domain calculation](../../packages/core-domain/src/finance/shift.ts), [UI editor](../../apps/web/src/app/dashboard/staff/[id]/finance/components/StaffFinanceShiftCard.tsx), [SQL command и snapshot](../../supabase/migrations/20261110131000_shift_hours_adjustment.sql), [isolated SQL regression](../../scripts/test-shift-hours-adjustment-isolated.mjs).
