# API: аутентификация, администрирование и интеграции

Статус: справочник текущих исходников. Статическая сверка: **2026-11-01**. Runtime с реальными внешними сервисами: **NOT_RUN**. Владелец: maintainers API. Аудитория: разработчики web/mobile и эксплуатация. Предпосылка для использования: отдельное разрешение на выбранную среду и операцию; описание маршрута не разрешает отправлять сообщения, менять сессии, рейтинги или финансовые данные.

Документ покрывает прежние разделы «Аутентификация», «Администрирование», «Cron Jobs», «Webhooks», «Уведомления» и «WhatsApp», включая добавленный 2026-11-10 worker очереди уведомлений. Методы и контракты сверены по `route.ts`, HTTP adapters, services и применяемым схемам. Полный каталог других маршрутов — [API_DOCUMENTATION.md](../../API_DOCUMENTATION.md). Правила изменений — [CONTRIBUTING.md](../../CONTRIBUTING.md); открытые дефекты и границы выводов — [ENGINEERING_FINDINGS.md](../ENGINEERING_FINDINGS.md). Наличие кода не подтверждает настройки deployed environment или успешное исполнение.

## Общие соглашения

Для перечисленных JSON-ответов `200 S(data)` ниже означает `{"ok":true,"data":...}`; `E(status, error)` означает JSON `{"ok":false,"error":"...","message":"..."}` с указанным HTTP status и необязательным `details`. Это сокращения описания, а не JSON-примеры. Исключения с полями в корне и текстовым ответом указаны явно. Форматы определяет [apiErrorHandler.ts](../../apps/web/src/lib/apiErrorHandler.ts), подробнее — [API_ERROR_FORMATS.md](../../apps/web/src/lib/API_ERROR_FORMATS.md).

В таблицах ошибок перечислены явные ветки соответствующего endpoint. Неожиданные исключения проходят через `withErrorHandler`: статус зависит в том числе от текста `Error.message`, fallback — 500. Поэтому необработанный `req.json()` не гарантирует 400 на любой поврежденный JSON. Переданные `details` helper не удаляет в production.

`Cookie session` ниже означает `supabase.auth.getUser()` через серверный клиент cookies. Сам по себе `Authorization: Bearer <user JWT>` не является подтвержденным контрактом этих HTTP adapters. [Middleware](../../apps/web/src/middleware.ts) пропускает `/api`; общей проверки роли или подписи для всех API в нем нет. Контроли внешнего gateway/WAF по исходникам неизвестны.

Лимиты относятся к [withRateLimit](../../apps/web/src/lib/rateLimit.ts):

| Обозначение | Настройка в route | Практическая граница |
| --- | --- | --- |
| `auth/route` | 5 запросов за 15 минут, отдельный prefix данного пути | IP, а не пользователь; общий NAT делит лимит |
| `normal/route` | 30 запросов за 60 секунд | Отдельный method + routeId budget; IP scope делится за NAT |
| `critical/route` | 5 запросов за 60 секунд | Отдельный method + routeId budget; IP scope делится за NAT |
| `none` | Нет `withRateLimit` на route | Не обещает отсутствие или наличие внешнего ограничения |

У ограниченных routes 429 имеет `error: "rate_limit_exceeded"`, `message`, корневой `retryAfter`, заголовки `Retry-After` и `X-RateLimit-*`. С 2026-11-10 production missing/error Redis или неподтверждённая trusted-ingress policy дают503 `service_unavailable` до handler; process fallback в production отсутствует. Детали — [RATE_LIMITING.md](../../RATE_LIMITING.md). Ни лимиты, ни это описание не являются измерением пропускной способности.

## Аутентификация

<!-- api-contract: POST /api/auth/telegram/login -->
### POST `/api/auth/telegram/login`

Цепочка: [route](../../apps/web/src/app/api/auth/telegram/login/route.ts) → [HTTP](../../apps/web/src/lib/telegramLoginHttpService.ts) → [route service](../../apps/web/src/lib/telegramLoginRouteService.ts) → [login service](../../apps/web/src/lib/telegramLoginService.ts).

- **Auth:** существующая session не требуется. Проверяется подпись Telegram Login Widget с `TELEGRAM_BOT_TOKEN`; [verifyTelegramAuth](../../apps/web/src/lib/telegram/verify.ts) отклоняет данные старше 24 часов. Это не вход через строку Mini App `initData`.
- **Input:** JSON полей `TelegramAuthData`: обязательны `id`, `hash`, `auth_date`; опциональны `first_name`, `last_name`, `username`, `photo_url`. HTTP делает TypeScript cast; service проверяет truthiness трех обязательных полей и подпись, но не применяет `telegramAuthDataSchema`. В verifier нет отдельного запрета даты из будущего.
- **Success:** `200 S(data)` с `userId`, `email`, `password`, `needsSignIn: true`, `redirect: "/"`; текущий lower service также возвращает `linkage` (`existing` или `created`), сохраняемый adapter. Точный источник — `TelegramLoginResult` и возврат `handleTelegramLogin`. Ответ содержит учетные данные для следующего client sign-in; session/cookie этот endpoint не создает.
- **Errors:** 400 `validation`, `details.code` = `missing_data` / `invalid_signature`; 503 `service_unavailable` / `service_key_missing`; 500 `internal` с `auth_error` / `session_error` при создании auth user или подготовке password. Нет bot token — проверка подписи завершается false.
- **Limiter:** `auth/route`, prefix `api/auth/telegram/login`.
- **Side effects / ограничения:** находит профиль по Telegram ID либо создает auth user и profile; обновляет Telegram-поля и сбрасывает password для входа. Некоторые ошибки записи profile/metadata только логируются, поэтому 200 не подтверждает успешность каждой сопутствующей записи. Ответ нельзя сохранять в логи или примеры с реальными credentials.

