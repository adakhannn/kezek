# API: бронирования, филиалы, услуги, отзывы и профиль

Статус: reference. Владелец: engineering. Статическая сверка: **2026-11-01**. Runtime: **NOT_RUN**.

Этот справочник описывает 15 методов из соответствующих разделов прежнего общего справочника API. Контракт проверен по цепочке route → HTTP adapter → service → используемый validator; для расписания отдельно указана зависимость от SQL и флага. Наличие кода не доказывает, что миграции применены или что сценарий работает в развёрнутой среде. HTTP-запросы, тесты и изменения данных при подготовке документа не выполнялись.

Навигация: [общий справочник API](../../API_DOCUMENTATION.md), [индекс документации](../README.md), [текущий статус проекта](../PROJECT_STATUS.md), [правила проверок](../../TESTING_GUIDE.md). Этот документ не меняет приёмку WEB и не возобновляет закрытую кампанию.

## Методы и общие правила

| Метод | Доступ в обработчике | Локальный limiter |
| --- | --- | --- |
| `POST /api/quick-hold` | Bearer или cookie-сессия пользователя | `public` |
| `POST /api/quick-book-guest` | Без пользовательской сессии | `public` |
| `POST /api/bookings/[id]/mark-attendance` | Контекст управления бизнесом | `normal` |
| `POST /api/bookings/[id]/cancel` | Владелец брони или управление её бизнесом | Нет wrapper |
| `POST /api/bookings/internal` | Verified user + SQL authority конкретного бизнеса/филиала/сотрудника | Ingress normal + verified-user budget |
| `POST /api/branches/create` | Контекст бизнеса + его владелец или superadmin | `critical` |
| `POST /api/branches/[id]/delete` | Контекст бизнеса + superadmin | Нет wrapper |
| `POST /api/branches/[id]/schedule` | Контекст управления бизнесом | `normal` |
| `GET /api/branches/[id]/schedule` | Контекст управления бизнесом | Нет wrapper |
| `POST /api/services/create` | Контекст управления бизнесом | `normal` |
| `POST /api/services/[id]/update` | Контекст управления бизнесом | `normal` |
| `POST /api/services/[id]/delete` | Контекст управления бизнесом | Нет wrapper |
| `POST /api/reviews/create` | Cookie-сессия, собственная бронь | `normal` |
| `POST /api/reviews/update` | Cookie-сессия, собственный отзыв | `normal` |
| `POST /api/profile/update` | Cookie-сессия | `normal` |
| `POST /api/user/update-phone` | Cookie-сессия | `auth` |

### Сессии и контекст бизнеса

В этой группе только `quick-hold` явно читает `Authorization: Bearer …` через [requestAuthContext.ts](../../apps/web/src/lib/requestAuthContext.ts). При непустом неверном Bearer-токене cookie fallback не используется. Остальные защищённые методы используют cookie-клиент из [supabaseHelpers.ts](../../apps/web/src/lib/supabaseHelpers.ts); наличие Bearer-заголовка само по себе не описывает поддерживаемую ими авторизацию.

«Контекст управления бизнесом» означает [getBizContextForManagers](../../apps/web/src/lib/authBiz.ts) и [resolver](../../apps/web/src/lib/bizContextResolver.ts): текущий бизнес и проверенные роли `owner`, `admin`, `manager`, либо `businesses.owner_id`; superadmin должен иметь выбранный бизнес. Точные приоритеты и проверки находятся в [bizContextResolutionStrategies.ts](../../apps/web/src/lib/bizContextResolutionStrategies.ts). `biz_id` для административных операций берётся из этого контекста, а не из произвольного поля тела. Затем перечисленные management services используют серверный service-role клиент и собственные проверки принадлежности ресурсов.

Не следует считать статусы отказа управления унифицированными: прямой вызов resolver бросает `UNAUTHORIZED`, `NO_BIZ_ACCESS` или `AUTH_SERVICE_UNAVAILABLE`, а [apiErrorHandler.ts](../../apps/web/src/lib/apiErrorHandler.ts) классифицирует `Error` по тексту. В этой цепочке `UNAUTHORIZED` и `AUTH_SERVICE_UNAVAILABLE` попадают в `401 / auth`, `NO_BIZ_ACCESS` — в `500 / internal`. Явные проверки доступа внутри services возвращают указанные ниже `403` или другие статусы. Это описание текущего поведения, не рекомендуемый контракт ошибок.

### Ответы, JSON и ограничения частоты

Все перечисленные успешные ответы имеют HTTP **200**. [createSuccessResponse](../../apps/web/src/lib/apiErrorHandler.ts) помещает переданные данные в `data`; дополнительные поля attendance находятся в корне. Ответ без данных — `{"ok":true}`. Поле `data` не надо добавлять клиентским предположением.

Обычная ошибка имеет shape `{ ok: false, error: string, message?: string, details?: unknown }`. Дополнительно к перечисленным ошибкам возможен `500 / internal` для необработанных исключений. Формат невалидного JSON зависит от адаптера: `validateRequest` возвращает `400 / validation`, `req.json().catch(() => ({}))` передаёт пустое тело в ручную проверку, прямой `req.json()` передаёт исключение общему обработчику и может дать `500`. Источники: [apiValidation.ts](../../apps/web/src/lib/validation/apiValidation.ts), [apiErrorHandler.ts](../../apps/web/src/lib/apiErrorHandler.ts).

