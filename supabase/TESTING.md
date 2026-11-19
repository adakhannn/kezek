# SQL scenarios: scope и ограничения

Статус: `reference`. Сверено с исходниками: **2026-11-10**. Владелец: **Engineering**.

Основной процесс — [TESTING_GUIDE.md](../TESTING_GUIDE.md). [Индекс](../docs/README.md), [эксплуатация](../docs/OPERATIONS.md), [инженерное состояние](../docs/PROJECT_STATUS.md).

SQL-файл выполняет записи и массовые расчёты. Его команды предназначены только для отдельной разрешённой задачи на подготовленной изолированной БД. Эта документация не разрешает подключаться к рабочему Supabase, создавать fixtures, применять миграции, сбрасывать БД или очищать данные. В документационной работе 30 октября SQL и тесты не запускались; [WEB handoff](../docs/WEB_AGENT_HANDOFF.md) остаётся действующим для закрытой кампании.

## Что находится в файле

[tests_critical_scenarios.sql](tests_critical_scenarios.sql) содержит пять последовательных PostgreSQL `DO`-блоков:

| Сценарий | Фактическое действие | Граница вывода |
| --- | --- | --- |
| Смена без клиентов с гарантией | Создаёт открытую смену и закрывает её настоящей командой `close_staff_shift_command` с расчётом, как его передаёт сервер; повтор возвращает `already_closed` | Суммы считает core-domain на сервере, их формулы проверяют тесты core-domain; сценарий проверяет проверки и сохранение команды |
| Промо при `paid` | Создаёт клиента-аккаунт, сотрудника с назначением в филиал и бронь, закончившуюся до оплаты, и вызывает `update_booking_status_with_promotion` | Скидка за первый визит; не все акции и роли |
| Инициализация рейтингов | Вызывает `initialize_all_ratings(30)` и `recalculate_ratings_for_date` | Расчёт может затронуть другие данные той же БД |
| Смены, промо и рейтинги за несколько дней | Создаёт связанные данные, проверяет, что шестой визит оплачивается без акции «седьмой бесплатно», а седьмой бесплатно, и вызывает функции рейтингов | Не заменяет HTTP/UI lifecycle или конкурентный тест |
| Рейтинг без активности | Удаляет метрики созданного сотрудника и вызывает `calculate_staff_rating` | Один отдельный инвариант |

С 19 ноября 2026 файл соответствует текущей схеме (CI-03): клиент — аккаунт в `auth.users`, у сотрудника есть назначение в филиал, команды вызываются с JWT-ролью `service_role`, как их вызывает сервер. CI прогоняет файл в `db_bootstrap` через `pnpm test:sql` на базе, собранной из baseline, миграций и seed. Переработка нашла ошибку акций ENG-123: оплачиваемая бронь считалась своим же визитом, а старые сценарии это скрывали, потому что ставили время брони в будущем.

## Два разных способа запуска

Для отдельно разрешённой проверки legacy scenarios на подготовленной изолированной БД:

```bash
pnpm test:sql
```

Нужен явно заданный `SUPABASE_DB_URL` и установленный `psql`. [Root script](../package.json) вызывает [единый Node runner](../scripts/run-sql-tests.mjs): один запуск `psql -X --no-password --set=ON_ERROR_STOP=1`, без shell interpolation, выбора linked project или fallback после ошибки. Отсутствующий target — nonzero exit до запуска процесса. [Bash](../scripts/run-tests.sh) делегирует через `exec`; [PowerShell](../scripts/run-tests.ps1) проверяет `$LASTEXITCODE`. Native nonzero и прерывание завершают runner ошибкой; success другого shell не может её скрыть. [Tooling tests](../scripts/sql-runner.test.mjs) проверяют аргументы и передачу exit code с синтетическим process boundary, без подключения к БД.

Корневой `pnpm test` больше не запускает эти scenarios (CI-06): раньше он писал в любую базу из `SUPABASE_DB_URL`, включая production. Теперь runner принимает только локальную базу (localhost, ::1, контейнер или сервис без точки в имени) или один хост из `KEZEK_SQL_TESTS_TARGET_HOST`, production-проект отклоняет всегда и выполняет файл внутри транзакции, которая откатывается, так что тестовые строки и пересчитанные рейтинги не остаются. До 19 ноября 2026 сценарии 2 и 4 обращались к удалённой таблице `public.clients`, а сценарий 1 проверял записанные им же суммы; теперь все пять проходят на полной цепочке миграций.

Для отдельных PostgreSQL контрактов и конкурентности существует независимый набор:

```bash
pnpm test:sql:isolated
```

Он требует Docker и образ PostgreSQL 17 ([isolated-postgres](../scripts/lib/isolated-postgres.cjs)). В конце каждый набор сверяет свои функции с каталогом, построенным из полной цепочки миграций ([порядок](../TESTING_GUIDE.md)). Runners создают собственные disposable контейнеры с `--network none`, без host ports и host mounts; fixtures полностью synthetic. Они не читают `.env`, не выбирают linked Supabase и не отправляют сообщения провайдерам. Контейнер удаляется в cleanup; сбой Docker/SQL/assertion — ошибка, а не skip.

| Runner | Проверяемая граница |
| --- | --- |
| [mobile auth / Yandex](../scripts/test-mobile-auth-grants-isolated.cjs) | Однократное потребление grant/OTP/state, параллельные вызовы, expiry, права ролей |
| [finance](../scripts/test-finance-transactions.mjs) | Реальные command RPC на synthetic schema: actor/tenant, revision, rollback, overlap/locks, повторные команды |
| [booking](../scripts/test-booking-requests-isolated.cjs) | Атомарный idempotency claim/create, гонки и выбранные права ролей |
| [notification outbox](../scripts/test-booking-notification-outbox-isolated.cjs) | SQL lifecycle очереди, leases/receipts и конкурентность; детали assertions — в runner |
| [staff-scoped slots](../scripts/test-staff-scoped-slots-isolated.cjs) | Фильтрация выбранных сотрудников до resolver, фактические calls/rows и EXPLAIN на synthetic 1000 staff |
| [явные расписания](../scripts/test-explicit-schedules-db.mjs) и ещё шесть наборов расписаний и писателей броней | Публикация, слоты, отсутствия, возврат дня, гостевые и комплексные резервы, гонки на блокировке сотрудника; общий [стенд](../scripts/lib/explicit-schedule-fixture.mjs) |

[CI](../.github/workflows/ci.yml) вызывает каждый runner из registry отдельным matrix job. Ни remote DB secret, ни условие «без secret пропустить» им не нужны. Это обязательные по workflow проверки без `continue-on-error`; настройки branch protection не подтверждены. Наличие конфигурации не является результатом CI. SQL gates не доказывают доставку реального provider, полный bootstrap проекта или совместимость всей удалённой схемы.

## Оставшиеся ограничения legacy SQL scenarios

1. **Откат даёт только runner.** Блоки не удаляют свои строки сами; их откатывает транзакция `pnpm test:sql`. Запуск файла другим способом оставит строки с фиксированными slug.
2. **Есть глобальные операции.** Например, `initialize_all_ratings` не ограничен единственной fixture. БД с рабочими/чужими тестовыми данными не является подходящей изоляцией.
3. **Расчёт смены передаётся готовым.** Первый сценарий вызывает настоящую команду закрытия, но суммы гарантии и долей считает core-domain на сервере; их формулы проверяют тесты core-domain.
4. **Synthetic fixtures остаются отдельными.** Изолированные наборы строят нужные таблицы сами и не доказывают развёртывание всего проекта; это делает `db_bootstrap`, где проходит и этот файл. Текущее состояние — в [PROJECT_STATUS.md](../docs/PROJECT_STATUS.md).

Для результата сохранять target environment без credentials, версию схемы, точную команду, exit code и failures/skips. Реальные права RLS, жизненный цикл HTTP/UI и delivery providers требуют своих проверок; privileged connection и успешный unit test их не заменяют.

Согласованные методы восстановления и migrations описываются через [OPERATIONS.md](../docs/OPERATIONS.md); старые команды из SQL Editor и ручной кампании не дают разрешения на их выполнение.


[cron execution heartbeat](../scripts/test-cron-execution-isolated.cjs) проверяет lifecycle/права/lease/freshness на synthetic PostgreSQL и входит в обязательную CI SQL matrix вместе с auth/finance/booking/outbox/slots.

[Reporting completeness](../scripts/test-reporting-completeness.mjs) и [shift-close backlog](../scripts/test-shift-close-backlog.mjs) также входят в [единый registry suites](../scripts/sql-isolated-suites.json). Детальная область assertions определяется каждым runner; общий PASS не заменяет replay на фактической схеме.

[WhatsApp inbox](../scripts/test-whatsapp-inbox-isolated.cjs) проверяет concurrent receive/claim, phone ownership, реальные защищённые booking transitions и атомарность outbox/receipt, lease/ambiguity, конечные retries, legacy quarantine и PII pruning с tombstone. Provider не вызывается.