<!-- api-contract: POST /api/auth/telegram/link -->
### POST `/api/auth/telegram/link`

Цепочка: [route](../../apps/web/src/app/api/auth/telegram/link/route.ts) → [HTTP](../../apps/web/src/lib/telegramLinkHttpService.ts) → [service](../../apps/web/src/lib/telegramLinkService.ts).

- **Auth:** cookie session, затем та же проверка Telegram Widget signature.
- **Input:** строгая [telegramAuthDataSchema](../../apps/web/src/lib/validation/schemas.ts): положительные целые `id` и `auth_date`, непустой `hash`, необязательные строки имени/username и URL `photo_url`; лишние поля отклоняются. В отличие от login, здесь действительно вызывается `validateRequest`.
- **Success:** `200 S({message: "Telegram успешно привязан"})`.
- **Errors:** 401 `auth`; 400 `validation` для JSON/schema/signature; занятый другим профилем Telegram ID дает **400 `conflict`**, `details.code: "already_linked"`; 500 `internal` / `update_error` при записи profile.
- **Limiter:** `auth/route`, prefix `api/auth/telegram/link`.
- **Side effects / ограничения:** обновляет `profiles.telegram_*`, `telegram_verified`, затем auth user metadata. Ошибка последнего шага логируется и не отменяет 200; общей транзакции этих записей нет.

<!-- api-contract: POST /api/auth/sign-out -->
### POST `/api/auth/sign-out`

Цепочка: [route](../../apps/web/src/app/api/auth/sign-out/route.ts) → [HTTP](../../apps/web/src/lib/authSignOutHttpService.ts) → [service](../../apps/web/src/lib/authSignOutService.ts).

- **Auth / input:** читает текущую cookie session; отсутствие пользователя не является ошибкой. Тело и query не используются.
- **Success:** 200, поля находятся в корне:

```json
{"ok":true,"message":"Выход выполнен"}
```

- **Errors / limiter:** только общий exception handler; `none`.
- **Side effects / ограничения:** удаляет cookies с точными именами `sb-<projectRef>-auth-token` и `sb-<projectRef>-auth-token-code-verifier`. Пытается вызвать необязательный `admin.auth.admin.invalidateRefreshTokens`, если метод доступен; ошибки подавляются. 200 не доказывает отзыв всех refresh tokens, а chunked cookie names этот helper не перечисляет.

<!-- api-contract: POST /api/auth/mobile-exchange -->
<!-- api-contract: GET /api/auth/mobile-exchange -->
### POST и GET `/api/auth/mobile-exchange` — bound one-use grant

Контракт обновлён **2026-11-10** по локальному исправлению ENG-01/ENG-08. Цепочка: [route](../../apps/web/src/app/api/auth/mobile-exchange/route.ts) → [HTTP](../../apps/web/src/lib/mobileExchangeHttpService.ts) → [grant service](../../apps/web/src/lib/mobileExchangeService.ts) → [migration/RPC](../../supabase/migrations/20261109090000_bound_mobile_session_grants.sql) → [verified identity session issuer](../../apps/web/src/lib/verifiedIdentitySession.ts).

| Method / input | Проверка и limiter | Ответ |
| --- | --- | --- |
| POST JSON `code`, `codeVerifier` | Code: 43 base64url символа, verifier: 43–128 символов RFC7636; лишние поля и token ingress отклоняются. `auth/route`, отдельный prefix | `200 S({accessToken,refreshToken})`; 400 validation для формата, 400 invalid_grant для чужого verifier/неизвестного/просроченного/повторного grant; 503 service_unavailable при storage/Auth failure |
| GET, любые query | Discovery и обмен отключены; нет обращения к grant storage | 410 gone, без pending/code/session данных |

После подтверждения identity только серверный caller создаёт случайный 32-byte grant. БД хранит SHA256 кода, SHA256 verifier инициатора, user ID и TTL **2 минуты**; access/refresh tokens в storage отсутствуют. Challenge берётся из сохранённой Telegram/WhatsApp attempt, а не из подтверждающего запроса. RPC атомарно отмечает grant consumed только при совпадении обоих hashes и непросроченном TTL; конкурентный повтор не получает user ID. Issuance удаляет до 500 истёкших grant за вызов. Публичные DB roles не имеют доступа к таблице/RPC.

После consume issuer проверяет user ID, локально получает magic-link token через Auth admin generateLink и обменивает его через verifyOtp; оба ответа сверяются с целевым user ID. Пароль не сбрасывается, письмо не отправляется. Для phone-only пользователя назначается внутренний UUID-email в `auth.kezek.invalid`. Если Auth недоступен после consume, grant остаётся использованным: нужен новый вход. Все ответы этого HTTP adapter имеют `Cache-Control: no-store` и `Referrer-Policy: no-referrer`.

[Native client](../../apps/mobile/src/navigation/useRootNavigationSession.ts) передаёт verifier через POST; глобальный pending recovery удалён. [Legacy callback page](../../apps/web/src/app/auth/callback-mobile/page.tsx) больше не принимает и не пересылает tokens. Google использует Supabase PKCE и точный `kezek://auth/callback?code=...`; ссылки с raw tokens или exchange_code отклоняются. Новый mobile client и миграция должны выпускаться согласованно; старые attempts без challenge fail closed.

**Проверено локально:** unit/integration mocks и отдельный PostgreSQL без сети, 12 конкурентных consume → один победитель. [Воспроизводимая SQL проверка](../../scripts/test-mobile-auth-grants-isolated.cjs). **NOT_RUN:** применение на удалённой БД, provider end-to-end, реальные mobile builds и rollout. Это исправление не закрывает весь auth: legacy Telegram Widget по-прежнему использует password-reset путь, описанный выше.