В [rateLimit.ts](../../apps/web/src/lib/rateLimit.ts) пресеты: public10/мин, normal30/мин, critical5/мин, auth5/15мин. С 2026-11-10 каждый wrapper получает обязательный стабильный routeId; HTTP methods имеют отдельные budgets, query и UUID не создают новый counter. Production требует Redis и подтверждённый trusted ingress для IP scope: missing/error дают503 до handler, превышение —429. Process fallback в production отсутствует. Детали — [RATE_LIMITING](../../RATE_LIMITING.md); эти значения не являются измерением ёмкости.

Limiter добавляет `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`; при отказе — HTTP `429`, `Retry-After` и shape `{ ok: false, error: "rate_limit_exceeded", message: string, retryAfter: number }`. «Нет wrapper» означает отсутствие `withRateLimit` именно в route, а не доказанное отсутствие внешних ограничений.

JSON-примеры ниже показывают форму данных; UUID, имена и даты условные. Они не являются командами для отправки в существующую среду.

## Бронирования

<!-- api-contract: POST /api/quick-hold -->
### POST `/api/quick-hold`

Источники: [route](../../apps/web/src/app/api/quick-hold/route.ts) → [HTTP](../../apps/web/src/lib/quickHoldHttpService.ts) → [service](../../apps/web/src/lib/quickHoldService.ts) → [atomic command adapter](../../apps/web/src/lib/bookingRequestService.ts) → [service-only SQL boundary](../../supabase/migrations/20261110123000_service_only_booking_commands.sql). Схемы: `quickHoldSchema` в [bookingSchemas.ts](../../apps/web/src/lib/validation/bookingSchemas.ts), [общие схемы](../../apps/web/src/lib/validation/schemas.ts), [доменная валидация](../../packages/core-domain/src/booking/validation.ts).

Контракт обновлён 2026-11-10; локальные unit/isolated SQL проверки выполнены, remote rollout не подтверждён этим справочником. Доступ: пользователь с проверенной Bearer или cookie-сессией; HTTP limiter `public`. Обязателен заголовок `Idempotency-Key` — UUID v4, созданный и сохранённый клиентом **до** отправки. Тело JSON:

| Поле | Обязательность и проверка |
| --- | --- |
| `biz_id`, `staff_id` | Обязательные UUID |
| `branch_id` | Необязательный UUID; без него атомарная SQL-команда выбирает первый активный филиал бизнеса по ID |
| `service_id` | UUID; обязателен, если нет непустого `services` |
| `services` | Необязательный массив `{ service_id: UUID, duration_min: positive integer, order_index?: integer >= 0 }`; переданный пустой массив отклоняет доменная проверка, даже при наличии `service_id` |
| `start_at` | Обязательная строка: `YYYY-MM-DDTHH:mm:ssZ`, с offset `+06:00` или `+0600`; дробные секунды схема не принимает. После regex домен проверяет разбираемость даты |

Если `service_id` отсутствует, он подставляется из первого элемента `services`. Непустой `services`, в том числе из одного элемента, выбирает внутреннюю complex-ветку; без него используется single-service ветка. `order_index` по умолчанию равен индексу элемента. После auth и валидации HTTP создаёт service client и передаёт `authContext.user.id` отдельным `p_actor_id`; поля identity в JSON не определяют автора. SQL получает явного actor, не меняет JWT claims и записывает `client_id` сразу при INSERT. Создание, подтверждение, receipt и outbox выполняются одной транзакцией.

```json
{
  "biz_id": "11111111-1111-4111-8111-111111111111",
  "branch_id": "22222222-2222-4222-8222-222222222222",
  "service_id": "33333333-3333-4333-8333-333333333333",
  "staff_id": "44444444-4444-4444-8444-444444444444",
  "start_at": "2027-01-15T10:00:00+06:00"
}
```

Ответ:

```json
{
  "ok": true,
  "data": {
    "booking_id": "55555555-5555-4555-8555-555555555555",
    "confirmed": true
  }
}
```

Ошибки: `401 / auth`; `400 / validation` для identity headers, JSON/схемы/доменного входа и известных SQL validation errors; `409 / booking_slot_unavailable`; `409 / booking_request_conflict` для повторного request ID с другим caller или эффективным payload; `503 / service_unavailable` для неопределённого результата/неизвестной SQL ошибки; `429` от limiter. После потери ответа/503 повторяются **тот же** ключ и payload: [durable receipt](../../supabase/migrations/20261110101000_atomic_booking_requests.sql) возвращает первоначальный результат. Новый ключ означает новую попытку бронирования. HTTP успех подтверждает транзакцию и enqueue, а не внешнюю доставку уведомления.

Прямой `create_confirmed_booking` с anon/authenticated ключом запрещён: старая three-argument функция отозвана, four-argument доступна только service role. Таким образом создание проходит через HTTP boundary с limiter; ключ service role остаётся только на сервере.

HTTP RPC deadline — 10 секунд, SQL lock timeout — 5 секунд, route maxDuration — 30 секунд. Timeout не доказывает rollback: клиент сохраняет request identity и повторяет ту же команду; сервер не делает внутреннего retry.

<!-- api-contract: POST /api/quick-book-guest -->
### POST `/api/quick-book-guest`

