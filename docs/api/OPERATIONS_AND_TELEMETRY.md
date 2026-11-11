# Служебные маршруты, телеметрия и дополнительная конфигурация

Статус: контракты сверены по route → HTTP → service 1 ноября 2026. Runtime с реальными внешними сервисами NOT_RUN. [Индекс API](../../API_DOCUMENTATION.md), [полный каталог](ROUTE_CATALOG.md).

Успех общих helpers — HTTP 200, `{ ok: true, data? }`; исключения обрабатываются [apiErrorHandler](../../apps/web/src/lib/apiErrorHandler.ts). Это не гарантия единого кода ошибки во всех ветках. Указанные ниже вызовы Graph API, Telegram и SQL являются эффектами реализации; при документировании они не выполнялись.

## Обновление филиала

<!-- api-contract: POST /api/branches/[id]/update -->

`POST /api/branches/[id]/update`: [route](../../apps/web/src/app/api/branches/[id]/update/route.ts), [HTTP](../../apps/web/src/lib/branchUpdateHttpService.ts), [service](../../apps/web/src/lib/branchUpdateService.ts).

- Доступ: cookie manager context, затем проверка принадлежности филиала бизнесу. Limiter normal с отдельным method/routeId budget; [условия429/503](../../RATE_LIMITING.md).
- Вход: path id; непустой JSON object по [branchUpdateSchema](../../apps/web/src/lib/validation/businessUpdateSchemas.ts). Все поля optional; name при передаче — непустая строка, boolean поля не приводятся из строк. Неизвестные ключи, неверные типы и malformed JSON дают 400 до записи.
- Семантика PATCH: меняются только переданные поля. Null очищает nullable contact/address; lat и lon передаются вместе двумя числами либо двумя null. Отсутствующие поля сохраняются; directory_links заменяется целиком только при явной передаче.
- Успех: `{ ok: true }`. Нет филиала — 404; отказ принадлежности/ошибка её проверки — 403; валидация и ошибка update — 400. Affected rows после precheck отдельно не проверяются; удаление между проверкой и update остаётся ограничением.

## Пересчёт аналитики

<!-- api-contract: GET /api/cron/analytics/daily -->
<!-- api-contract: POST /api/cron/analytics/daily -->
<!-- api-contract: GET /api/cron/analytics/hourly-load -->
<!-- api-contract: POST /api/cron/analytics/hourly-load -->

GET и POST каждого пути вызывают одинаковую цепочку; тело POST не используется.

| Путь | Источники | Эффект и успех |
| --- | --- | --- |
| `/api/cron/analytics/daily` | [route](../../apps/web/src/app/api/cron/analytics/daily/route.ts), [HTTP](../../apps/web/src/lib/analyticsDailyCronHttpService.ts), [service](../../apps/web/src/lib/analyticsDailyCronService.ts) | Пересчёт business_daily_stats; `data.message`, `data.results[]` с date/updated |
| `/api/cron/analytics/hourly-load` | [route](../../apps/web/src/app/api/cron/analytics/hourly-load/route.ts), [HTTP](../../apps/web/src/lib/analyticsHourlyLoadCronHttpService.ts), [service](../../apps/web/src/lib/analyticsHourlyLoadCronService.ts) | Пересчёт почасовых агрегатов; та же форма message/results |

Доступ: точное сравнение Authorization с Bearer CRON_SECRET, fallback VERCEL_CRON_SECRET; несовпадение — 401. С 2026-11-10 [общий guard](../../apps/web/src/lib/cronAuthorization.ts) закрывает доступ при отсутствующем, пустом, пробельном или окружённом пробелами secret до создания DB client; exact bearer сравнивается через timingSafeEqual. Проверка отказов — [mocked HTTP tests](../../apps/web/src/__tests__/lib/cronAuthorization.test.ts), не проверка deployment. Limiter в routes отсутствует.

