# API бизнес-процессов, расписаний и пакетов

Статус: справочник реализации; статическая сверка **1 ноября 2026**. Ответственная роль: разработчик API бизнес-кабинета. Здесь описаны 33 METHOD/path, дополняющие [STAFF_AND_FINANCE](STAFF_AND_FINANCE.md), [BOOKING_AND_CATALOG](BOOKING_AND_CATALOG.md) и [AUTH_AND_INTEGRATIONS](AUTH_AND_INTEGRATIONS.md). Полный список явных route exports — [ROUTE_CATALOG](ROUTE_CATALOG.md); вход в документацию — [API-карта](../../API_DOCUMENTATION.md).

Сверены файлы route, вызываемые HTTP/helpers/services и схемы. SQL приведён как определение в репозитории; его применение на сервере не проверено. Первичная сверка 1 ноября не запускала приложение/DB/тесты. Для обновлённого ниже Close 10 ноября выполнены локальные API-тесты и изолированные SQL-регрессии на синтетических данных; live/deployment не проверялись. Это не runtime-верификация окружения и не закрытие [инженерных рисков](../ENGINEERING_FINDINGS.md). WEB-кампания остаётся закрытой, автоматизация PAUSED; границы работы — [handoff](../WEB_AGENT_HANDOFF.md).

## Содержание