Источники: [route](../../apps/web/src/app/api/quick-book-guest/route.ts) → [HTTP](../../apps/web/src/lib/quickBookGuestHttpService.ts) → [service](../../apps/web/src/lib/quickBookGuestService.ts); `quickBookGuestSchema` в [bookingSchemas.ts](../../apps/web/src/lib/validation/bookingSchemas.ts) и [доменный validator](../../packages/core-domain/src/booking/validation.ts).

Контракт обновлён 2026-11-10. Доступ HTTP публичный; после валидации используется серверный service client, `p_actor_id = NULL`. Limiter `public`. Требуются `Idempotency-Key` UUID v4 и `X-Booking-Client-Token` — случайный секрет из 64 lowercase hex символов. Клиент сохраняет оба значения до POST; секрет не передаётся в логи. Формат `biz_id`, `staff_id`, `service_id` / `services`, `start_at` совпадает с `quick-hold`, но **`branch_id` обязателен**. Дополнительные поля:

| Поле | Проверка |
| --- | --- |
| `client_name` | Обязательная строка 2–100 символов; домен затем обрезает пробелы и требует непустое имя |
| `client_phone` | Обязательная строка E.164 по `^\+[1-9]\d{7,14}$`; произвольный локальный формат до нормализации не принимается |
| `client_email` | Необязательный email, максимум 255 символов, допускается `null` |

```json
{
  "biz_id": "11111111-1111-4111-8111-111111111111",
  "branch_id": "22222222-2222-4222-8222-222222222222",
  "service_id": "33333333-3333-4333-8333-333333333333",
  "staff_id": "44444444-4444-4444-8444-444444444444",
  "start_at": "2027-01-15T10:00:00+06:00",
  "client_name": "Пример клиента",
  "client_phone": "+996555123456",
  "client_email": null
}
```

Ответ имеет тот же envelope: `{ ok: true, data: { booking_id: string, confirmed: true } }`. Филиал проверяется на принадлежность бизнесу и `is_active`. В отличие от `quick-hold`, `hold_complex_slot_guest` выбирается только при `services.length > 1`; иначе вызывается `hold_slot_guest`. Выбор ветки, confirm, receipt и enqueue выполняются внутри одной атомарной SQL-команды.

Ошибки: `400 / validation` для headers/JSON/схемы/доменных и известных SQL validation errors; `409 / booking_slot_unavailable` или `booking_request_conflict`; `503 / service_unavailable` при неопределённом результате или внутреннем отказе; `429` от limiter. Секрет гостевого запроса хешируется в receipt и привязывает replay к инициатору; тот же request ID с другим секретом или payload отклоняется. Поля `client_id`/`p_actor_id` в теле не переводят гостя в authenticated flow. После сетевого сбоя повторяют тот же ключ, секрет и payload. Команда либо фиксирует всю бронь с подтверждением и outbox, либо откатывается; отсутствие ответа всё равно требует replay, поскольку commit мог уже завершиться.

<!-- api-contract: POST /api/bookings/[id]/mark-attendance -->
### POST `/api/bookings/[id]/mark-attendance`

Сверено по исходникам и изолированным API/SQL-тестам 10 ноября 2026. Источники: [route](../../apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts) → [HTTP](../../apps/web/src/lib/markAttendanceHttpService.ts) → [service](../../apps/web/src/lib/markAttendanceService.ts) → [атомарная команда](../../supabase/migrations/20261110130000_booking_attendance_command.sql).

Доступ: business manager context; limiter normal. ID пути проверяется как UUID. Строгая [markAttendanceSchema](../../apps/web/src/lib/validation/schemas.ts) принимает только обязательный boolean attended. Сервер передаёт verified userId, bizId и bookingId service-only RPC; NULL actor или чужой бизнес запрещены в SQL.

Для изменения нужен hold/confirmed и start_at строго раньше момента команды. attended=true выбирает paid, false — no_show. Совпадающий финальный статус возвращает сохранённый receipt без нового списания. Противоположный финальный статус, cancelled, существующая противоречивая позиция ledger или использованная льгота требуют ручной финансовой проверки (409). Paid означает отметку посещения; команда не создаёт позицию смены или кассовый платёж.

Успех200 имеет корневые поля (без data): ok=true, status, promotion_applied, subscription_applied, promotion_info. Последнее — null либо объект с title, discount_percent, discount_amount, final_amount. Поля читаются из сохранённых promotion_applied/subscription_applied; точный повтор возвращает тот же результат, даже если пакет уже списан.

| Ошибка | Условие |
| --- | --- |
| 400 validation | Неверные UUID/JSON/тело либо ещё не наступившее время начала |
| 403 forbidden | Actor не руководитель этого бизнеса или booking принадлежит другому бизнесу |
| 404 not_found | Booking отсутствует |
| 409 validation | Несовместимый статус/ledger/льгота или конкурентное изменение |
| 500 internal | Ошибка SQL/применения льготы, отсутствующая функция, неполный receipt или неизвестный исход операции |

Команда блокирует staff → booking в том же порядке, что Save/Close. Статус, применение пакета/акции и receipt входят в одну транзакцию. Ошибка применения льготы откатывает статус, остаток пакета и usage. Прямого UPDATE fallback нет; legacy status/apply RPC недоступны public/anon/authenticated/service_role и вызываются только внутренними owner-context SQL-командами. Сам endpoint не отправляет уведомлений. [Изолированный runner](../../scripts/test-attendance-command-isolated.mjs) проверяет настоящий overlap, ровно одно списание, actor/tenant/ACL и rollback; это не утверждение о deployment.