## Администрирование

<!-- api-contract: GET /api/admin/health-check -->
### GET `/api/admin/health-check`

Цепочка: [route](../../apps/web/src/app/api/admin/health-check/route.ts) → [HTTP](../../apps/web/src/lib/adminHealthCheckHttpService.ts) → [caller access](../../apps/web/src/lib/adminHealthCheckReadService.ts) → [HealthCheckResult](../../apps/web/src/lib/adminHealthCheckService.ts) / [queue health](../../apps/web/src/lib/backgroundQueueHealth.ts).

- **Auth:** подтверждённая cookie session + [checkCurrentUserIsSuperAdmin](../../apps/web/src/lib/adminAccess.ts): strict boolean от `is_super_admin()` через тот же session client, identity в SQL — `auth.uid()`. Input отсутствует.
- **Success:** `200 S(HealthCheckResult)`: внутренний `data.ok`, ISO `timestamp`, `alerts[]`, `services` (`core`, `supabase`, `email`, `whatsapp`, `redis`) и `checks` (`shifts`, `ratings`, `promotions`, `cronExecutions`, `backgroundQueues`). Внешнее `ok:true` означает завершение handler, не отсутствие проблем: читайте `data.ok` и `alerts`.
- **Errors:** 401 `auth`, 403 `forbidden`, 400 `internal` при ошибке проверки роли; остальные — общий handler. **Limiter:** `normal/route`.
- **Side effects / ограничения:** читает DB, сообщений не отправляет. Ошибка источника/count/cron journal/queue health даёт 500; число смен и промо берётся из точного HEAD count. Свежесть ratings требует всех трёх уровней и использует самую старую из последних дат. Cron учитывает пропущенные/неуспешные/зависшие запуски и выключенные worker. Это не liveness probe всех providers: `supabase.status` означает успешные DB reads, а email/WhatsApp/Redis остаются `degraded` с пояснением отдельной проверки. Подробнее — [MONITORING_AND_ALERTS.md](../../MONITORING_AND_ALERTS.md).

<!-- api-contract: GET /api/admin/performance/stats -->
### GET `/api/admin/performance/stats`

Цепочка: [route](../../apps/web/src/app/api/admin/performance/stats/route.ts) → [HTTP](../../apps/web/src/lib/performanceStatsHttpService.ts) → [PerformanceStatsResult](../../apps/web/src/lib/performanceStatsService.ts) → [shared Redis collector](../../apps/web/src/lib/performanceStore.ts).

- **Auth / input:** cookie session + текущий global super_admin; тело/query не используются. Auth error не разрешает stale user.
- **Success:** 200 S({stats,timestamp,windowStart,windowEnd,status,storage,percentilesApproximate}). status=observed либо no_data; storage=shared-redis. Окно — пять завершённых Redis TIME минут, задержка до минуты. Элемент: source(client/server), operation, unit(ms/score), count, unknownCount, avgDuration/minDuration/maxDuration, approximate p95Duration/p99Duration и errorRate0..1. CLS имеет безразмерную единицу score.
- **Errors:** 401 auth, 403 forbidden,503 service_unavailable при ошибке role read или общего store. **Limiter:** normal/route.
- **Граница:** фиксированные instrumented RPC/browser series, без process-memory fallback. Пустой доступный store — no_data, не healthy. Клиентские samples недоверенные и не смешиваются с server series. Метаданные и идентификаторы не хранятся; ограничения и outcome classifier — [PERFORMANCE_MONITORING](../../PERFORMANCE_MONITORING.md).

<!-- api-contract: GET /api/admin/ratings/status -->
### GET `/api/admin/ratings/status`

Цепочка: [route](../../apps/web/src/app/api/admin/ratings/status/route.ts) → [HTTP](../../apps/web/src/lib/ratingsAdminHttpService.ts) → [caller access](../../apps/web/src/lib/ratingsAdminReadService.ts) → [getRatingsStatus](../../apps/web/src/lib/ratingsStatusService.ts). Метод **GET**, не POST.

- **Auth:** cookie session + текущий global super_admin.
- **Input:** optional query `errors_days`; `parseInt`, затем диапазон 1..7, default 7. Невалидное значение и `0` дают default 7; отрицательное ограничивается до 1, больше 7 — до 7.
- **Success:** `200 S(data)`. Поля: `staff_last_metric_date`, `branch_last_metric_date`, `biz_last_metric_date`; три соответствующих `*_last_rating_recalculated_at`; `staff_without_rating`, `branches_without_rating`, `businesses_without_rating`; `recent_errors_total`, `recent_errors_by_type`, `recent_errors_days`, `has_recent_errors`. Даты/счетчики могут быть null; точный shape — возврат `getRatingsStatus`.
- **Errors:** 401 `auth`, 403 `forbidden`, 400 `internal` при проверке роли. **Limiter:** `normal/route`.
- **Side effects / ограничения:** только чтение. Часть query errors не проверяется; отсутствие данных превращается в null/0, ошибка чтения recent errors может выглядеть как отсутствие ошибок. Endpoint не запускает recalculation и не возвращает состояние фоновой job.

<!-- api-contract: POST /api/admin/initialize-ratings -->
### POST `/api/admin/initialize-ratings`

Цепочка: [route](../../apps/web/src/app/api/admin/initialize-ratings/route.ts) → [HTTP](../../apps/web/src/lib/initializeRatingsHttpService.ts) → [role check](../../apps/web/src/lib/initializeRatingsRouteService.ts) → [InitializeRatingsPayload / service](../../apps/web/src/lib/initializeRatingsService.ts).