- [Общие соглашения](#общие-соглашения)
- [Контекст бизнеса и данные кабинета](#контекст-бизнеса-и-данные-кабинета)
- [Дополнительные финансы и роли сотрудников](#дополнительные-финансы-и-роли-сотрудников)
- [Расписания и отсутствия](#расписания-и-отсутствия)
- [Планы и клиентские пакеты визитов](#планы-и-клиентские-пакеты-визитов)
- [Заявки на бизнес и роли](#заявки-на-бизнес-и-роли)
- [Обработка заявок и администраторы филиала](#обработка-заявок-и-администраторы-филиала)

## Общие соглашения

`data: …` означает HTTP 200 с обёрткой `ok: true, data: …`; «только ok» — `{"ok":true}`. Стандартная ошибка имеет `ok: false`, `error`, необязательные `message`/`details`. Маршруты заявок и `/dashboard/api` часто возвращают **плоские** ответы с `items`, `id`, `message` или `code`; они отмечены отдельно, нельзя автоматически добавлять `data`.

Manager direct — [getBizContextForManagers](../../apps/web/src/lib/authBiz.ts), использующий cookie-сессию и resolver текущего бизнеса. Manager wrapper — [withManagerContext](../../apps/web/src/lib/withManagerContext.ts), явно отображающий отсутствие сессии в 401, прочие `BizAccessError` в 403. Manager + staff дополнительно проверяет UUID пути и принадлежность staff бизнесу ([helper](../../apps/web/src/lib/withManagerAndStaffContext.ts)); отсутствие/ошибка чтения/несовпадение дают 404. Staff cookie — активный staff пользователя из [staffRoleSync](../../apps/web/src/lib/staffRoleSync.ts), с попыткой добавить отсутствующую роль staff. Bearer-авторизацию эти контексты сами по себе не обещают; исключение finance stats описано в связанном контракте.

Таблицы ошибок перечисляют явные ветки. У маршрутов с `withErrorHandler` к ним добавляется классификация исключений по тексту из [apiErrorHandler](../../apps/web/src/lib/apiErrorHandler.ts): например, `UNAUTHORIZED` → 401, неизвестное исключение → 500. Manager direct не гарантирует 403 для `NO_BIZ_ACCESS`. Где внешней обёртки/catch нет, формат неожиданной framework-ошибки не установлен.

Limiter normal/critical означает вызванный preset. С 2026-11-10 wrapper требует стабильный routeId и разделяет HTTP methods; keyPrefix задаёт дополнительный bounded sub-action. Превышение —429, production missing/error Redis или неподтверждённый trusted ingress —503 до handler. [RATE_LIMITING](../../RATE_LIMITING.md) описывает точные scopes и ограничения; «нет в route/helper» не обещает отсутствие внешнего limiter.

## Контекст бизнеса и данные кабинета

### GET `/api/me/current-business`

<!-- api-contract: GET /api/me/current-business -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Cookie user через `auth.getUser`; query/body не читаются; limiter отсутствует |
| Успех | `data: { currentBizId, businesses }`; businesses — `{ id, name, city, slug }`, city всегда null |
| Ошибки | 401 auth без user; прочие исключения — общая обёртка |
| Ограничения | Список объединяет бизнесы с owner_id пользователя и owner/admin/manager-роли. Отдельного super_admin-допуска здесь нет. Ошибки нескольких запросов не проверяются и могут дать неполный список/нулевой текущий бизнес при 200; выбранный currentBizId отдельно не подтверждается списком |

Записи не изменяются. Используется service client с fallback на пользовательский. Источники: [route](../../apps/web/src/app/api/me/current-business/route.ts), [HTTP](../../apps/web/src/lib/currentBusinessHttpService.ts), [getCurrentBusinessState](../../apps/web/src/lib/currentBusinessService.ts).

### POST `/api/me/current-business`

<!-- api-contract: POST /api/me/current-business -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Cookie user; JSON `bizId` — непустая строка после trim. Отдельной UUID-schema нет |
| Limiter | normal, keyPrefix `api/me/current-business`, без числового override |
| Успех | Только ok; upsert `user_current_business` по user_id |
| Ошибки | 401 auth; 400 validation при пустом bizId; 404 not_found при отсутствии/ошибке lookup бизнеса; 403 forbidden без owner_id либо owner/admin/manager-роли; 500 internal при ошибке upsert |
| Ограничения | Некорректный JSON превращается в `{}` и даёт отсутствие bizId. Внешний catch маршрута также преобразует любое брошенное исключение helper в 400 `Invalid JSON body`, даже если причина иная |

Не выдаёт новую роль, только выбирает разрешённый бизнес. Источники: [route](../../apps/web/src/app/api/me/current-business/route.ts), [HTTP](../../apps/web/src/lib/currentBusinessHttpService.ts), [setCurrentBusinessState](../../apps/web/src/lib/currentBusinessService.ts).

### GET `/api/dashboard/branches/list`

<!-- api-contract: GET /api/dashboard/branches/list -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager wrapper; query не читается; limiter отсутствует |
| Успех | `data` — массив `{ id: string, name: string }` активных филиалов бизнеса, сортировка name |
| Ошибки/ограничения | 401/403 контекста; 500 server с details ошибки БД. Нет пагинации, поэтому массив не гарантирует полноту при серверном ограничении строк |

Источники: [route](../../apps/web/src/app/api/dashboard/branches/list/route.ts), [HTTP](../../apps/web/src/lib/dashboardBranchesListHttpService.ts), [service](../../apps/web/src/lib/dashboardBranchesListService.ts).

### GET `/api/dashboard/analytics/overview`

<!-- api-contract: GET /api/dashboard/analytics/overview -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager wrapper; limiter отсутствует |
| Query | Необязательные `startDate`, `endDate`, regex `YYYY-MM-DD`; end по умолчанию сегодня, start — end минус 30 дней. Schema не strict, неизвестные ключи отбрасываются |
| Успех | `data: { summary, byDay }`; summary содержит period, bookings, funnel, revenue; byDay — camelCase показатели `business_daily_stats` |
| Ошибки | 400 validation для query; 401/403; 500 server при ошибке данных; общие исключения |
| Ограничения | Дополнительно проверяются календарь, start≤end и максимум 366 включительных дат. Читает полный JSON-снимок готовых агрегатов, независимо от REST max_rows, кэширует по бизнесу/периоду на 60 секунд; не пересчитывает исходные bookings и не подтверждает актуальность агрегатов |

Точные поля `summary`/`byDay`: объект `payload` в [service](../../apps/web/src/lib/dashboardAnalyticsOverviewService.ts). Источники: [route](../../apps/web/src/app/api/dashboard/analytics/overview/route.ts), [HTTP/schema](../../apps/web/src/lib/dashboardAnalyticsHttpService.ts), [кэш](../../apps/web/src/lib/simpleCache.ts).

### GET `/api/dashboard/analytics/load`

<!-- api-contract: GET /api/dashboard/analytics/load -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager wrapper; limiter отсутствует |
| Query | `startDate`/`endDate` как у overview; необязательный `branchId` UUID |
| Успех | `data: { bizId, branchId, period, points }`; point: date, hour, bookingsCount, promoBookingsCount, staffCount, uniqueClientsCount |
| Ошибки | 400 validation; 401/403; 500 server при ошибке данных; общие исключения |
| Ограничения | Полный SQL JSON-снимок `business_hourly_load` по bizId и optional branchId; SQL проверяет принадлежность филиала. Максимум 366 календарных дат, start≤end. Без branchId сохраняются отдельные точки филиалов, а поле branch_id в points не возвращается; staff/client counts нельзя считать уникальными между филиалами. Кэш 60 секунд; ошибка зависимости — non-success |

Источники: [route](../../apps/web/src/app/api/dashboard/analytics/load/route.ts), [HTTP/schema](../../apps/web/src/lib/dashboardAnalyticsHttpService.ts), [service](../../apps/web/src/lib/dashboardAnalyticsLoadService.ts).

Общий [read adapter и проверка диапазона](../../apps/web/src/lib/analyticsReportSnapshot.ts), [SQL snapshots](../../supabase/migrations/20261110110000_reporting_completeness.sql). Статическая и изолированная проверка 2026-11-10; применение миграции к удалённой БД здесь не утверждается.

### POST `/api/dashboard/contact-settings`

<!-- api-contract: POST /api/dashboard/contact-settings -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct, затем `is_super_admin` либо проверка owner_id/owner-роли текущего бизнеса |
| Вход | Поля JSON `contact_phone`, `contact_whatsapp`, `contact_email`, `website_url`; строки либо null. Непустой строгий PATCH: меняются только переданные поля |
| Проверки | Телефоны нормализуются и проверяются E.164; email trim/lowercase, формат и длина <=254; website только HTTPS; пустые строки/null очищают переданное поле; пропущенные поля сохраняются |
| Limiter/успех | normal; `data` содержит четыре сохранённых контактных поля |
| Ошибки | 403 forbidden без owner/super; 400 validation с details.field; 400 update_failed при ошибке БД; 404 not_found при отсутствии результата; общие исключения |

**Проверено локально 9–10 ноября:** malformed JSON, пустой объект, неизвестные ключи и неверные типы отклоняются до записи по [schema](../../apps/web/src/lib/validation/businessUpdateSchemas.ts). One-field patch сохраняет остальные контакты; проверки [HTTP boundary](../../apps/web/src/__tests__/api/patchContracts.test.ts) и [service](../../apps/web/src/__tests__/lib/businessContactSettingsService.test.ts). Источники: [route](../../apps/web/src/app/api/dashboard/contact-settings/route.ts), [service](../../apps/web/src/lib/businessContactSettingsService.ts), [нормализация](../../apps/web/src/lib/businessContacts.ts), [isBusinessOwner](../../apps/web/src/lib/staffApplicationApprovalService.ts).

### POST `/api/bookings/client-identities`

<!-- api-contract: POST /api/bookings/client-identities -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct |
| Вход | Строгая schema: `bookingIds` — обязательный массив UUID, максимум 30; пустой допустим |
| Limiter/успех | normal; **плоский** `{ ok: true, identities }`, где элемент — `{ bookingId, name }` |
| Ошибки | 400 validation для JSON/schema; исключения контекста/чтения — общая обёртка, ошибки чтения имён дают 500 |
| Ограничения | Сначала читает bookings пользовательским клиентом с biz_id; затем service client читает профили только для найденных bookings без заполненного client_name. Возвращает только непустые восстановленные имена: пропущенный ID не обязательно ошибка или отсутствие клиента |

Записи не меняются. Источники: [route](../../apps/web/src/app/api/bookings/client-identities/route.ts), [HTTP/schema](../../apps/web/src/lib/dashboardBookingClientIdentityHttpService.ts), [service](../../apps/web/src/lib/dashboardBookingClientIdentityService.ts).

## Дополнительные финансы и роли сотрудников

### GET `/api/dashboard/finance/[id]/stats`

<!-- api-contract: GET /api/dashboard/finance/[id]/stats -->

Локальный re-export `/api/dashboard/staff/[id]/finance/stats`: все входы, две auth-ветки (self Bearer/manager cookie), `data.stats`, ошибки и ограничения периода совпадают с [полным контрактом](STAFF_AND_FINANCE.md#get-apidashboardstaffidfinancestats). Limiter отсутствует. Источники: [alias](../../apps/web/src/app/api/dashboard/finance/[id]/stats/route.ts), [целевой route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/stats/route.ts).

### GET `/api/dashboard/staff/[id]/finance/audit-log`

<!-- api-contract: GET /api/dashboard/staff/[id]/finance/audit-log -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager + staff, UUID пути; query не читается; limiter отсутствует |
| Успех | `data: { entries }`; до 100 записей, changed_at убывает. `AuditLogEntry`: id, changed_at, changed_by_user_id, changed_by_name, field_changes, message |
| Ошибки | 400 UUID; 401/403 контекста; 404 staff; 500 internal при ошибке основного audit-запроса |
| Ограничения | Только последние 100 без cursor; ошибка загрузки имён профилей игнорируется и даёт null. Наличие списка не доказывает, что все финансовые изменения вообще записали аудит |

Источники: [route](../../apps/web/src/app/api/dashboard/staff/[id]/finance/audit-log/route.ts), [HTTP](../../apps/web/src/lib/staffFinanceAuditLogHttpService.ts), [service и AuditLogEntry](../../apps/web/src/lib/staffFinanceAuditLogService.ts).

### POST `/api/dashboard/staff/[id]/shift/close`

<!-- api-contract: POST /api/dashboard/staff/[id]/shift/close -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager wrapper, UUID staffId пути; service отдельно читает staff и сравнивает biz_id |
| Query | Необязательная `date`: календарная YYYY-MM-DD, год 1900–2100; без неё сегодня в TZ. Другие query не читаются |
| Body | Строгая `closeShiftSchema`: обязательные expectedShiftId UUID и expectedRevision (целое safe >=0) исходного снимка; optional items (max1000), totalAmount, consumablesAmount; непустые items либо присутствующий totalAmount обязательны. Иные поля, включая hoursWorked, отклоняются |
| Limiter/успех | critical; `data: { shift }`, тип StaffShiftRow сервиса |
| Ошибки | 400 validation даты/body/нет смены/SQL-валидация; 401/403 контекста; 403 forbidden чужой staff, 404 not_found отсутствующий staff; 409 **validation** при несовпадении снимка, revision, настроек или цены; 500 internal при чтении/RPC/неполном результате; 429 limiter |

Закрывает сохранённый ledger, не сохраняет новые позиции. Отсутствующие items превращаются в [], поэтому один totalAmount не гарантирует успех для непустой смены. Обновлено 10 ноября: backend передаёт actor, revision, настройки и расчёт core-domain в `close_staff_shift_command`; attendance, пакет/акция, итог смены и агрегаты фиксируются вместе либо откатываются. Уже закрытая смена — идемпотентный 200. Уведомление после commit не является частью транзакции и не гарантирует доставку. Общий контракт и оставшиеся ограничения manual Close — [STAFF_AND_FINANCE](STAFF_AND_FINANCE.md#post-apistaffshiftclose); [SQL](../../supabase/migrations/20261109091100_atomic_shift_commands.sql), [адаптер](../../apps/web/src/lib/staffShift/financeCommand.ts).

Источники: [route](../../apps/web/src/app/api/dashboard/staff/[id]/shift/close/route.ts), [HTTP](../../apps/web/src/lib/dashboardStaffShiftCloseHttpService.ts), [service](../../apps/web/src/lib/dashboardStaffShiftCloseService.ts), [schemas](../../apps/web/src/lib/validation/schemas.ts), [ledger comparison](../../apps/web/src/lib/staffShift/savedLedger.ts).

### POST `/api/staff/sync-roles`

<!-- api-contract: POST /api/staff/sync-roles -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager direct и дополнительная owner/admin/manager-роль бизнеса; body/query не читаются; limiter отсутствует |
| Успех | `data: { synced, total, errors? }`; если staff нет — `data: { synced: 0, message }` |
| Ошибки | Явные 401 auth, 403 forbidden; отсутствие роли staff — **400 not_found**; ошибка списка staff — 400 internal; исключения — общая обёртка |
| Эффекты | Для активных staff бизнеса с user_id последовательно проверяет/добавляет роль staff. Частичные ошибки попадают в errors при 200; уже имеющиеся роли не удаляются. Список без пагинации, общего rollback нет |

Источники: [route](../../apps/web/src/app/api/staff/sync-roles/route.ts), [HTTP](../../apps/web/src/lib/staffSyncRolesHttpService.ts), [service](../../apps/web/src/lib/staffSyncRolesService.ts).

## Расписания и отсутствия

Следующие schedule/time-off операции требуют `SCHEDULE_V2_ENABLED === 'true'`; иначе отвечают 503 service_unavailable **до** auth. Work-locations имеет legacy fallback и не требует включения. Фактическое значение не проверялось. В перечисленных route/helpers limiter отсутствует.

### GET `/api/staff/[id]/schedule`

<!-- api-contract: GET /api/staff/[id]/schedule -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct, staffId пути; сервис проверяет шаблон из 36 hex/hyphen символов, затем RPC |
| Query: календарь | `from`, `to`: календарные YYYY-MM-DD; from по умолчанию сегодня в timezone бизнеса, to — from +13 дней |
| Query: черновик | Наличие `draftKind` выбирает режим draft: `week`/`day` и обязательный `draftDate`; from/to этой веткой не используются |
| Успех | `data` — ScheduleSnapshot (`revision`, `timezone`, `today`, `days`) либо draft (`days`, `branchId`, `source`, `revision`) из RPC |
| Ошибки | 503 выключено; SCHEDULE_NOT_FOUND →404, SCHEDULE_FORBIDDEN →403, SCHEDULE_STALE →409; прочие известные SCHEDULE-коды →400; неизвестные исключения — handleApiError |

SQL `read_staff_schedule` дополнительно проверяет порядок диапазона и разницу <=62 дня, связывает staff с biz. Draft читает исходный план, а не массив effective days. Источники: [route](../../apps/web/src/app/api/staff/[id]/schedule/route.ts), [HTTP/readSchedule](../../apps/web/src/lib/scheduling/server.ts), [ScheduleSnapshot](../../apps/web/src/lib/scheduling/model.ts), [RPC definitions](../../supabase/migrations/20260918130000_explicit_staff_schedules.sql).

### GET `/api/staff/me/schedule`

<!-- api-contract: GET /api/staff/me/schedule -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Staff cookie; календарные from/to и defaults как выше, staffId из активной записи пользователя |
| Успех | `data: ScheduleSnapshot` |
| Ошибки | Те же ошибки schedule; draftKind явно даёт 403 forbidden. Вызов не предоставляет staff публикацию |
| Эффекты | Чтение расписания; получение staff-контекста может синхронизировать отсутствующую роль staff |

Источники: [route](../../apps/web/src/app/api/staff/me/schedule/route.ts), [общий handler](../../apps/web/src/lib/scheduling/server.ts), [тип](../../apps/web/src/lib/scheduling/model.ts).

### POST `/api/staff/[id]/schedule`

<!-- api-contract: POST /api/staff/[id]/schedule -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; RPC получает actor=userId, bizId и staffId |
| Публикация | `PublishSchedule`: kind week/day, from YYYY-MM-DD, branchId UUID, expectedRevision целое safe >=0, days. Для week ровно ключи 1–7; для day — day. Каждый день содержит только intervals/breaks, не более 8 диапазонов каждого вида, HH:mm, упорядочены без пересечений, breaks внутри рабочих intervals |
| Сброс дня | Тело с `action: reset-day`, from и expectedRevision; вызывает отдельный reset RPC |
| Успех | `data` — успешный результат RPC, в определении publish: ok, revision, id |
| Ошибки | 503 выключено; 400 SCHEDULE_INVALID/INVALID_BRANCH/OUTSIDE_BRANCH_HOURS/WEEK_REQUIRED; 403 SCHEDULE_FORBIDDEN; 404 SCHEDULE_NOT_FOUND; 409 SCHEDULE_STALE либо conflict с details конфликтующих bookings; другие исключения — handleApiError |

RPC проверяет actor, активность staff/филиала, будущую дату и revision, создаёт версию расписания с проверкой бронирований. Reset создаёт версию дня, возвращающую обычную неделю, не удаляет историю. Эти свойства описывают репозиторный SQL, не доказанную установленную версию. Неверный JSON идёт в общий catch, без отдельной стабильной ветки JSON-validation.

Источники: [route](../../apps/web/src/app/api/staff/[id]/schedule/route.ts), [handler](../../apps/web/src/lib/scheduling/server.ts), [тип/валидатор](../../apps/web/src/lib/scheduling/model.ts), [publish RPC](../../supabase/migrations/20260918130000_explicit_staff_schedules.sql), [reset RPC](../../supabase/migrations/20261008065051_complete_schedule_operations.sql).

### GET `/api/staff/[id]/time-off`

<!-- api-contract: GET /api/staff/[id]/time-off -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager direct с явным BizAccessError catch; корректный UUID staffId и активный staff текущего бизнеса; query не читается |
| Успех | `data: { today, items }`; today в timezone бизнеса, до 100 строк по date_from убыванию; поля id,date_from,date_to,reason,created_at,cancelled_at |
| Ошибки | 503 выключено; 401/403 контекста; 404 неверный ID/нет активного staff; прочие ошибки через handleApiError |
| Ограничения | Включает отменённые отсутствия; cursor/page нет, полная история не обещается |

Источники: [route](../../apps/web/src/app/api/staff/[id]/time-off/route.ts), [staffTimeOffHttp](../../apps/web/src/lib/scheduling/timeOffServer.ts).

### POST `/api/staff/[id]/time-off`

<!-- api-contract: POST /api/staff/[id]/time-off -->

| Часть | Контракт |
| --- | --- |
| Доступ | Как GET time-off |
| Body | from/to — существующие YYYY-MM-DD; from >= сегодня бизнеса, to >= from, разница <=365 дней; optional reason string/null, длина <=240; причина trim, пустая становится null |
| Успех | `data` — созданная строка с полями GET; записывается created_by=userId |
| Ошибки | 400 invalid для входа/SCHEDULE_INVALID; 409 conflict для SCHEDULE_BOOKING_CONFLICT/SCHEDULE_ABSENCE_OVERLAP; общие 503/401/403/404 и неожиданные ошибки как GET |

В HTTP нет строгого запрета неизвестных полей. Проверка пересечений bookings/отсутствий делегирована БД; catch только отображает её маркеры. Источники: [route](../../apps/web/src/app/api/staff/[id]/time-off/route.ts), [handler](../../apps/web/src/lib/scheduling/timeOffServer.ts), [validDate](../../apps/web/src/lib/scheduling/model.ts).

### PATCH `/api/staff/[id]/time-off`

<!-- api-contract: PATCH /api/staff/[id]/time-off -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Как GET; JSON `id` UUID существующего отсутствия. Это отмена, не редактирование дат |
| Успех | `data` — строка после записи cancelled_at/cancelled_by; update повторно фильтрует staffId,bizId и cancelled_at IS NULL |
| Ошибки | 400 invalid при ID или date_from < today; 404 нет отсутствия; 409 уже отменено/конкурентно изменено; остальные как POST |
| Эффекты | История сохраняется; отсутствие с date_from == today отменять код разрешает, ограничение использует строго < today |

Источники: [route](../../apps/web/src/app/api/staff/[id]/time-off/route.ts), [handler](../../apps/web/src/lib/scheduling/timeOffServer.ts).

### GET `/api/staff/work-locations`

<!-- api-contract: GET /api/staff/work-locations -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct; bizId из контекста, query bizId не выбирает бизнес |
| Query | Обязательные from/to, календарные YYYY-MM-DD, to >= from, разница <=62 дня; прошлые даты manager-ветка не запрещает |
| Успех | `{ ok: true, data: [...], availabilityComplete: boolean }`; строки staff_id,branch_id,date_on |
| Ошибки | 400 validation диапазона/формата бизнес-ID; прочие — handleApiError |
| Ограничения | Explicit-ветка вызывает read_staff_work_locations; актуальное определение включает **основной филиал тоже**. Legacy выбирает только активные date-rules, availabilityComplete=false. Значение true отражает переключатель реализации, не доказательство полной доступности runtime |

Источники: [route](../../apps/web/src/app/api/staff/work-locations/route.ts), [handler](../../apps/web/src/lib/scheduling/locations.ts), [позднее RPC definition](../../supabase/migrations/20261015075000_work_locations_include_home_days.sql).

## Планы и клиентские пакеты визитов

Manager-операции ниже используют manager wrapper. К указанным ошибкам добавляются 401/403 контекста и общие исключения. Наличие пакета не доказывает оплату или успешное списание визита в booking flow: эти операции имеют отдельные пути и риски, включая [ENG-04](../ENGINEERING_FINDINGS.md).

### GET `/api/dashboard/visit-package-plans`

<!-- api-contract: GET /api/dashboard/visit-package-plans -->

| Часть | Контракт |
| --- | --- |
| Вход/limiter | Query не читается; limiter отсутствует |
| Успех | `data: { plans }`, все планы бизнеса по created_at убыванию; полный mapVisitPackagePlan ниже |
| Ошибки/ограничения | 500 server с details при ошибке БД; активность не фильтруется; нет пагинации |

Источники: [route](../../apps/web/src/app/api/dashboard/visit-package-plans/route.ts), [HTTP](../../apps/web/src/lib/visitPackagePlansHttpService.ts), [VisitPackagePlanRow и mapVisitPackagePlan](../../apps/web/src/lib/visitPackagePlansService.ts).

### POST `/api/dashboard/visit-package-plans`

<!-- api-contract: POST /api/dashboard/visit-package-plans -->

| Часть | Контракт |
| --- | --- |
| Body | Строгая visitPackagePlanSchema: name_ru 1–200; optional nullable name_ky/name_en <=200; visit_count целое 1–1000; validity_days целое 1–3650; discount_type percent/fixed_price; discount_value число 0–100000, для percent <=100; optional nullable service_id UUID и branch_ids UUID[] |
| Limiter/успех | normal; `data: { plan }` с id,name_ru,visit_count,validity_days,discount_type,discount_value,is_active,created_at |
| Ошибки/эффекты | 400 validation schema; 500 server при вставке/пустом результате; новая строка всегда is_active=true, biz_id из контекста |
| Ограничения | Service не проверяет бизнес вложенных service_id/branch_ids; UUID-schema не подтверждает принадлежность. Body is_active не принимается |

Источники: [route](../../apps/web/src/app/api/dashboard/visit-package-plans/route.ts), [HTTP](../../apps/web/src/lib/visitPackagePlansHttpService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts), [service](../../apps/web/src/lib/visitPackagePlansService.ts).

### PATCH `/api/dashboard/visit-package-plans/[id]`

<!-- api-contract: PATCH /api/dashboard/visit-package-plans/[id] -->

| Часть | Контракт |
| --- | --- |
| Вход | UUID пути; строгая visitPackagePlanPatchSchema: все поля создания необязательны плюс boolean is_active |
| Limiter/успех | normal; `data: { plan }` с id,name_ru,is_active,updated_at; пустой patch — `data: { plan_id, updated: false }` |
| Ошибки | 400 UUID/schema; 404 not_found нет плана/другой biz; 500 server при чтении/update; общие ошибки |
| Ограничения | PATCH-schema не повторяет cross-field проверку percent <=100 из create и не сверяет новый discount_value с сохранённым discount_type. Принадлежность вложенных service/branch IDs не проверяется сервисом |

Источники: [route](../../apps/web/src/app/api/dashboard/visit-package-plans/[id]/route.ts), [HTTP](../../apps/web/src/lib/visitPackagePlanPatchHttpService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts), [updateVisitPackagePlan](../../apps/web/src/lib/visitPackagePlansService.ts).

### GET `/api/dashboard/visit-packages`

<!-- api-contract: GET /api/dashboard/visit-packages -->

| Часть | Контракт |
| --- | --- |
| Query | Строгая schema: optional clientId UUID, branchId UUID, status active/expired/all, default all |
| Limiter/успех | Нет; `data: { packages }`, поля id,client_id,client_name,plan_id,remaining_visits,valid_until,purchased_at,created_at и plan_name_ru/ky/en,plan_visit_count |
| Ошибки | 400 validation; 500 server при чтении планов/пакетов/профилей; общие ошибки |
| Ограничения | Пакеты ограничиваются IDs планов текущего бизнеса. active = valid_until >= текущая UTC-дата и remaining_visits >0; expired = прошедшая дата или remaining_visits==0. branchId фильтрует plan.branch_ids уже после чтения; null/пустой массив означают все филиалы. Нет пагинации |

Источники: [route](../../apps/web/src/app/api/dashboard/visit-packages/route.ts), [HTTP](../../apps/web/src/lib/visitPackagesHttpService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts), [listVisitPackages](../../apps/web/src/lib/visitPackagesService.ts).

### POST `/api/dashboard/clients/[clientId]/visit-packages`

<!-- api-contract: POST /api/dashboard/clients/[clientId]/visit-packages -->

| Часть | Контракт |
| --- | --- |
| Вход | UUID clientId пути; строгий JSON `{ plan_id: UUID }` |
| Limiter/успех | normal; `data: { package }`: id,client_id,plan_id,remaining_visits,valid_until,purchased_at,created_at |
| Ошибки | 400 validation ID/schema/неактивного плана; 404 not_found нет/ошибка плана в бизнесе; 500 server при вставке; общие ошибки |
| Эффекты | Создаёт client_visit_packages с количеством из плана и сроком now + validity_days. Повторный POST может создать ещё один пакет; idempotency key не предусмотрен |

Проверяется план текущего бизнеса; отдельной проверки связи clientId с бизнесом, оплаты или платёжной транзакции в сервисе нет. Название sell не означает подтверждённый платёж. Источники: [route](../../apps/web/src/app/api/dashboard/clients/[clientId]/visit-packages/route.ts), [HTTP](../../apps/web/src/lib/visitPackagesHttpService.ts), [schema](../../apps/web/src/lib/validation/schemas.ts), [sellVisitPackage](../../apps/web/src/lib/visitPackagesService.ts).

### GET `/api/me/visit-packages`

<!-- api-contract: GET /api/me/visit-packages -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Cookie user; query status=all отключает фильтр, любое другое/отсутствующее значение возвращает неистёкшие с remaining_visits>0; limiter отсутствует |
| Успех | `data: { packages }`, поля id,plan_id,plan_name_ru/ky/en,remaining_visits,plan_visit_count,valid_until,purchased_at,created_at; сортировка valid_until по возрастанию |
| Ошибки | 401 auth; 500 server при основном запросе; ошибки чтения имён планов не проверяются и дают null |
| Ограничения | client_id всегда user.id; данные всех его пакетов без пагинации. Сегодня вычисляется на каждом запросе в настроенной TZ (`NEXT_PUBLIC_TZ`, default Asia/Bishkek); переход полуночи проверен в одном процессе. Индивидуальная TZ каждого бизнеса здесь не выбирается |

Источники: [route](../../apps/web/src/app/api/me/visit-packages/route.ts), [HTTP и текущая дата](../../apps/web/src/lib/meVisitPackagesHttpService.ts), [service и MeVisitPackagesResult](../../apps/web/src/lib/meVisitPackagesService.ts).
## Заявки на бизнес и роли

Эти маршруты используют собственные плоские Response.json, а не общую data-обёртку. `message`/`code` ниже — поля их ответа. Стандартный limiter формирует свой 429 отдельно. Явная проверка авторизации использует cookie user; создание сессии/первый auth.getUser находятся вне части локальных catch, поэтому единый JSON для всех неожиданных исключений не установлен.

### POST `/api/business-applications`

<!-- api-contract: POST /api/business-applications -->

| Часть | Контракт |
| --- | --- |
| Доступ | Вошедший пользователь; без него 401, code auth_required |
| Body | Обязательные contact_name, business_name, phone, email; optional category, comment, instagram, two_gis, google_maps, yandex_maps. Поле website используется как honeypot, не как публичный сайт |
| Нормализация | Текст trim и обрезка: имя120, бизнес180, телефон40, email254, категория120, комментарий2000; телефон нормализуется в E.164, email lowercase и regex. Каталожные ссылки допускают HTTP/HTTPS, неверные игнорируются, длина до500 |
| Limiter | public base, keyPrefix business-applications, **3 запроса/час**, identifier `user:<id>` |
| Успех | Плоский `{ ok: true, id }`; id может быть null, в частности при сработавшем honeypot, когда вставки нет |
| Ошибки | 400 invalid_request/required_fields/invalid_email; 409 business_exists/recent_duplicate/pending_duplicate; policy-ошибки ниже; 503 service_unavailable при отсутствии service key; 500 unexpected_error для иных сбоев |

Проверяет кандидатов существующего бизнеса по slug prefix (до25) и нормализованному имени; recent duplicate — номер телефона, последние24 часа, статус new/contacted. Создаёт `business_registration_applications`, **не сам бизнес**. Затем отдельно пытается отправить уведомления; ошибки уведомления логируются, 200 не доказывает доставку. Прикладные policy-коды, полученные из БД, отображаются через [applicationPolicy](../../apps/web/src/lib/applicationPolicy.ts): blocked→403; active_limit/monthly_limit/cooldown_*→429; business_exists/pending_duplicate/owner_cannot_be_staff→409; owner_evidence_required/unsupported_role→400. Наличие mapper не доказывает, что все соответствующие triggers установлены.

Источники: [route](../../apps/web/src/app/api/business-applications/route.ts), [BusinessApplicationInput и submitBusinessApplication](../../apps/web/src/lib/businessApplicationService.ts), [уведомления](../../apps/web/src/lib/businessRoleApplicationNotificationService.ts).

### GET `/api/business-role-applications`

<!-- api-contract: GET /api/business-role-applications -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Cookie user; обязательный query requested_role=owner или staff; limiter отсутствует |
| Успех | Плоский `{ ok: true, items }`; pending-заявки текущего applicant, created_at убывает; id,biz_id,requested_role,status,created_at,businesses(name,slug) |
| Ошибки | 401 message auth; 400 неверная роль или ошибка запроса; 503 при исключении внутри чтения/admin client |
| Ограничения | Нет пагинации и истории обработанных заявок; другие query не читаются |

Источник: [route с полной реализацией](../../apps/web/src/app/api/business-role-applications/route.ts).

### POST `/api/business-role-applications`

<!-- api-contract: POST /api/business-role-applications -->

| Часть | Контракт |
| --- | --- |
| Доступ | Cookie user; заявитель и его контакты берутся с сервера из profiles/auth, не из body |
| Body | biz_id непустая строка, requested_role только owner/staff; optional message trim до2000; evidence_links с instagram/two_gis/google_maps/yandex_maps, только HTTP/HTTPS до500 символов |
| Проверки | Для owner требуется message >=20 символов **либо** хотя бы одна корректная ссылка. Бизнес должен быть is_approved. Проверяются существующая роль и pending-дубликат |
| Limiter | normal base, keyPrefix business-role-applications, **10 запросов/час**, identifier `user:<id>` |
| Успех | Плоский `{ ok: true, id }`; создаётся pending-заявка, роль автоматически не выдаётся |
| Ошибки | 401 auth_required; 400 неверный JSON/invalid_input/unsupported_role/owner_evidence_required/role_not_found; 404 business_not_found; 409 already_has_role/pending_duplicate; policy-коды как выше; 503 service_unavailable при брошенном исключении service |

UUID-format biz_id не проверяется отдельной schema; malformed ID может пройти в DB-lookup и стать 503 через catch. После сохранения отдельно пытаются уведомить получателей owner/staff-ветки; результат отправки не является условием успеха. Источники: [route](../../apps/web/src/app/api/business-role-applications/route.ts), [submitBusinessRoleApplication, identity и нормализация](../../apps/web/src/lib/businessRoleApplicationService.ts), [policy mapping](../../apps/web/src/lib/applicationPolicy.ts), [уведомления](../../apps/web/src/lib/businessRoleApplicationNotificationService.ts).

### DELETE `/api/business-role-applications/[id]`

<!-- api-contract: DELETE /api/business-role-applications/[id] -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Cookie user; required ID пути без UUID-validator; body/query не читаются; limiter отсутствует |
| Успех | Только ok; вызывает cancel_business_role_application с ID заявки и user.id |
| Ошибки | 401 нет user; 503 нет admin client; 400 ошибка lookup/RPC; 404 заявка отсутствует или чужой applicant; 409 уже не pending/ложный результат RPC |
| Ограничения | Это отмена заявки, не обещание физического удаления. Обработка конкурентного перехода делегирована RPC; route повторно учитывает его результат. Общего catch для всех исключений нет |

Источник: [route с проверками и RPC-вызовом](../../apps/web/src/app/api/business-role-applications/[id]/route.ts).

## Обработка заявок и администраторы филиала

### GET `/dashboard/api/role-applications`

<!-- api-contract: GET /dashboard/api/role-applications -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager direct; query не читается; limiter отсутствует |
| Успех | Плоский `{ ok: true, items, branches }`; до100 staff-заявок текущего бизнеса по created_at убыванию, все статусы; активные филиалы |
| Поля items | id,applicant_user_id,biz_id,requested_role,status,applicant_name/email/phone,message,evidence_links,prior_submission_count,risk_flags,created_at,reviewed_at,review_note,active_block_id |
| Ошибки/ограничения | 400 с message ошибки при запросе заявок/филиалов/блокировок; исключения auth/admin не обёрнуты здесь. active_block_id выбирается из действующих unreleased блокировок staff данного бизнеса; отсутствие page/cursor ограничивает историю100 строками |

Это чтение, owner-only проверка выполняется у изменения статуса ниже. Источник: [route с полной реализацией](../../apps/web/src/app/dashboard/api/role-applications/route.ts).

### POST `/dashboard/api/role-applications/[id]/status`

<!-- api-contract: POST /dashboard/api/role-applications/[id]/status -->

| Часть | Контракт |
| --- | --- |
| Доступ | Manager direct плюс **owner** текущего бизнеса через owner_id/owner-role; заявка обязана быть в этом бизнесе и requested_role=staff |
| Вход | Required ID пути; JSON action approve/reject/unblock; optional note, branch_id, is_active, block_days, block_id. Строгой schema нет |
| approve | branch_id непустая строка обязательна; is_active считается true, кроме точного false; вызывает approve_staff_application, затем legacy-инициализацию расписания и уведомление |
| reject | note trim до1000; block_days только число0/7/30/90, иначе0; pending проверяется service, затем reject_application_with_policy |
| unblock | block_id должен принадлежать applicant/бизнесу/staff-kind данной заявки; вызывает release_application_submission_block |
| Успех | approve: плоские ok,staff_id,schedule_initialized,schedule_days_created,schedule_error; reject/unblock: только ok |
| Ошибки | 400 JSON/action/филиал/часть DB-RPC ошибок; 403 не owner/не staff-заявка; 404 нет заявки/чужой бизнес/блокировка; 409 уже обработано/конфликт RPC/блок снят; 500 при отсутствующей staff-роли или неполном RPC-результате |

В route нет limiter и общей catch-обёртки для всех исключений; брошенная ошибка service/RPC может уйти в framework-ответ. Explicit scheduling пропускает создание legacy-расписания. RPC успех и дальнейшие расписание/уведомления — разные шаги; ответ с schedule_error не означает откат одобрения, доставка уведомления не гарантируется. Полный mapper approve-ошибок — в service.

Источники: [route](../../apps/web/src/app/dashboard/api/role-applications/[id]/status/route.ts), [approveStaffApplication/isBusinessOwner](../../apps/web/src/lib/staffApplicationApprovalService.ts), [rejectBusinessRoleApplication](../../apps/web/src/lib/businessRoleApplicationService.ts), [reject/unblock RPC helpers](../../apps/web/src/lib/applicationPolicy.ts), [уведомления](../../apps/web/src/lib/businessRoleApplicationNotificationService.ts).

### POST `/dashboard/api/branches/[id]/admins/add`

<!-- api-contract: POST /dashboard/api/branches/[id]/admins/add -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager context; await params, UUID branch ID; strict JSON `{user_id: UUID}`, лишние поля и malformed JSON отклонены |
| Успех | `{ok:true}` после checked `grant_branch_admin` через подтверждённую session; отдельного limiter нет |
| Ошибки | 401 отсутствующая identity; 403 нет прав/чужой branch; 400 UUID/JSON/target FK; 503 ошибка проверки доступа/branch read; 500 неподтверждённый RPC outcome |
| Изоляция | Branch читается с id + выбранным bizId; SQL повторяет проверку actor и реального бизнеса под branch lock. Повторная выдача идемпотентна |

Источники: [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/add/route.ts), [HTTP service](../../apps/web/src/lib/branchAdminChangeHttpService.ts), [SQL ACL и guards](../../supabase/migrations/20261110132000_privileged_maintenance_acl.sql). Проверка локальная; remote migration не применена.

### POST `/dashboard/api/branches/[id]/admins/remove`

<!-- api-contract: POST /dashboard/api/branches/[id]/admins/remove -->

Тот же input, auth, scoped branch read и ошибки, что у add. Вызывает `revoke_branch_admin` под caller session; повторное снятие идемпотентно. Не меняет owner/global/business роли.

Источники: [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/remove/route.ts), [общий HTTP service](../../apps/web/src/lib/branchAdminChangeHttpService.ts), [SQL](../../supabase/migrations/20261110132000_privileged_maintenance_acl.sql).

### POST `/dashboard/api/branches/[id]/admins/list`

<!-- api-contract: POST /dashboard/api/branches/[id]/admins/list -->

| Часть | Контракт |
| --- | --- |
| Доступ/вход | Manager direct; body/query не читаются, branchId из синхронного ctx.params.id; limiter отсутствует |
| Успех | Плоский `{ ok: true, items }`; user_id,source (owner/biz_admin/branch_admin),email,phone,full_name |
| Ошибки | 400 error при RPC; 500 error для пойманных исключений; ошибка metadata lookup отдельно не проверяется и может дать null-поля |
| Ограничения | Сначала service client вызывает branch_admins_effective, затем читает auth_users_view для полученных IDs. Проверки, что branch принадлежит bizId manager-контекста, в route нет; проблема Promise params остаётся |

Репозиторная функция `branch_admins_effective` получает бизнес **из переданного филиала**, возвращает owner/business-admin/branch-admin и не сверяет вызывающий manager-контекст. Поздняя миграция ограничивает EXECUTE для anon/authenticated и выдаёт service_role; этот route как раз использует service client. Поэтому нельзя описывать такой endpoint как доказанно изолированный по бизнесу. Достижимость/развёрнутые ACL не проверялись; возвращённые записи также могут повторять пользователя с разными source.

Источники: [route](../../apps/web/src/app/dashboard/api/branches/[id]/admins/list/route.ts), [определение RPC](../../supabase/migrations/20250101000000_create_branch_admins_effective.sql), [поздние grants/revokes](../../supabase/migrations/20260307000000_security_advisor_rls_and_revokes.sql).