<!-- api-contract: POST /api/bookings/internal -->
### POST `/api/bookings/internal`

Сверено по исходникам 2026-11-10. [Route](../../apps/web/src/app/api/bookings/internal/route.ts) → [HTTP](../../apps/web/src/lib/internalBookingHttpService.ts) → [command adapter](../../apps/web/src/lib/bookingRequestService.ts) → [SQL receipt](../../supabase/migrations/20261110133000_internal_booking_requests.sql). [Строгая схема](../../apps/web/src/lib/internalBookingSchema.ts), [browser adapter](../../apps/web/src/lib/internalBookingClient.ts).

Обязателен `Idempotency-Key` UUIDv4. Auth — проверенный bearer/cookie. Actor берётся только из auth; `client_id` означает клиента записи, не автора команды. Доступ имеют owner/business manager, admin выбранного филиала, активный назначенный сотрудник для своего staff_id, platform admin. Неавторизованные direct RPC и прямые записи в bookings запрещены.

Общие поля: `mode`, `biz_id`, `branch_id`, `staff_id`, `start_at` ISO datetime, `client_id` UUID/null, `client_name` строка до 100/null, `client_phone` строка до 32/null; необязательный `client_email` email до 254/null. `mode:"simple"` требует `service_id` UUID и `duration_min` 1..1440. `mode:"complex"` требует 1..20 элементов `services` с `service_id`, `duration_min` 1..1440 и optional `order_index` 0..19; SQL ограничивает общую длительность 1440 минут. Неизвестные поля отклоняются.

Успех: `{"ok":true,"data":{"booking_id":"00000000-0000-4000-8000-000000000001","confirmed":true}}`. В одной транзакции создаются запись, состав услуг, receipt и notification outbox. Повтор той же identity/actor/payload возвращает ту же запись. Изменённый автор или payload — 409 `booking_request_conflict`; занятый слот — 409; отсутствие полномочий — 403; invalid input/entity — 400; auth — 401; лимит — 429; limiter/DB/network uncertainty — 503. HTTP command deadline 10 секунд, SQL lock timeout 5 секунд, route maxDuration 30 секунд.

Browser сохраняет только request ID под хешем actor/action/payload в sessionStorage до подтверждённого ответа; payload/контакты/token туда не записываются. Потерянный ответ сохраняет identity для повторной попытки после перезагрузки вкладки. Новая вкладка/очищенное хранилище не восстанавливают утраченную identity. При недоступном хранилище POST не выполняется. Старые internal simple/complex RPC недоступны browser-ролям после этой миграции: rollout требует обновлённого клиента. Локальные mock/SQL проверки выполнены; deployed HTTP и реальные provider calls этим документом не подтверждаются.

<!-- api-contract: POST /api/bookings/[id]/cancel -->
### POST `/api/bookings/[id]/cancel`

Источники: [route](../../apps/web/src/app/api/bookings/[id]/cancel/route.ts) → [HTTP](../../apps/web/src/lib/bookingCancelHttpService.ts) → [route service](../../apps/web/src/lib/bookingCancelRouteService.ts) → [server cancellation](../../apps/web/src/lib/serverCancelBookingService.ts).

Доступ: cookie-сессия. Разрешён владелец брони (`client_id === user.id`) либо пользователь, чей management context подтверждает принадлежность брони бизнесу. `[id]` — UUID; тело не читается. Поле `reason` не сохраняется и не является частью реализованного входа. Локального limiter wrapper нет.

Успех: `{"ok":true}`; `booking_id`, `cancelled` и `already_cancelled` наружу не добавляются. Уже отменённая бронь возвращает тот же успех без повторной отмены.

Ошибки: невалидный UUID — `400 / validation`; отсутствие пользователя — **`403 / forbidden`**; отсутствующая/невидимая при выборке бронь — `404 / not_found`; нет доступа — `403 / forbidden`. Отмена paid, записи с позицией смены или применённой льготой возвращает `409 / financial_reversal_required` с указанием обратиться в организацию для финансового возврата. Другой недопустимый статус — `409 / not_cancellable`, конкурентная смена принадлежности — `409 / booking_changed`. Прочие RPC-ошибки проходят общий mapper.

Эффекты: проверяемый `cancel_booking` меняет только hold/confirmed; DB trigger записывает notification outbox в той же транзакции. Последующий dispatch повторяет enqueue с тем же ключом. Прямых UPDATE fallback нет. Shared SQL helper блокирует staff→booking и проверяет verified actor/точный филиал/назначенного сотрудника; browser DML таблицы отозван. Ошибка финансовой проверки не меняет статус, ledger, льготы и outbox. Доступность выбранной брони также зависит от видимости в cookie-клиенте до management fallback.

## Филиалы

<!-- api-contract: POST /api/branches/create -->
### POST `/api/branches/create`

Источники: [route](../../apps/web/src/app/api/branches/create/route.ts) → [HTTP](../../apps/web/src/lib/branchCreateHttpService.ts) → [service и тип BranchCreateBody](../../apps/web/src/lib/branchCreateService.ts), [контактный validator](../../apps/web/src/lib/businessContacts.ts).

Доступ: management context, затем отдельная проверка `businesses.owner_id` или `is_super_admin`; одной роли manager/admin недостаточно. Limiter `critical`. JSON parse failure заменяется `{}`; полноценной Zod-схемы тела нет.

