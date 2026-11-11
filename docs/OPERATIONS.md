# Эксплуатация Kezek

Актуализировано: 2026-11-10. Владелец: эксплуатация. Статус документа: текущие исходники и отдельно проверенная схема тестовой БД; Vercel deployment не инспектировался. Ёмкость: **NOT_MEASURED**.

Это основной вход в эксплуатационные документы. Общий индекс — [README](README.md), текущая оценка проекта — [PROJECT_STATUS](PROJECT_STATUS.md). WEB-кампания закрыта, automation `kezek` остаётся **PAUSED**; действующие ограничения и принятые результаты находятся в [WEB_AGENT_HANDOFF](WEB_AGENT_HANDOFF.md) и связанном ledger. Чтение этого документа не возобновляет старую очередь.

## Что известно об архитектуре

| Компонент | Факт из репозитория | Что неизвестно о deployment |
| --- | --- | --- |
| Web/API | Next.js в `apps/web`; владелец выбрал Vercel Pro / Enterprise | Hosting project/root, release revision, регион, число экземпляров, CPU/RAM, duration/concurrency limits |
| Данные | Supabase; 10 ноября прочитаны фактические schema/ACL/history тестового проекта, PostgreSQL 17.4; копия восстановлена в изоляции | Применение нового набора миграций, ресурсы, pool/connection limits, удалённый max_rows |
| Клиенты | Web и Expo/React Native; общие domain/client packages | Опубликованные версии и соответствие серверному контракту |
| Rate limiting | Production Upstash Redis fail-closed; process memory только non-production | Активный backend, регион, квоты, trusted proxy configuration |
| Исходящие уведомления | Транзакционный booking outbox, worker с lease/deadline и результатами получателей; включается явной переменной | Активные провайдеры, квоты, подтверждённая доставка и ответственный |
| Фоновые операции | Общий источник расписаний для двух Vercel manifest, журнал начала/результата в БД | Регистрация в deployment, внешние schedulers, наблюдаемый last-success и backlog |
| Наблюдаемость | Общие Redis performance aggregates, DB telemetry, Sentry-конфигурация и email health alerts | Полнота сбора, активные DSN/alert channels, дежурство, SLO |

Неизвестное не означает отсутствие инфраструктуры. Это означает, что её свойства не подтверждены доступными в этой задаче evidence и не должны выдаваться за гарантии проекта.

## Источники конфигурации

- [apps/web/package.json](../apps/web/package.json) и [next.config.ts](../apps/web/next.config.ts) задают команды и настройки приложения.
- [apps/web/vercel.json](../apps/web/vercel.json) и [корневой vercel.json](../vercel.json) получают одинаковый cron list из [общего определения](../apps/web/src/config/cronJobs.json); генератор проверяется в CI. Правила регистрации, наблюдения и восстановления — [CRON_SETUP](../CRON_SETUP.md). Наличие конфигурации не доказывает её исполнение в deployment.
- [supabase/config.toml](../supabase/config.toml) описывает локальный Supabase. Его `max_rows = 1000`, PostgreSQL major version и выключенный local pooler не доказывают соответствующие настройки удалённого проекта.
- [.github/workflows/ci.yml](../.github/workflows/ci.yml) описывает CI, а не доказанный release/deployment process. [ENV_GUIDE](../ENV_GUIDE.md) описывает переменные; реальные значения хранятся вне документации.
- Применение миграций и восстановление имеют собственные процедуры: [APPLY_MIGRATIONS](../supabase/APPLY_MIGRATIONS.md), [BACKUP_AND_RESTORE](../supabase/BACKUP_AND_RESTORE.md). Наличие процедуры не является доказательством её исполнения.

Для каждого фактического окружения эксплуатационная запись должна указывать owner-role, дату проверки, hosting project ID, source/deployment revision, Supabase project reference, applied migration revision, ресурсы/регионы, активный cron manifest и ссылку на результаты проверки. Секреты, токены и raw персональные данные в запись не включаются. До такой записи значения остаются `UNKNOWN`.

## Рабочие справочники

| Вопрос | Документ |
| --- | --- |
| Границы staging и что подтверждает его изоляцию | [STAGING_ENVIRONMENT](../STAGING_ENVIRONMENT.md) |
| Cron schedules, результат и пропущенные/частичные исполнения | [CRON_SETUP](../CRON_SETUP.md) |
| Latency, общая performance-панель и её ограничения | [PERFORMANCE_MONITORING](../PERFORMANCE_MONITORING.md) |
| DB API-метрики, финансовые логи, аналитика и границы доступа | [MONITORING_AND_ANALYTICS](../MONITORING_AND_ANALYTICS.md) |
| Health checks, попытки отправки alerts и конфигурация получателя | [MONITORING_AND_ALERTS](../MONITORING_AND_ALERTS.md) |
| IP/user/route ключи, Redis и fallback limiter | [RATE_LIMITING](../RATE_LIMITING.md) |
| Очистка, анонимизация и due account deletion | [DATA_RETENTION](../DATA_RETENTION.md) |
| Backup/restore процедура | [BACKUP_AND_RESTORE](../supabase/BACKUP_AND_RESTORE.md) |