- **Auth:** подтверждённая cookie session, затем общий [adminAccess](../../apps/web/src/lib/adminAccess.ts) вызывает `is_super_admin()` через тот же caller client. Принимается только boolean true без ошибки, actor-параметр отсутствует. Канонический predicate использует `auth.uid()` и [три поддерживаемых global role stores](../../supabase/migrations/20261110132000_privileged_maintenance_acl.sql).
- **Input:** JSON с optional `days_back`, `start_date`, `end_date`, `finalize_only`; Zod нет. Invalid JSON заменяется `{}`. `finalize_only === true` имеет приоритет и вызывает `update_all_aggregated_ratings`. Если обе даты соответствуют форме `YYYY-MM-DD`, используется `recalculate_ratings_for_date_range`: start не больше end, диапазон не более 31 дня. Проверяется regex формы, не полноценная календарная валидность. Иначе `days_back` преобразуется через `Number` и `floor`, default 30, допустимо 1..365; вызывается `initialize_all_ratings`.
- **Success:** `200 S({message})` после awaited RPC. Это не 202/job ID и не сообщение о поставленной в очередь задаче. Date-range режим сообщает о необходимости отдельного `finalize_only: true` для агрегированных рейтингов.
- **Errors:** 401 `auth`, 403 `forbidden`; 400 `validation` для диапазонов, 400 `internal` для запроса роли; 500 `internal` для RPC error. TypeScript cast статуса в route service не меняет фактический 500.
- **Limiter:** `critical/route`. **Side effects / ограничения:** пересчитывает метрики/рейтинги в DB в рамках запроса; separate background job, checkpoint и request timeout в этой цепочке не предусмотрены.

<!-- api-contract: GET /api/admin/promotions/debug -->
### GET `/api/admin/promotions/debug`

Цепочка: [route](../../apps/web/src/app/api/admin/promotions/debug/route.ts) → [HTTP](../../apps/web/src/lib/promotionsDebugHttpService.ts) → [access/input](../../apps/web/src/lib/promotionsDebugRouteService.ts) → [PromotionsDebugResult](../../apps/web/src/lib/promotionsDebugService.ts).

- **Auth:** cookie session и запись `user_roles` с текущим `user_id` + `roles.key = super_admin`. Здесь используется собственный query, не общий `adminAccess`.
- **Input:** query `clientId`, `branchId`, `bizId`; минимум одно непустое значение, каждое заданное должно соответствовать UUID regex (versions 1..5). Можно передать несколько; взаимная принадлежность объектов не проверяется этим debug route.
- **Success:** `200 S(PromotionsDebugResult)`: optional `client`, `branch`, `biz`; массивы `promotionUsage`, `referrals`, `bookings`, `activePromotions`, `anomalies`. Это диагностические данные, включая клиентские email/phone, а не агрегат `{usage_stats}`.
- **Errors:** 401 `auth`, 403 `forbidden`, 400 `validation`; DB fetch errors в data service преимущественно не транслируются в error response. **Limiter:** `normal/route`.
- **Side effects / ограничения:** только чтение с service client. Для клиента limit 100 usages, 50 referrals, 50 bookings; отсутствие entity может дать пустой успешный результат. Branch promotions не имеют явного limit и фильтра `is_active=true`, несмотря на имя `activePromotions`. Anomalies рассчитаны по выбранному/усеченному набору, это не полный аудит данных.

## Cron Jobs

Для трех маршрутов ниже текущий метод — **GET**; тело, date query и `X-Cron-Secret` не используются. Auth — точное сравнение заголовка `Authorization` с `Bearer <secret>`, где secret берется из `CRON_SECRET || VERCEL_CRON_SECRET`; cookie/роль пользователя не проверяются. Несовпадение дает `E(401, auth)`. С 2026-11-10 [общий guard](../../apps/web/src/lib/cronAuthorization.ts) отклоняет отсутствующий, пустой, пробельный или окружённый пробелами secret до создания клиента БД и вызова service. Сравнение bearer выполняется через timingSafeEqual. [Изолированные tests](../../apps/web/src/__tests__/lib/cronAuthorization.test.ts) проверяют denial-before-dependency; deployment-конфигурация здесь не проверялась. Limiter у всех трех — `none`.

Оба manifest генерируются из одного [cronJobs.json](../../apps/web/src/config/cronJobs.json); расписания и правила эксплуатации находятся в [CRON_SETUP.md](../../CRON_SETUP.md) и [OPERATIONS.md](../OPERATIONS.md). После auth каждый включённый cron записывает начало и результат через [tracking](../../apps/web/src/lib/cronExecutionTracking.ts). Недоступная запись начала даёт 503 до работы; неподтверждённая запись результата даёт 503 без повторного выполнения. Журнал не подтверждает полноту вложенных бизнесовых результатов. Регистрация задач в конкретном deployment ещё не проверена. Bishkek — UTC+6.

<!-- api-contract: GET /api/cron/close-shifts -->
### GET `/api/cron/close-shifts`

Цепочка: [route](../../apps/web/src/app/api/cron/close-shifts/route.ts) → [HTTP](../../apps/web/src/lib/closeShiftsCronHttpService.ts) → [CloseShiftsCronResult](../../apps/web/src/lib/closeShiftsCronService.ts).