| Поле | Текущая обработка |
| --- | --- |
| `name` | Обязательная строка, trim, непустая; отдельного ограничения 2–100 в service нет |
| `address` | Необязательная строка / `null` |
| `is_active` | Необязательно, по умолчанию `true` |
| `lat`, `lon` | Необязательные координаты; проверяются и конвертируются только когда обе не `null`/`undefined`; одна переданная координата не создаёт точку |
| `directory_links` | Необязательный объект со строками / `null`: `instagram`, `two_gis`, `google_maps`, `yandex_maps`; значения обрезаются, пустые становятся `null` |
| `contact_phone`, `contact_whatsapp` | Необязательные публичные телефоны; нормализация до `+digits` и проверка E.164 |
| `contact_email` | Необязательная строка / `null`; trim, lowercase, проверка email и длины до 254 |
| `website_url` | Необязательная HTTPS-ссылка / `null` |
| `inherit_business_contacts` | Наследование контактов включено, если значение не `false` |

```json
{
  "name": "Центральный филиал",
  "address": "Пример адреса",
  "is_active": true,
  "inherit_business_contacts": true,
  "directory_links": {"instagram": null, "two_gis": null, "google_maps": null, "yandex_maps": null}
}
```

Обычный успех: `{ ok: true, data: { id: string } }`; полного объекта филиала в ответе нет. При этом service возвращает `data?.id` без дополнительной проверки, поэтому его TS-тип допускает `null`/`undefined` и отсутствие `id` в сериализованном ответе. Создаётся одна запись `branches` текущего бизнеса. При отсутствии явных непустых directory links и других филиалов service может взять ссылки из первой заявки регистрации данного бизнеса.

Ошибки: права — `403 / forbidden`; имя, координаты, контакты и обычные ошибки insert — `400 / validation`; распознанный `BRANCH_LIMIT_REACHED:` с двумя числовыми значениями — `409 / conflict`; общие ошибки context и `429`. TypeScript-тип не заменяет runtime-схему: неверный тип некоторых полей может привести к исключению вместо `400`.

<!-- api-contract: POST /api/branches/[id]/delete -->
### POST `/api/branches/[id]/delete`

Источники: [route](../../apps/web/src/app/api/branches/[id]/delete/route.ts) → [HTTP](../../apps/web/src/lib/branchDeleteHttpService.ts) → [проверка роли](../../apps/web/src/lib/branchDeleteRouteService.ts) → [delete service](../../apps/web/src/lib/branchDeleteService.ts).

Доступ: management context и **superadmin**. `[id]` — UUID, тело не используется; локального limiter wrapper нет. Это физическое удаление, а не установка `is_active: false`.

Проверки: филиал должен принадлежать текущему бизнесу; отсутствие активных услуг, активных сотрудников и неотменённых броней филиала. Проверка броней не ограничена будущими датами. Дополнительно проверяются брони неактивных услуг, которые service собирается удалить.

Успех: `{"ok":true}`. Перед удалением филиала сервис может перенести неактивных сотрудников в другой активный филиал того же бизнеса, удалить отменённые брони неактивных услуг и сами неактивные услуги. Ошибки переноса в некоторых ветках только логируются; удаления выполняются отдельными запросами. Ответ с ошибкой не гарантирует, что все предыдущие шаги откатились.

Ошибки: отсутствие superadmin — `403 / forbidden`; невалидный UUID, ошибка принадлежности/поиска — `400 / validation`; связанные активные ресурсы или неотменённые брони — **`400 / conflict`**, а не универсальный `409`; ошибки cleanup/delete — `400 / internal` либо `400 / conflict` по ветке. Для блокировки бронями `details` содержит counts и до пяти примеров (`total`, `active`, `cancelled`, `bookings`). Дополнительно действуют общие ошибки context.

<!-- api-contract: POST /api/branches/[id]/schedule -->
### POST `/api/branches/[id]/schedule`

Источники: [route](../../apps/web/src/app/api/branches/[id]/schedule/route.ts) → [HTTP](../../apps/web/src/lib/branchScheduleHttpService.ts) → [legacy service и типы](../../apps/web/src/lib/branchScheduleService.ts); [флаг](../../apps/web/src/lib/scheduling/config.ts), [SQL replace_branch_schedule](../../supabase/migrations/20260918130000_explicit_staff_schedules.sql).

Доступ: management context; `[id]` — UUID; limiter `normal`. Тело: `{ schedule: Array<{ day_of_week: number, intervals: Array<{start: string, end: string}>, breaks: Array<{start: string, end: string}> }> }`. Нумерация дней здесь `0` — воскресенье, `1` — понедельник, …, `6` — суббота. Время интервалов задаётся строками `HH:mm`; это недельные часы, не UTC timestamps.

```json
{
  "schedule": [
    {"day_of_week": 0, "intervals": [], "breaks": []},
    {"day_of_week": 1, "intervals": [{"start": "09:00", "end": "18:00"}], "breaks": [{"start": "13:00", "end": "14:00"}]},
    {"day_of_week": 2, "intervals": [], "breaks": []},
    {"day_of_week": 3, "intervals": [], "breaks": []},
    {"day_of_week": 4, "intervals": [], "breaks": []},
    {"day_of_week": 5, "intervals": [], "breaks": []},
    {"day_of_week": 6, "intervals": [], "breaks": []}
  ]
}
```