## Ёмкость и восстановление

Допустимые RPS, concurrent users, пиковое число bookings, SLO latency/error rate и эксплуатационный запас сейчас **не измерены**. Числа из пресетов limiter, SQL/API row caps и performance thresholds не являются результатом нагрузочного теста. Для доказательства ёмкости нужен отчёт на конкретных ресурсах с реалистичным объёмом данных, mix запросов, saturation/error/latency показателями и проверкой целостности данных.

Backup/PITR enabled state, фактическое окно хранения, last successful backup, проверенный restore point, измеренные RPO/RTO и охват Storage/внешних провайдеров — **UNKNOWN / NOT_VERIFIED**. Рекомендации в backup guide не превращают их в достигнутые гарантии. Результат восстановления должен содержать дату, исходную и изолированную целевую среду, revision, потерю данных, время восстановления и проверки целостности; восстановление поверх production не является способом проверить документ.

## Запись инцидента

Для отдельной разрешённой диагностики сохраняют время и timezone, окружение/revision, затронутый пользовательский сценарий, наблюдаемую ошибку, корреляционные IDs без секретов, область влияния, источник evidence и owner-role следующего действия. Разделяют факт, гипотезу и неизвестную причину. Успешный HTTP cron, отсутствие performance-метрик и зелёная UI-панель сами по себе не закрывают инцидент.

Этот документ не задаёт автоматические production-пробы, отправку уведомлений, нагрузочный прогон, рестарт, cleanup или миграции. Такие действия следуют из отдельной прямой задачи и её разрешённой среды. Продуктовые дефекты, указанные в справочниках, остаются открытыми до отдельного исправления и проверки.

## User lifecycle ENG-31

Для сопровождающего, применяющего согласованный release; источник — [контракт](api/ADMIN_API.md#блокировка-и-удаление-пользователей-eng-31) и [миграция](../supabase/migrations/20261111090000_user_lifecycle.sql). Локальные проверки не означают применения к Supabase.

1. Сначала сверить историю миграций и сделать backup; существующий baseline и aliases описаны в [инструкции миграций](../supabase/APPLY_MIGRATIONS.md). Применить предшествующие зависимости и ENG-31 до переключения web handlers. Старый handler с разрушительной предварительной очисткой нельзя оставлять активным во время rollout: нужна пауза административных lifecycle-операций до обновления обеих сторон.
2. Проверить существующий PostgREST pre-request hook, включая role/database settings и config/env deployment. Миграция отказывается перетирать другой SQL hook; объединение с существующим hook требует отдельного явного изменения. Убедиться, что конфигурация сервиса не перекрывает `public.check_user_lifecycle_request`. Для будущих RLS-таблиц public/storage добавлять restrictive `user_lifecycle_access_allowed()`.
3. Проверить права владельца функций/триггеров в Auth и работу Auth после миграции. Локальный интеграционный runner использует GoTrue v2.180.0, PostgREST v13.0.7 и synthetic PostgreSQL 16; фактическая копия схемы/данных проверяется отдельно на Supabase PostgreSQL 17.6. Обновление managed Auth требует повторения lifecycle-контрактов: порядок app_metadata/ban и схема sessions являются проверяемой зависимостью.
4. В разрешённом staging подтвердить block → отказ старого access/refresh token и нового входа → unblock → новый вход; delete → сохранность истории. Реальные Storage/Realtime соединения и конкретный remote deployment требуют отдельной проверки. Уже выданный публичный URL, загруженные данные и ранее авторизованный запрос не отзываются этим протоколом.
5. При 503 повторить **то же действие с тем же reason**. Receipt определяет завершение, даже если ответ Auth потерян. Противоположное действие при pending даёт 409. Не удалять pending row и не переключать состояние вручную: запоздавший запрос ещё может исполняться. При постоянном FK/Auth отказе исправить установленную причину, затем повторить команду. Если прежний actor потерял роль, тот же повтор может выполнить другой действующий SA.

Прямые dashboard/API ban/delete без lifecycle-команды теперь намеренно отклоняются триггером; административный путь — обновлённые handlers. Service-only завершение due self-deletion сохраняется по собственной проверенной заявке. Нет автоматического восстановления ролей/связей, потерянных старой реализацией; такое восстановление требует отдельного подтверждённого источника.