Сверено и проверено изолированно 2026-11-10. Явный query требует обе существующие даты, start ≤ end и не более 366 включительных дней; неверный диапазон — 400. Без дат пересчитываются три предыдущие календарные даты, чтобы повторный запуск захватил завершённые сутки западных часовых поясов. [Выбор дат](../../apps/web/src/lib/analyticsReportDates.ts).

Каждый день заменяется отдельной SQL-транзакцией: полные SQL-агрегаты, upsert текущих и удаление устаревших buckets. Границы — [полночь, следующая полночь) в businesses.tz с fallback TZ, включая DST и микросекунды. Ошибка источника/записи прерывает диапазон с non-success; уже законченные даты не откатываются. Почасовая модель объединяет оба повторения часа при осеннем DST. Revenue — оценка confirmed/paid по promotion.final_amount либо текущей цене услуги, не подтверждённые денежные поступления. [SQL и grants](../../supabase/migrations/20261110110000_reporting_completeness.sql), [изолированный PostgreSQL runner](../../scripts/test-reporting-completeness.mjs). Remote deployment и длительность на реальном объёме этими проверками не подтверждены.

Фактическая регистрация расписания и last-success проверяются отдельно: [CRON_SETUP](../../CRON_SETUP.md). Наличие этих routes не означает наличие scheduler.

Автозакрытие смен использует [claim/snapshot SQL](../../supabase/migrations/20261110113000_shift_close_backlog.sql) и [service](../../apps/web/src/lib/closeShiftsCronService.ts): максимум 25 смен, lease 5 минут, SKIP LOCKED и приоритет ещё не обработанных перед старыми неудачами. Общий budget 45 секунд ограничивает HTTP RPC через AbortSignal и deadline race: claim/commit максимум 10 секунд, release максимум 3 секунд и не дольше оставшегося бюджета. Незапущенные claims освобождаются, если осталось время; иначе истекают по lease. Ответ дополняют attempted/pending/hasMore. SQL Close сохраняет revision fence; непустой paid/confirmed день с пустым ledger даёт needs_review и остаётся открытым. Граница закрытия — midnight после shift_date в timezone бизнеса; ошибка timezone явно сообщает non-success и не блокирует корректные бизнесы. Таймаут commit означает outcome_unconfirmed: он не засчитывается как закрытие и не повторяется с новой revision в этом запуске. Следующий проход читает сохранённое состояние после lease. [Deadline adapter](../../apps/web/src/lib/staffShift/rpcDeadline.ts), [SQL lock/statement limits](../../supabase/migrations/20261110114000_finance_calendar.sql). [Изолированные race/DST проверки](../../scripts/test-shift-close-backlog.mjs).

## Очистка и анонимизация

<!-- api-contract: GET /api/cron/data-retention -->

`GET /api/cron/data-retention`: [route](../../apps/web/src/app/api/cron/data-retention/route.ts), [HTTP](../../apps/web/src/lib/dataRetentionCronHttpService.ts), [service](../../apps/web/src/lib/dataRetentionCronService.ts).

Та же cron-аутентификация; query/body не задают правила retention, limiter отсутствует. Последовательно вызываются девять RPC очистки, анонимизации и завершения удаления аккаунтов, включая bounded inbox/outbox pruning независимо от enabled flags отправляющих worker. Сроки и состав операций — [DATA_RETENTION](../../DATA_RETENTION.md).

Успех возвращает `data.message` и подтверждённые целые неотрицательные счётчики. Ошибка отдельного RPC либо неверный счётчик даёт internal/500, `details` сохраняет успешные счётчики и `*_error`. Транспортное исключение останавливает обработку с неподтверждённым исходом; повтор шага внутри запроса не выполняется. Предшествующие изменения не откатываются общей транзакцией. Tracking сохраняет неуспех; недоступный tracking даёт503. Это изменяющая данные операция, несмотря на GET.