Существуют два разных пути исполнения; фактическое значение флага и состояние БД здесь не проверялись:

- При `SCHEDULE_V2_ENABLED === "true"` вызывается `replace_branch_schedule`. SQL проверяет право actor, активный филиал текущего бизнеса, ровно семь уникальных дней `0..6` и каждый день через `schedule_validate_day`. Он заменяет часы в одной функции и проверяет конфликты с актуальными бронями сотрудников, для которых существуют опубликованные версии расписания. Это не доказательство проверки всех legacy-броней.
- Иначе legacy service проверяет принадлежность филиала и только наличие массива `schedule` на уровне входа. Затем отдельными запросами удаляет прежние часы и вставляет дни с непустыми `intervals`. Полная недельная и интервальная валидация на уровне JS отсутствует; ошибка delete не проверяется. Это не атомарная замена. Пример из семи дней подходит по форме обоим путям, но результат хранения выходных дней различается.

Успех: `{"ok":true}`. V2: `SCHEDULE_BOOKING_CONFLICT` — `409 / validation`, остальные ошибки RPC — `400 / validation`. Legacy: отсутствующий/чужой филиал — `404 / not_found`, query/insert/не-массив — `400 / validation`. Невалидный UUID — `400`; ошибки JSON/структуры могут попасть в общий handler; также общие ошибки context и `429`. Описание флага не является инструкцией включать его или применять миграцию.

<!-- api-contract: GET /api/branches/[id]/schedule -->
### GET `/api/branches/[id]/schedule`

Источники: [route](../../apps/web/src/app/api/branches/[id]/schedule/route.ts) → [HTTP](../../apps/web/src/lib/branchScheduleHttpService.ts) → [getBranchSchedule](../../apps/web/src/lib/branchScheduleService.ts).

Доступ: management context; `[id]` — UUID. Тело и query-параметры не используются; limiter wrapper отсутствует. Проверяет филиал в текущем бизнесе, читает `branch_working_hours`, сортирует по `day_of_week`. Данные не дополняются автоматически до семи дней, допустим пустой массив. Этот GET не выбирает отдельную V2-ветку.

```json
{
  "ok": true,
  "data": {
    "schedule": [
      {"day_of_week": 1, "intervals": [{"start": "09:00", "end": "18:00"}], "breaks": []}
    ]
  }
}
```

Ошибки: `400 / validation` для UUID или ошибок query; `404 / not_found` для отсутствующего/чужого филиала; общие ошибки context. Записи расписания этот handler не изменяет.

## Услуги

<!-- api-contract: POST /api/services/create -->
### POST `/api/services/create`

Источники: [route](../../apps/web/src/app/api/services/create/route.ts) → [HTTP](../../apps/web/src/lib/serviceCreateHttpService.ts) → [service и ServiceCreateBody](../../apps/web/src/lib/serviceCreateRouteService.ts).

Доступ: management context; limiter `normal`. `req.json()` при ошибке превращается в `{}`. Валидация ручная; наличие других service-схем в репозитории не делает их частью этого route.

| Поле | Текущая проверка / значение по умолчанию |
| --- | --- |
| `name_ru` | Обязательная строка, trim и непустое значение; сервер здесь не проверяет UI-диапазон 2–100 |
| `name_ky`, `name_en` | Необязательные строки / `null`; trim, пустое и отсутствие становятся `null` |
| `duration_min` | После `Number(...)` целое `>= 1`; numeric string также может пройти |
| `price_from`, `price_to` | После `Number(...)` конечные числа `>= 0`; порядок проверяется, только когда оба положительны |
| `active` | Необязательно, по умолчанию `true` |
| `branch_ids` | Список филиалов; ложные значения фильтруются, дубликаты удаляются; итоговый размер 1–100 |
| `branch_id` | Fallback для одного филиала, если после обработки `branch_ids` список пуст |

Филиалы должны существовать в текущем бизнесе; отдельного требования `is_active` в выборке service нет. `price_from` и `price_to` следует передавать явно числами: coercion не является полной схемой типов.

```json
{
  "name_ru": "Стрижка",
  "name_ky": null,
  "name_en": null,
  "duration_min": 30,
  "price_from": 500,
  "price_to": 800,
  "active": true,
  "branch_ids": ["22222222-2222-4222-8222-222222222222"]
}
```

Ответ:

```json
{
  "ok": true,
  "data": {
    "count": 1,
    "ids": ["33333333-3333-4333-8333-333333333333"]
  }
}
```

Эффект: отдельная строка `services` на каждый выбранный филиал. Это не одна услуга с массивом филиалов в одной записи. Ошибки тела, филиалов и insert — `400 / validation`; для отсутствующих филиалов возможно `details.missing`. Дополнительно общие ошибки context, неожиданных типов и `429`. Полного объекта услуги или единственного `id` ответ не обещает.

<!-- api-contract: POST /api/services/[id]/update -->
### POST `/api/services/[id]/update`

Источники: [route](../../apps/web/src/app/api/services/[id]/update/route.ts) → [HTTP](../../apps/web/src/lib/serviceUpdateHttpService.ts) → [service и ServiceUpdateBody](../../apps/web/src/lib/serviceUpdateRouteService.ts).

Доступ: management context; limiter `normal`. `[id]` проверяется на наличие, но отдельной UUID-проверки в HTTP adapter нет. Это **полная форма изменения группы**, а не PATCH одного поля.

