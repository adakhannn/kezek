# API-метрики, финансовые логи и бизнес-аналитика

Актуализировано: 2026-10-30. Владельцы: backend и эксплуатация. Статус: описание исходников; полнота данных, runtime ACL и deployment не проверены.

Вход — [OPERATIONS](docs/OPERATIONS.md). Этот документ отличает DB-метрики от [общих Redis performance-измерений](PERFORMANCE_MONITORING.md) и [health alerts](MONITORING_AND_ALERTS.md).

## Источники данных

| Источник | Содержимое и реализация | Ограничение |
| --- | --- | --- |
| `api_request_metrics` | Endpoint, метод, HTTP status, duration, error type, контекст пользователя/бизнеса, IP/User-Agent; [apiMetrics](apps/web/src/lib/apiMetrics.ts) | Явно инструментированные пути, не доказанная запись каждого запроса |
| `staff_finance_operation_logs` | Тип операции, уровень, IDs, before/after, metadata и ошибка; [миграция логов](supabase/migrations/20260214000000_create_finance_operation_logs.sql) | Наличие таблицы/триггеров в source не доказывает applied schema или полный аудит всех каналов записи |
| Redis performance client series | Строгие browser RPC/vitals/load/render агрегаты; [frontendMetricsService](apps/web/src/lib/frontendMetricsService.ts). Текущий collector больше не пишет legacy frontend_metrics | Недоверенные client measurements, без PII; best effort и собственный TTL, отдельно от server series |
| `analytics_events`, `funnel_events` | Продуктовые события и этапы воронки | События не тождественны подтверждённым операциям БД |
| `business_daily_stats`, `business_hourly_load` | Дневные и часовые агрегаты | Зависят от запуска cron, исходной выборки и правил времени |

Staff finance/open/close/items HTTP services вызывают `logApiMetric`. Запись выполняется отдельно от основного ответа и её ошибка не прерывает бизнес-операцию. Это best-effort телеметрия, не гарантированный журнал каждой операции. Нельзя утверждать, что все system-analytics API автоматически попадают в эту таблицу только по наличию helper.

## Поверхности мониторинга и доступ

Страница `/admin/monitoring` проходит через [admin layout](apps/web/src/app/admin/layout.tsx), проверяющий global super-admin. Прежнее описание доступа для обычного manager/owner было неверным.

Фактические route paths по дереву App Router:

| Route | Назначение | Параметры |
| --- | --- | --- |
| `GET /admin/api/metrics` | Список API-метрик | endpoint, method, statusCode, errorType, startDate/endDate, minDuration, limit/offset |
| `GET /admin/api/metrics/stats` | RPC-агрегаты по API | endpoint, method, windowMinutes |
| `GET /admin/api/finance-logs` | Список финансовых логов | staffId, bizId, shiftId, operationType, logLevel, startDate/endDate, limit/offset |

У списков limit по умолчанию 100, максимум 1000. Даты валидируются как `YYYY-MM-DD`. У stats окно по умолчанию 60 минут, максимум 1440; endpoint по умолчанию `/api/staff/finance`. Схемы ответа и фильтры: [metrics handler](apps/web/src/app/admin/api/metrics/route.ts), [stats handler](apps/web/src/app/admin/api/metrics/stats/route.ts), [finance logs handler](apps/web/src/app/admin/api/finance-logs/route.ts).

Эти три handlers вызывают [requireCurrentSuperAdmin](apps/web/src/lib/adminHttpAccess.ts) до service-role client: подтверждённая cookie-session и strict boolean от `is_super_admin()` через тот же session client. Канонический SQL связывает три поддерживаемых global role stores с `auth.uid()`, tenant role не даёт platform access. Anonymous/auth error дают401, отсутствие роли403, ошибка/неверный shape RPC503. Локальные regression tests не доказывают deployment или доступ реальной среды. Layout остаётся отдельным от route authorization.

Перечень routes служит справкой по коду. Запрет на посещение `/admin/monitoring` и запрещённый guest metrics probe в [WEB handoff](docs/WEB_AGENT_HANDOFF.md) сохраняется; данный документ не предлагает обхода или нового вызова этих поверхностей.

## Интерпретация метрик и финансовых логов

Анализируйте latency p95/p99, объём выборки, 4xx/5xx и бизнес-отказы отдельно. Среднее время и общий процент ошибок без профиля нагрузки не являются оценкой надёжности. Ранее приведённые оценки «до 5% ошибок нормально» и фиксированные latency как достигнутые показатели не используются: утверждённый SLO и ёмкость неизвестны.

При финансовом споре сопоставляют shift/booking IDs, before/after и исходную транзакцию, timestamp и timezone. Лог помогает расследованию, но не заменяет состояние БД и доказательство целостности; IP, metadata, before/after могут содержать персональные данные. Публичное распространение raw logs не предполагается.

## Бизнес-аналитика и сверка агрегатов

[Daily service](apps/web/src/lib/analyticsDailyCronService.ts) считает часть показателей по `analytics_events`, а выручку — по успешным bookings, промо-снимку и текущим ценам services. Значение `total_revenue` здесь может быть оценкой; оно не является автоматически сверенной фактической кассовой выручкой.

[Hourly service](apps/web/src/lib/analyticsHourlyLoadCronService.ts) и daily service вызывают SQL-команды из [reporting migration](supabase/migrations/20261110110000_reporting_completeness.sql). Они считают весь набор исходных строк внутри БД, в полуоткрытом интервале локального дня каждого бизнеса. Границы переводятся в UTC с учётом DST; повторный час осеннего перехода суммируется в один часовой bucket 0–23. REST max_rows не ограничивает SQL-агрегацию.

Каждый пересчёт даты атомарно заменяет её значения и удаляет устаревшие buckets после отмены/удаления исходных записей. Ошибка источника или записи возвращается как неуспех; успешно завершённые другие даты диапазона сохраняются. Без явного диапазона пересчитываются три предыдущие календарные даты, чтобы повторно охватить бизнесы, чей день завершился позже запуска. Явный диапазон ограничен 366 датами. Расписание, HTTP tracking и правила проверки свежести — в [CRON_SETUP](CRON_SETUP.md).

Read endpoints используют ограниченные датами SQL JSON-снимки с проверенным business scope; global overview возвращает агрегат по датам. Все строки внутри результата входят в суммы без зависимости от REST page cap. Изолированные проверки с >1000 строками, независимыми суммами, DST и удалением устаревших buckets доступны в [reporting runner](scripts/test-reporting-completeness.mjs). Это проверка реализации, а не утверждение о применении миграции или свежести удалённого графика.

Для отдельной разрешённой сверки владелец фиксирует бизнес, его timezone, полуоткрытые границы периода, статусы, точное определение каждого KPI и независимое ожидаемое значение. Сравнивают количество исходных записей с обработанным, суммы/промо и повторный расчёт после изменения данных. Не смешивать event date, booking start date и дату оплаты.

## Хранение и дальнейшее сопровождение

Сроки и исключения очистки — только в [DATA_RETENTION](DATA_RETENTION.md). Успешный cron/HTTP 200 не является доказательством отсутствия пропусков, частичных ошибок или корректной анонимизации. Текущий readiness — [PROJECT_STATUS](docs/PROJECT_STATUS.md); исторические тестовые результаты не заменяют новые эксплуатационные доказательства.