## События воронки

<!-- api-contract: POST /api/funnel-events -->

`POST /api/funnel-events`: [route](../../apps/web/src/app/api/funnel-events/route.ts), [HTTP](../../apps/web/src/lib/funnelEventsHttpService.ts), [schema/service](../../apps/web/src/lib/funnelEventsService.ts).

Handler не требует session и не вызывает limiter. JSON проходит funnelEventSchema: обязательны event_type из enum, source public/quickdesk, biz_id UUID, session_id длиной 1–255 и timestamp datetime. Опциональны branch/service/staff/booking IDs, service_ids/services_count, slot_start_at, user_agent, referrer и metadata. Полный набор и ограничения — в schema.

При отсутствии service key ответ — `{ ok: true, data: { skipped: true } }`; запись не выполняется. При успешном insert в funnel_events — `{ ok: true }`, ошибка БД — internal/500, schema — validation/400. created_at берётся из присланного timestamp. Metadata допускает произвольные значения: комментарий «не содержит PII» не обеспечивается этой схемой, принадлежность переданных бизнесовых IDs отдельно не проверяется.

## Frontend metrics

<!-- api-contract: POST /api/metrics/frontend -->

`POST /api/metrics/frontend`: [route](../../apps/web/src/app/api/metrics/frontend/route.ts), [HTTP](../../apps/web/src/lib/frontendMetricsHttpService.ts), [service/types](../../apps/web/src/lib/frontendMetricsService.ts).

Публичный collector, normal limiter с отдельным method/routeId budget; production требует общий Redis + trusted ingress. Строгая [схема](../../apps/web/src/lib/performanceCore.ts): только {operation,value,success}; operation входит в client allowlist, value конечный неотрицательный и ограниченный, success boolean. Дополнительные поля, server labels, массивы, неверный JSON и body более 1024 bytes отклоняются 400; чтение body ограничено 1 s.

[Service](../../apps/web/src/lib/frontendMetricsService.ts) ожидает ack агрегата в [Redis store](../../apps/web/src/lib/performanceStore.ts). Успех — {ok:true,data:{recorded:true,source:'client'}}, failure store — 503. Supabase/user lookup и raw log_frontend_metric write удалены. IDs/IP/user-agent/URL/metadata не хранятся. Browser values остаются недоверенными, но не могут попасть в server financial series; Retention и точная граница — [PERFORMANCE_MONITORING](../../PERFORMANCE_MONITORING.md).

## OpenAPI JSON

<!-- api-contract: GET /api/swagger.json -->

`GET /api/swagger.json`: [route](../../apps/web/src/app/api/swagger.json/route.ts), [spec builder](../../apps/web/src/lib/swagger.ts). Входов, auth и limiter в handler нет. Ответ — OpenAPI 3.0.3 object в корне JSON, без `ok/data`. Runtime импортирует сохранённый JSON artifact; не читает filesystem, cwd или env для построения спецификации.

[UI](../../apps/web/src/app/api-docs/page.tsx) проверяет HTTP status и форму документа через [consumer boundary](../../apps/web/src/lib/openApiDocument.ts), отклоняет error/success envelopes и пустой каталог. Swagger отображается без Try it out. SDK строится offline из отдельного reviewed subset; полный inventory не выдаётся за типизированный контракт. Источники, проверки и ограничения — [SWAGGER_SETUP](../../SWAGGER_SETUP.md).

## Telegram webhook

<!-- api-contract: POST /api/webhooks/telegram -->

`POST /api/webhooks/telegram`: [route](../../apps/web/src/app/api/webhooks/telegram/route.ts), [HTTP и dispatch](../../apps/web/src/lib/telegramWebhookHttpService.ts).

Если TELEGRAM_WEBHOOK_SECRET не задан — service_unavailable/503. Иначе x-telegram-bot-api-secret-token сравнивается с учётом длины и timingSafeEqual; несовпадение — forbidden/403. Session и limiter не используются. JSON трактуется как TelegramUpdate с message/callback_query; строгая Zod-схема не применяется.