- **Input/auth/limiter:** общие cron правила выше; просроченность определяется по календарю каждого бизнеса, включая весь накопленный хвост.
- **Success:** `200 S({ok:true,message,closed,total,attempted,pending,hasMore,errors})`. Партия до 25 смен, lease пять минут, бюджет обработки 45 секунд. Успех при `hasMore:true` означает завершение партии, а не всей очереди.
- **Errors:** 500 `internal` при ошибке claim или любой обработанной смены; частичный summary возвращается в `details`. Ошибка не превращается в `ok:true`; неисправная старая смена не блокирует все последующие попытки благодаря порядку claim.
- **Side effects / ограничения:** финансовая мутация через GET. [Claim/snapshot](../../supabase/migrations/20261110113000_shift_close_backlog.sql) использует `SKIP LOCKED`, читает полный ledger и revision; атомарный Close сверяет revision/настройки, сохраняет финансы и статусы. Полночь берётся после даты самой смены в timezone бизнеса. Пустой ledger при paid/confirmed bookings требует review. Незавершённые lease восстанавливаются последующим запуском; предел нагрузки deployment ещё не измерен.

<!-- api-contract: GET /api/cron/recalculate-ratings -->
### GET `/api/cron/recalculate-ratings`

Цепочка: [route](../../apps/web/src/app/api/cron/recalculate-ratings/route.ts) → [HTTP](../../apps/web/src/lib/recalculateRatingsCronHttpService.ts) → [runRecalculateRatingsCron](../../apps/web/src/lib/recalculateRatingsCronService.ts).

- **Input/auth/limiter:** общие cron правила. Service сам определяет вчерашний день и range по последней `biz_day_metrics.metric_date`, с максимальным lookback 7 дней.
- **Success:** `200 S(data)` с `message`, `rangeStart`, `rangeEnd`, `processedDays`, `durationMs`; optional `metricsSummary`, `errorsSummary`, `ratingNullSummary`. Полные вложенные поля определены типами `MetricsSummary`, `ErrorsSummary`, `RatingNullSummary` и возвратом функции в source. Это не `updated_count`.
- **Errors:** 500 `internal` при ошибке recalculation RPC; service также пытается отправить alert email. Ошибки отправки alert логируются и не заменяют исходный результат.
- **Side effects / ограничения:** вызывает `recalculate_ratings_for_date` (для одного дня передает `p_date:null`) либо `recalculate_ratings_for_date_range`; читает summary и может отправлять письма. Даже при `errorsSummary.total > 0` после успешного RPC ответ остается 200; смотрите вложенные diagnostics. Проверка свежести по одной таблице и ограниченный lookback не гарантируют восстановление всех пропусков. Запуск ожидает RPC и provider в текущем запросе.

<!-- api-contract: GET /api/cron/health-check-alerts -->
### GET `/api/cron/health-check-alerts`

Цепочка: [route](../../apps/web/src/app/api/cron/health-check-alerts/route.ts) → [HTTP](../../apps/web/src/lib/healthCheckAlertsCronHttpService.ts) → [runHealthCheckAlerts return type](../../apps/web/src/lib/healthCheckAlertsCronService.ts).

- **Input/auth/limiter:** общие cron правила.
- **Success:** `200 S({healthCheck,alertSent})`. `healthCheck` содержит `ok`, `alerts[]`, `checks` с разделами `shifts`, `ratings`, `promotions`, `telegramMobileAuth`, `googleMobileAuth`, `cronExecutions`, `backgroundQueues`. `alertSent` сообщает о принятии отправки провайдером, не о доставке в inbox. Вложенный `healthCheck.ok` может быть false при успешной доставке alert.
- **Errors:** 500 `internal` при ошибке чтения источника либо неуспехе отправки. Для неуспешной отправки `details` содержит `healthCheck` и `emailError`; частичные чтения не выдаются за здоровую картину. Auth — 401, tracking — 503, как выше.
- **Side effects / ограничения:** DB reads и возможное alert email. Telegram/Google сравнивают текущие и предыдущие 24 часа: рост failures минимум на 5 и в 1,5 раза; падение rate ниже 0,6 с ухудшением минимум на 0,15. Нулевые события не доказывают здоровье auth. Счётчики используют точный HEAD count; свежесть рейтингов требует всех трёх уровней. Проверка cron различает failed/stuck/overdue/unobserved и disabled. Queue health отдельно проверяет due/age, failed и ambiguous; успешный запуск worker не означает отсутствие очереди. Повторный вызов может повторно отправить alert: durable deduplication этих писем нет; внешний монитор полного отказа deployment требуется отдельно.

<!-- api-contract: GET /api/cron/booking-notifications -->
### GET `/api/cron/booking-notifications`

Цепочка: [route](../../apps/web/src/app/api/cron/booking-notifications/route.ts) → [worker](../../apps/web/src/lib/notifications/outboxWorker.ts) → [store](../../apps/web/src/lib/notifications/outboxStore.ts) / [planner](../../apps/web/src/lib/notifications/BookingNotificationPlanner.ts) / [transport](../../apps/web/src/lib/notifications/outboxTransport.ts).