Нужно передать `name_ru` (непустая строка после trim), `duration_min` (именно число, целое `>= 1`), `price_from`, `price_to` (именно конечные числа `>= 0`) и непустой `branch_ids` либо fallback `branch_id`. Ограничение порядка цен применяется, только когда оба положительны. `name_ky` / `name_en` допускают `null`, при отсутствии очищаются. Передавайте `active` явно: service использует `!!body.active`, поэтому отсутствие **выключает** услугу. `branch_ids: []` не переключается на `branch_id`; этот update также не повторяет create-ограничение в 100 филиалов и его deduplication. Поле `service_id`, присутствующее в TS-типе, service не использует.

Пример полного тела — как в create выше. Успех: `{"ok":true}`, без обновлённого объекта.

Сначала target `[id]` проверяется в бизнесе. Затем сервис находит **все услуги этого бизнеса с исходным `name_ru` target**: обновляет выбранные филиалы, добавляет отсутствующие записи, удаляет отвязанные. При FK-ошибке удаления в предусмотренной ветке применяется `active: false`. Это групповая операция по совпадению имени, не гарантированно изменение единственной строки `[id]`.

Ошибки: вход и DB-записи — `400 / validation`; target не найден/чужой/ошибка проверки — `403 / forbidden`; отсутствующие/чужие филиалы — `403 / forbidden` с `details.missing`; будущие неотменённые брони в отвязываемых филиалах — `409 / conflict` с `details.branches`; общие ошибки context и `429`. Update/insert выполняются **до** завершения всех проверок удаления: даже `409` может прийти после части изменений. Общей транзакции в service нет.

<!-- api-contract: POST /api/services/[id]/delete -->
### POST `/api/services/[id]/delete`

Источники: [route](../../apps/web/src/app/api/services/[id]/delete/route.ts) → [HTTP](../../apps/web/src/lib/serviceDeleteHttpService.ts) → [service](../../apps/web/src/lib/serviceDeleteRouteService.ts).

Доступ: management context; `[id]` проверяется на наличие, без отдельной UUID-схемы. Тело не используется; limiter wrapper отсутствует. Операция адресует одну строку услуги, в отличие от update группы по имени.

Блокирует удаление при `bookings.start_at >= now` и `status != cancelled`. Затем **физически удаляет все прошлые брони этой услуги (`start_at < now`) независимо от их статуса**, после чего удаляет саму услугу. Это не только деактивация каталога: операция затрагивает историю записей. Запросы выполняются последовательно без общей транзакции; последующая ошибка удаления услуги не возвращает уже удалённую историю.

Успех: `{"ok":true}`. Ошибки: `404 / not_found` при результате проверки `Resource not found`; другие ошибки принадлежности — `403 / forbidden` с `details.currentBizId`; будущие неотменённые брони — `409 / conflict`, details `{ total, active, cancelled: 0, bookings }`, до пяти примеров; ошибка удаления прошлых броней или услуги — `400 / validation`; общие ошибки context/исключений.

## Отзывы

<!-- api-contract: POST /api/reviews/create -->
### POST `/api/reviews/create`

Источники: [route](../../apps/web/src/app/api/reviews/create/route.ts) → [HTTP](../../apps/web/src/lib/reviewCreateHttpService.ts) → [service и ReviewCreateBody](../../apps/web/src/lib/reviewCreateService.ts).

Доступ: cookie-сессия, бронь должна принадлежать пользователю (`client_id`). Limiter `normal`. Тело: обязательные `booking_id` и `rating`; необязательный `comment: string | null`. Реальная проверка service — truthiness `booking_id` / `rating`: UUID, числовой тип и диапазон 1–5 не проверяются этим HTTP/service-кодом. Число `0` отклоняется как отсутствующее. Возможные ограничения БД нельзя выдавать за подключённую API-схему. Статус брони читается, но **условия paid/прошедший визит здесь не проверяются**.

```json
{
  "booking_id": "55555555-5555-4555-8555-555555555555",
  "rating": 5,
  "comment": "Всё прошло вовремя"
}
```

При отсутствии отзыва создаётся строка; существующий отзыв того же пользователя для этой брони обновляется. Поэтому create имеет семантику create-or-update, а не гарантированный отказ при дубликате. При обновлении пропущенный `comment` становится `null`; обновляется `updated_at`.

```json
{
  "ok": true,
  "data": {
    "id": "66666666-6666-4666-8666-666666666666",
    "updated": false
  }
}
```

`updated: true` означает ветку обновления существующего отзыва. Ошибки: `401 / auth`; отсутствуют обязательные truthy-поля — `400 / validation`; бронь отсутствует или ошибка её query — `404 / not_found`; чужая бронь — `403 / forbidden`; существующий отзыв другого клиента — `409 / conflict`; ошибка insert/update — `400 / validation`; `429` и общая обработка исключений/JSON. Полного объекта review в ответе нет. Триггеры/пересчёт рейтингов вне этой HTTP-цепочки здесь не проверены.

<!-- api-contract: POST /api/reviews/update -->
### POST `/api/reviews/update`

Источники: [route](../../apps/web/src/app/api/reviews/update/route.ts) → [HTTP](../../apps/web/src/lib/reviewUpdateHttpService.ts) → [service и ReviewUpdateBody](../../apps/web/src/lib/reviewUpdateService.ts).