Сначала обрабатываются profile-link и web-login, далее /start mobile и callback подтверждения. Выполняются изменения auth attempts, audit и ответы/редактирование сообщений бота. Подробные auth-переходы — [CLIENT_AND_AUTH_FLOWS](CLIENT_AND_AUTH_FLOWS.md). Нераспознанное обновление может завершиться без действия.

Успех — `{ ok: true, success: true }`; ошибки внешних сервисов/JSON идут через общий exception wrapper. Ответ 200 не гарантирует, что каждый неизвестный update имел эффект.

## WhatsApp diagnostics

<!-- api-contract: GET /api/whatsapp/diagnose -->
<!-- api-contract: GET /api/whatsapp/get-business-account -->
<!-- api-contract: GET /api/whatsapp/get-phone-numbers -->
<!-- api-contract: GET /api/whatsapp/test -->

С 2026-11-09 все четыре handler требуют cookie session и global super_admin **текущего** пользователя через [adminHttpAccess](../../apps/web/src/lib/adminHttpAccess.ts) до чтения server config и обращения к провайдеру. Отсутствующая identity → 401, неподходящая роль → 403, ошибка role lookup → 503; проверки с закрытым отказом покрыты [изолированными tests](../../apps/web/src/__tests__/api/admin/privileged-diagnostics-access.test.ts). Deployed ingress и реальные Graph API credentials этим не проверены.

| Путь | Вход, limiter | Ответ, ограничения и источники |
| --- | --- | --- |
| `/api/whatsapp/diagnose` | Без входов, normal limiter | При отсутствии access token — internal/500; иначе data с tokenCheck/businessAccounts/phoneNumbers/currentPhoneNumberId/recommendations и итогом из [service](../../apps/web/src/lib/whatsAppDiagnoseService.ts). Вызывает Graph API; отдельные отказы входят в данные при HTTP 200. [route](../../apps/web/src/app/api/whatsapp/diagnose/route.ts), [HTTP](../../apps/web/src/lib/whatsAppDiagnoseHttpService.ts), [route service](../../apps/web/src/lib/whatsAppDiagnoseRouteService.ts) |
| `/api/whatsapp/get-business-account` | Без входов, без limiter | Читает бизнесы через серверный token, выбирает первый и запрашивает телефоны. data.business_accounts, при наличии selected_account/phone_numbers/instructions; отдельный отказ телефонов может дать пустой список. [route](../../apps/web/src/app/api/whatsapp/get-business-account/route.ts), [HTTP](../../apps/web/src/lib/whatsAppAccountLookupHttpService.ts), [service](../../apps/web/src/lib/whatsAppAccountLookupService.ts) |
| `/api/whatsapp/get-phone-numbers` | Query account_id обязателен, normal limiter | Нет account_id — validation/400; нет token — internal/500. Успех data.phone_numbers/message/instructions либо data.data с нестандартным provider payload. Отказ Graph API передаёт provider HTTP status с error validation. [route](../../apps/web/src/app/api/whatsapp/get-phone-numbers/route.ts), HTTP/service — предыдущая строка |
| `/api/whatsapp/test` | Без входов, без limiter | data.configured/details/message/troubleshooting. Проверяет наличие env и цифровой phone ID; не связывается с провайдером. Возвращает phone ID и признаки наличия настроек, но не значения access/verify token. [route](../../apps/web/src/app/api/whatsapp/test/route.ts), [HTTP](../../apps/web/src/lib/whatsAppTestHttpService.ts), [service](../../apps/web/src/lib/whatsAppTestService.ts) |

`configured:true` в test означает только локальную проверку строк. Эти endpoints не следует считать подтверждением готовности интеграции, корректных прав провайдера или доставки сообщения.