- **Auth/input:** точный bearer для непустого `CRON_SECRET || VERCEL_CRON_SECRET`, через общий fail-closed guard; body/query не используются. Ошибка — `{ "ok": false, "error": "unauthorized" }`, HTTP 401. Пользовательская cookie/роль не заменяет cron secret. Limiter — `none`; claim ограничен двумя событиями.
- **Activation:** до `BOOKING_NOTIFICATION_WORKER_ENABLED=true` ответ `{ "ok": true, "enabled": false }` без клиента БД и отправок. Расписание и развёрнутая активация здесь не подтверждены.
- **Success:** top-level `{ok:true,enabled:true,claimed,outcomes,pruned}`; `outcomes` перечисляет исходы `sent`, `retry`, `continue`, `failed`, `obsolete` либо `lease_lost`. Ошибка запуска/БД — `{ "ok": false, "error": "outbox_worker_failed" }`, HTTP 503. Успешный cron HTTP не означает успех каждой доставки: проверяйте исходы и dead letters.
- **Effects:** волны по два события через SKIP LOCKED/lease 90 секунд, максимум 100 событий за запуск; уже обработанные IDs исключаются до конца запуска. Immutable payload и receipts по получателю; рабочий бюджет 45 секунд, provider deadline 8 секунд, DB HTTP deadline 5 секунд. Новые волны требуют запаса на отправку и подтверждения. Восемь ошибочных попыток переводят событие в failed; продолжение из-за бюджета не расходует попытку ошибки. Перед отправкой проверяется актуальная ревизия брони. Скалярные JSON RPC не зависят от REST row cap; service-only health возвращает backlog без PII. Очистка удаляет персональные payload/receipts после 30 дней, сохраняя маркер события от повторного enqueue.
- **Guarantee boundary:** Resend использует стабильный ключ в пределах консервативного окна 23 часа; неопределённые Telegram/WhatsApp не повторяются автоматически и требуют ручной сверки. Подробности и официальная документация — [notification guide](../../apps/web/src/lib/notifications/README.md). Локальные [unit tests](../../apps/web/src/__tests__/api/cron/booking-notifications.test.ts) и [изолированный PostgreSQL runner](../../scripts/test-booking-notification-outbox-isolated.cjs) выполнены; live provider/runtime delivery — NOT_RUN.

## Webhooks

<!-- api-contract: GET /api/webhooks/whatsapp -->
### GET `/api/webhooks/whatsapp`

Цепочка: [route](../../apps/web/src/app/api/webhooks/whatsapp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppWebhookHttpService.ts).

- **Auth / input:** query `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge`; token сравнивается с `getWhatsAppVerifyToken()` из [env helpers](../../apps/web/src/lib/env.ts). Cookie session не требуется.
- **Success:** HTTP 200 с непустым `hub.challenge` как raw response body, **без JSON envelope**.
- **Errors:** 403 `forbidden` при несовпадении mode/token; ошибка отсутствующей configuration — общий handler.
- **Limiter / side effects:** `none`; проверка subscription handshake без DB mutations.

<!-- api-contract: POST /api/webhooks/whatsapp -->
### POST `/api/webhooks/whatsapp` — подписанный входящий запрос

Цепочка: [route](../../apps/web/src/app/api/webhooks/whatsapp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppWebhookHttpService.ts) → [receive service](../../apps/web/src/lib/whatsAppWebhookService.ts) → [parser](../../apps/web/src/lib/whatsappInbox/parse.ts) / [store](../../apps/web/src/lib/whatsappInbox/store.ts) → [SQL inbox](../../supabase/migrations/20261110124000_whatsapp_inbox.sql).

- **Auth:** `X-Hub-Signature-256: sha256=<hex>` проверяется HMAC-SHA256 по исходным bytes до JSON parsing и любых side effects. [Verifier](../../apps/web/src/lib/whatsAppWebhookSignature.ts) использует timing-safe comparison и серверный `WHATSAPP_APP_SECRET` (Meta app secret). GET verify token не заменяет подпись POST. Session не требуется. Соответствует [контракту Meta SDK](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/).
- **Input:** не более 512 KiB и 2 секунд чтения. JSON `object: "whatsapp_business_account"`, `entry[].changes[].value`; каждый value содержит `metadata.phone_number_id`, совпадающий с настроенным `WHATSAPP_PHONE_NUMBER_ID`. Всего до 100 messages: ID 1–512 символов, sender 7–15 цифр, timestamp — Unix seconds, type — ограниченная строка, text body до 4096 символов. Parser проверяет эти поля; лишние provider fields не сохраняются. Status-only callback не исполняет команд и не разрешает повтор неопределённой отправки.
- **Success:** HTTP 200 с корневыми полями:

```json
{"ok":true,"success":true}
```

- **Errors / limiter:** без app secret / receiver config — 503; неверная подпись — 403; невалидные bytes/JSON/schema/receiver — 400; один ID с другим hash или исходным timestamp — 409; ошибка/неопределённый commit DB — 503, позволяющий provider повторить доставку. Limiter: none; parser и batch ограничены. Фактическая provider retry policy не проверена локальными tests.
- **Side effects / ack:** только атомарное сохранение всего message batch либо подтверждение уже сохранённых идентичных IDs. HTTP 200 означает приём, **не исполнение команды или доставку ответа**. Worker может быть выключен; сообщения всё равно сохраняются. Ключ `(receiver, message_id)`, hash нормализованных командных входов включает исходный подписанный timestamp. Legacy ID из `whatsapp_messages` получает `legacy_manual`, даже при `processed=false`; автоматического replay старой истории нет. Сообщение старше 24 часов принимается как `expired`, без исполнения.

Проверки границы: [HTTP tests](../../apps/web/src/__tests__/api/webhooks/whatsapp.test.ts), [parser/worker tests](../../apps/web/src/__tests__/lib/whatsappInbox.test.ts), [isolated SQL runner](../../scripts/test-whatsapp-inbox-isolated.cjs). Synthetic данные, без вызова provider. Deployment, Meta callback и delivery остаются отдельными воротами.

<!-- api-contract: GET /api/cron/whatsapp-inbox -->
### GET `/api/cron/whatsapp-inbox`

Цепочка: [route](../../apps/web/src/app/api/cron/whatsapp-inbox/route.ts) → [worker](../../apps/web/src/lib/whatsappInbox/worker.ts) → [store](../../apps/web/src/lib/whatsappInbox/store.ts) / [SQL](../../supabase/migrations/20261110124000_whatsapp_inbox.sql) / [transport](../../apps/web/src/lib/notifications/outboxTransport.ts).