Доступ: cookie-сессия и принадлежность существующего отзыва пользователю; limiter `normal`. Тело требует **`review_id` и `rating`**, проверяемые на truthiness; `comment` необязателен и при отсутствии/`null` очищается. `booking_id` не заменяет `review_id`. Полной runtime-схемы UUID/рейтинга/комментария здесь также нет.

```json
{
  "review_id": "66666666-6666-4666-8666-666666666666",
  "rating": 4,
  "comment": null
}
```

Успех: `{ ok: true, data: { id: string } }`. Обновляются `rating`, `comment`, `updated_at` в одной найденной строке. Ошибки: `401 / auth`; обязательные поля или ошибка update — `400 / validation`; отзыв отсутствует/ошибка его query — `404 / not_found`; чужой отзыв — `403 / forbidden`; `429`; общие JSON/необработанные ошибки.

## Профиль

<!-- api-contract: POST /api/profile/update -->
### POST `/api/profile/update`

Источники: [route](../../apps/web/src/app/api/profile/update/route.ts) → [HTTP](../../apps/web/src/lib/profileUpdateHttpService.ts) → [service и ProfileUpdateBody](../../apps/web/src/lib/profileUpdateService.ts).

Доступ: cookie-сессия; limiter `normal`. JSON читается напрямую, Zod-схемы нет. Все поля TypeScript-типа необязательные, но запрос имеет **заменяющую семантику**, поэтому пустое тело не означает «ничего не менять»:

| Поле | Обработка |
| --- | --- |
| `full_name`, `phone` | Строка / `null`; trim, отсутствие и пустая строка становятся `null`; проверок длины имени и формата телефона здесь нет |
| `notify_email`, `notify_sms` | При отсутствии / `null` — `true`; TS ожидает boolean, полной runtime-проверки типа нет |
| `notify_whatsapp` | Запрошенное значение по умолчанию `true`, но сохраняется включённым только при имеющихся `whatsapp_phone` и `whatsapp_verified` |
| `notify_telegram` | Запрошенное значение по умолчанию `true`, но включение вычисляется по существующим `telegram_id` и `telegram_verified` |
| `notification_emails` | Необязательный `string[]`; при переданном truthy-значении, включая `[]`, вызывается `set_my_notification_email_preferences` с `target_enabled = notify_email`; HTTP/service не валидирует элементы |

```json
{
  "full_name": "Пример клиента",
  "phone": "+996555123456",
  "notify_email": true,
  "notify_sms": false,
  "notify_whatsapp": false,
  "notify_telegram": false,
  "notification_emails": []
}
```

Успех: `{"ok":true}`; объекта пользователя в ответе нет. Сначала upsert в `profiles`, затем при необходимости RPC email preferences, затем `auth.updateUser` для metadata `full_name`. При наличии числового/преобразуемого `telegram_id` в прежних user metadata он также копируется в profile и выставляется `telegram_verified: true`; при этом `notify_telegram` ранее вычислен по состоянию profile до upsert.

Ошибки: `401 / auth`; profile upsert или email-preferences RPC — `400 / validation`; `429`; ошибки JSON/неподходящих типов и исключения — через общий handler. Возвращаемая ошибка `auth.updateUser` не проверяется, поэтому успешный ответ не доказывает синхронизацию metadata. Ошибка email RPC возможна после сохранения profile; общей транзакции нет. Здесь меняется `profiles.phone`, а не Auth phone, и не выполняется OTP-подтверждение.

<!-- api-contract: POST /api/user/update-phone -->
### POST `/api/user/update-phone`

Источники: [route](../../apps/web/src/app/api/user/update-phone/route.ts) → [HTTP](../../apps/web/src/lib/userUpdatePhoneHttpService.ts) → [service](../../apps/web/src/lib/userUpdatePhoneService.ts).

Доступ: cookie-сессия; limiter **`auth`**, 5 / 15 минут с оговоркой об общем ключе выше. Тело JSON требует `phone: string`; строка обрезается и проверяется по `^\+[1-9]\d{7,14}$`.

```json
{"phone": "+996555123456"}
```

Эффект: серверный admin client вызывает `auth.admin.updateUserById` для текущего пользователя с `{ phone, phone_confirm: false }`. Этот маршрут **не подтверждает номер**, не отправляет OTP в собственной service-цепочке и не записывает `profiles.phone`.

Успех: `{"ok":true}`. Ошибки: `401 / auth`; отсутствующий/неверный телефон или ошибка Auth update — `400 / validation`; `429`; невалидный JSON и прочие исключения проходят общий handler. Проверка реального процесса подтверждения номера и синхронизации Auth/profile остаётся отдельной runtime-задачей.

## Границы этого справочника

Поля и побочные эффекты выше описывают наблюдаемый исходный код, включая его неоднородность. Документ не исправляет атомарность операций, полноту валидации, обработку ошибок, политику удаления истории или правдивость `confirmed` в guest flow. Изменение этих контрактов требует отдельной продуктовой задачи и проверки; текущий статус и уже зарегистрированные риски находятся в [PROJECT_STATUS](../PROJECT_STATUS.md) и [ENGINEERING_FINDINGS](../ENGINEERING_FINDINGS.md).

Новые endpoints, не входившие в пять исходных разделов, перечислены в [общем каталоге API](../../API_DOCUMENTATION.md); наличие ссылки на route там не означает, что для него выполнена runtime-приёмка. При изменении перечисленных routes следует обновлять этот справочник вместе с соответствующим source-контрактом.
