# Измерение производительности

Статус: reference, обновлено 2026-11-10. Владелец: engineering и эксплуатация. Ёмкость проекта: **NOT_MEASURED**. Диагностические пороги не являются подтверждённым SLO.

Общий вход — [OPERATIONS](docs/OPERATIONS.md); DB API-метрики и бизнес-аналитика — [MONITORING_AND_ANALYTICS](MONITORING_AND_ANALYTICS.md).

## Источники и результат операции

[performanceCore](apps/web/src/lib/performanceCore.ts) содержит фиксированные списки series и pure classifier. [performanceServer](apps/web/src/lib/performanceServer.ts) экспортирует серверные измерения; [performance.ts](apps/web/src/lib/performance.ts) и [performanceClient](apps/web/src/lib/performanceClient.ts) — браузерные. Серверные credentials/Redis modules защищены server-only и не входят в граф browser facade.

| Source | Операции | Граница измерения |
| --- | --- | --- |
| server | shift_close, shift_close_dashboard | RPC финансового Close; остальные чтения/валидация HTTP-сценария вне этого таймера |
| server | apply_promotion, update_booking_status | RPC отметки посещения/промо |
| server | recalculate_ratings | RPC пересчёта рейтинга |
| client | get_free_slots_service_day_v2, get_free_slots_complex_day_v1, get_free_slots_page_v1 | Браузерный RPC в useSlotsLoader, без cache-hit и последующего рендера |
| client | LCP, FCP, TTFB, INP, CLS, page_load, render | Выбранные browser Web Vitals/load/render samples |

Promise resolution сама по себе не означает успех. Throw, верхнеуровневый error/ok:false/success:false и такие же явные отказы в RPC data дают error. Для Close требуется успешный data.ok receipt; неизвестный формат становится unknown. Серверный unknownCount показан отдельно; минимальный browser transport передаёт неизвестный исход как success=false. Это классификация выбранного RPC, а не доказательство успешности всей пользовательской операции.

## Общее ограниченное хранилище

[performanceStore](apps/web/src/lib/performanceStore.ts) использует те же UPSTASH_REDIS_REST_URL/TOKEN, что и общий limiter, но отдельный namespace performance:v1:source:operation:minute. Один write — атомарный Lua EVAL; read — один bounded EVAL. SDK retries и autopipelining выключены, hard deadline 500 ms + abort. Process-memory fallback отсутствует.

Время задаёт Redis TIME. Каждый минутный hash содержит count, outcomes, sum, min/max и 16 histogram buckets. Retention заканчивается через 15 минут от начала bucket; предел — 15 фиксированных series × 15 buckets, без raw events, IDs, IP, URL, user-agent, произвольных labels и metadata. Предел 10 миллионов samples на series/minute сохраняет числовые агрегаты ограниченными; превышение не подтверждается как запись. Duration ограничивается сверху 3600000 ms, CLS принимает 0..100 в безразмерной шкале.

Snapshot охватывает **пять завершённых минут**, исключая текущую неполную. Поэтому есть задержка до минуты. windowStart/windowEnd и timestamp приходят из Redis, не из разных часов экземпляров. Серверные экземпляры объединяются; браузер и сервер остаются отдельными series.

P95/P99 — **верхняя граница histogram bucket**, а не точный percentile по raw samples. Границы histogram зафиксированы в performanceCore. Count — число сохранённых измерений, errorRate — доля 0..1, unknownCount — отдельный остаток. Среднее/min/max используют фактические сохранённые значения. Для CLS поле unit=score; для остальных unit=ms. Имена avgDuration и других полей сохранены для wire compatibility, но единица определяется unit.

## Browser collector и панель

POST /api/metrics/frontend принимает только строгий объект operation/value/success. Source всегда client; финансовые server labels, дополнительные поля, отрицательные/нефинитные/чрезмерные значения отклоняются. Body ограничен 1024 bytes и deadline 1 s при чтении, включая поток без честного Content-Length. Collector публичный для public booking/vitals, с отдельным route limiter budget; он не обращается к Supabase и не пишет legacy frontend_metrics. Старые raw payloads больше не поддерживаются. Полученный HTTP 200 подтверждает ack агрегата, 503 означает отсутствие такого подтверждения.

Браузерные измерения остаются недоверенными: любой клиент может подделать допустимые значения в пределах своего budget. Они не могут стать server financial metrics. Beacon/fetch — best effort; нет retry, durable queue или гарантии доставки. localhost/127.0.0.1 не отправляют эти samples.

/admin/performance запрашивает GET /api/admin/performance/stats каждые 30 s. [Сервис](apps/web/src/lib/performanceStatsService.ts) проверяет текущую cookie-session и global super-admin. Auth error со stale user не даёт доступ; ошибка проверки роли/хранилища возвращает 503. Reachable empty store даёт status=no_data; это не healthy и не нулевая частота ошибок. Панель маркирует client/server, unknown outcomes, приблизительные percentiles и отдельную единицу CLS.

UI latency thresholds — локальные диагностические настройки. Внешние performance alerts этим механизмом не отправляются. [Health alerts](MONITORING_AND_ALERTS.md) и cron heartbeat — отдельные механизмы.

## Проверки и пределы доказательства

Адресные unit/HTTP/UI tests проверяют result classifier, сохранение business result при exporter failure, timeout/fail-closed reads, strict client schema и browser import boundary. [Disposable Redis runner](scripts/test-performance-metrics-isolated.mjs) исполняет production Lua: независимые конкурентные writers, объединение outcomes/histogram, Redis TIME, границы окна, namespaces и expiry. Он входит в redis_tests CI. Это synthetic локальный Redis, не проверка конфигурации Upstash deployment.

Потеря экспортера не отменяет уже выполненную финансовую команду; вызывается logWarn без provider details (этот logger подавляет warn в production). Process termination, exporter outage, browser blocking или rate limiting могут потерять measurements. Эти агрегаты не являются полным audit log, общим HTTP RPS или единственным источником SLO. Legacy DB API-метрики продолжают иметь собственные границы и retention.

## Замер ёмкости

Число поддерживаемых пользователей/RPS пока неизвестно. Для оценки нужны разрешённый изолированный стенд, конкретные ресурсы/регионы, реалистичный объём данных, mix запросов и concurrency, latency/error/DB lock/connection/CPU/backlog показатели и одновременная проверка инвариантов бронирования и финансов. Наличие instrumentation не заменяет такой отчёт.