- **Auth / activation:** общий fail-closed cron bearer guard до privileged client. Без точного `WHATSAPP_INBOX_WORKER_ENABLED=true` возвращает `{"ok":true,"enabled":false}` без worker/tracking. Расписание — [cron source](../../apps/web/src/config/cronJobs.json); activation требует отдельного rollout после миграций и receiver config.
- **Input / output:** body/query нет. Включённый запуск возвращает корневые `ok,enabled,claimed,sent,failed,deferred,errors`. Ошибка зависимости/receipt или новая терминальная ошибка отправки — HTTP 503; неверная авторизация — 401. Выполнение worker не доказывает доставку адресату.
- **Boundaries:** до 20 messages, волны до 4; новые волны только в первые 20 секунд, резерв на command/begin/send/receipt в бюджете 45 секунд. DB HTTP deadline 5 секунд, provider — 8 секунд; SQL lease 90 секунд, максимум 8 attempts с backoff. `SKIP LOCKED` и token fencing разделяют workers. Команда старше 24 часов не исполняется.
- **Commands / ownership:** точные RU/EN команды; «да»/«ок» внутри обычного текста не являются командами. Неверный номер записи запрашивает выбор. SQL сопоставляет sender с текущим profile phone; неоднозначный профиль не выбирается. Phone-only fallback — только `client_id IS NULL`. Receiver, принадлежность и статус повторно проверяются в транзакции после блокировки staff → booking. [Защищённые confirm/cancel wrappers](../../supabase/migrations/20261110123000_service_only_booking_commands.sql) обязательны; paid/финансово связанные отмены требуют отдельной сверки.
- **Atomicity / replies:** booking transition, его outbox event и неизменяемый command/reply receipt — одна транзакция. До внешнего send сохраняется `reply_started_at`. Неизвестный WhatsApp outcome, потерянный receipt после принятия или истёкший started lease → `ambiguous`, без автоматической повторной отправки. Только известный 429 или отсутствие provider config до отправки разрешают retry. Ответ на команду и booking notification — разные сообщения.
- **Recovery / retention:** `failed`, `ambiguous`, `legacy_manual`, `expired` требуют просмотра command/provider outcome оператором. Возврат в pending без сверки недопустим. После 30 дней PII доступно bounded cleanup; receiver/message ID/hash/timestamp остаются tombstone. Ежедневный retention вызывает pruning независимо от enabled flag worker. Подробности — [WhatsApp setup](../../WHATSAPP_SETUP.md).

## Уведомления

<!-- api-contract: POST /api/notify -->
### POST `/api/notify`

Контракт обновлён 2026-11-10. Цепочка: [route](../../apps/web/src/app/api/notify/route.ts) → [HTTP](../../apps/web/src/lib/notifyHttpService.ts) → [runNotifyBooking](../../apps/web/src/lib/notifyBookingService.ts) → [SQL enqueue](../../supabase/migrations/20261110090000_booking_notification_outbox.sql).

- **Auth:** проверенная cookie или bearer identity. Пользователь должен совпадать с `booking.client_id` либо пройти manager business context и принадлежность booking бизнесу. Cookie manager identity должна совпадать с проверенным пользователем запроса; чужая cookie не разрешает действие bearer-пользователю. Manager context по-прежнему требует доступный cookie context.
- **Input:** строгая [notifyRequestSchema](../../apps/web/src/lib/validation/schemas.ts): `type` — `hold`, `confirm`, `cancel`; `booking_id` — UUID. Лишние поля отклоняются.
- **Success:** `200 S({queued:true,event_id})`. Событие зарегистрировано долговечно; это не счётчик отправок и не обещание доставки. Повтор для той же booking revision/type возвращает тот же event ID.
- **Errors:** 400 `validation`; 401 `auth`; 403 `forbidden`; 404 `not_found`; 409 `notification_state_mismatch`, если текущий статус не соответствует типу; 503 `service_unavailable` при отказе enqueue. Email credentials для HTTP enqueue не требуются.
- **Limiter:** `normal/shared`.
- **Side effects / ограничения:** HTTP не вызывает провайдеров и не меняет статус брони. Booking trigger уже записывает событие транзакционно; этот endpoint разрешает только проверенный повтор enqueue. Получатели, partial receipts, retry/deadletter и пределы внешней дедупликации — [notification guide](../../apps/web/src/lib/notifications/README.md). [Локальные contract tests](../../apps/web/src/__tests__/api/notify.test.ts) проверяют авторизацию и enqueue без реальных сообщений.

<!-- api-contract: POST /api/notify/ping -->
### POST `/api/notify/ping` — отправляет настоящее письмо

Цепочка: [route](../../apps/web/src/app/api/notify/ping/route.ts) → [HTTP](../../apps/web/src/lib/notifyPingHttpService.ts) → [NotifyPingResult](../../apps/web/src/lib/notifyPingService.ts). Метод **POST**, не GET; это не endpoint с ответом `pong`.

- **Auth:** cookie session и global super_admin текущего caller через [adminHttpAccess](../../apps/web/src/lib/adminHttpAccess.ts). Требуется подтвержденный email этого Auth user. **Limiter:** critical, 5/минуту с отдельным prefix `notify-ping`.
- **Input:** строгий JSON object с optional `to`: валидный email, совпадающий с email caller без учета регистра. `{}` выбирает его автоматически. `from` и любые дополнительные поля запрещены; sender берется только из серверного `EMAIL_FROM`.
- **Success:** HTTP 200, `S({ok:true,status})`, где status — успешный HTTP status Resend; сырой provider body не возвращается. Это принятие письма провайдером, не подтверждение доставки.
- **Errors:** 401 `auth`, 403 `forbidden` при отсутствии роли/подтвержденного email или чужом получателе; 400 `validation` для JSON/schema; 503 `service_unavailable` при ошибке role lookup или отсутствии `RESEND_API_KEY`/`EMAIL_FROM`; provider non-2xx, network error или timeout — 502 `service_unavailable`.
- **Side effects / ограничения:** отправляет настоящее письмо текущему администратору с subject `Kezek test` и HTML `Ping from Kezek`, timeout 5 секунд. Dry-run и idempotency нет; повтор может отправить повторное письмо. Использовать как read-only health probe нельзя.

Контракт 2026-11-09 проверен [HTTP tests](../../apps/web/src/__tests__/lib/notifyPingHttpService.test.ts), [provider-adapter tests](../../apps/web/src/__tests__/lib/notifyPingService.test.ts) и [общими отрицательными access cases](../../apps/web/src/__tests__/api/admin/privileged-diagnostics-access.test.ts). Реальные письма не отправлялись.

## WhatsApp: подтверждение телефона профиля

Следующие два пути **не выполняют standalone login** и не возвращают Supabase session. Они работают с уже авторизованным пользователем. Другие `/api/auth/whatsapp/*` routes — отдельный контракт в полном [API-каталоге](../../API_DOCUMENTATION.md).

<!-- api-contract: POST /api/whatsapp/send-otp -->
### POST `/api/whatsapp/send-otp`

Цепочка: [route](../../apps/web/src/app/api/whatsapp/send-otp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppSendOtpHttpService.ts) → [route service](../../apps/web/src/lib/whatsAppSendOtpRouteService.ts) → [WhatsAppSendOtpResult](../../apps/web/src/lib/whatsAppSendOtpService.ts).

- **Auth / input:** cookie session. Optional JSON `phone` (строка); иначе берется `profiles.whatsapp_phone`. Malformed JSON в HTTP превращается в отсутствие `phone`, а не обязательный 400. Номер нормализуется через [normalizePhoneToE164](../../apps/web/src/lib/senders/sms.ts); уже подтвержденный тот же номер отклоняется.
- **Success:** `200 S({message: "Код отправлен на WhatsApp"})`.
- **Errors:** 401 `auth`; 400 `validation` с `details.code`: `profile_error`, `no_phone`, `invalid_phone`, `already_verified`; 503 `internal` / `otp_template_not_configured`; 500 `internal` / `otp_save_failed` либо `send_failed`.
- **Limiter:** `auth/route`, prefix `api/whatsapp/send-otp`.
- **Side effects / ограничения:** генерирует 6-значный код через `Math.random`, записывает plaintext `whatsapp_otp_code`, expiry +10 минут и номер в auth **user_metadata**, затем отправляет WhatsApp template. Route требует настроенного auth template. Неуспешная отправка не откатывает уже сохраненный OTP. Наличие кода в пользовательских metadata — открытая граница доверия: этот механизм нельзя считать доказательством владения телефоном без отдельной security проверки.

<!-- api-contract: POST /api/whatsapp/verify-otp -->
### POST `/api/whatsapp/verify-otp`

Цепочка: [route](../../apps/web/src/app/api/whatsapp/verify-otp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppVerifyOtpHttpService.ts) → [route result](../../apps/web/src/lib/whatsAppVerifyOtpRouteService.ts) → [verifyExistingWhatsAppOtp](../../apps/web/src/lib/whatsAppVerifyOtpService.ts) / [identity ownership](../../apps/web/src/lib/whatsAppIdentityOwnershipService.ts).

- **Auth / input:** cookie session; JSON `code`, ожидается строка из 6 цифр. `phone` в body не используется: код, expiry и номер берутся из текущего `user.user_metadata`. TypeScript cast не является полной runtime схемой; service проверяет regex и строгое равенство сохраненному коду.
- **Success:** `200 S({message: "WhatsApp номер подтвержден"})`. Нет `session`, access token или refresh token.
- **Errors:** 400 `validation` для invalid JSON или `details.code`: `invalid_code`, `no_code`, `expired`, `wrong_code`, `invalid_phone`; 401 `auth`; 409 `conflict` / `whatsapp_identity_already_linked`; 500 `internal` / `auth_owner_lookup_failed` либо `update_failed`.
- **Limiter:** `auth/route`, prefix `api/whatsapp/verify-otp`; счетчик независим от send-otp, но основан на IP. Отдельного лимита попыток на конкретный OTP/user в service нет.
- **Side effects / ограничения:** owner lookup сначала ищет verified WhatsApp profile, затем последовательно перебирает до 100 страниц Auth users по 1000 и проверяет legacy profile. Это потенциально до 100 Auth API вызовов в одном запросе и не полный поиск при большем числе пользователей. Затем service обновляет `profiles.whatsapp_phone` и `whatsapp_verified` и очищает OTP metadata. Ошибка очистки лишь логируется; операции не объединены транзакцией. Expiry проверяется только если поле присутствует; источник проверяемого секрета — пользовательские metadata. Success этой реализации не следует трактовать как закрытый security gate.

## Граница проверки

Это source-level справочник текущего поведения, включая ошибки и отсутствующие гарантии. Runtime запросы, отправки OTP/email, входы, cron, DB/RLS и нагрузка при подготовке не запускались. Емкость — **NOT_MEASURED**. Исправление описания не закрывает OPEN findings и не меняет [текущий статус проекта](../PROJECT_STATUS.md). Эксплуатационные prerequisites и неизвестные параметры среды — [OPERATIONS.md](../OPERATIONS.md).
