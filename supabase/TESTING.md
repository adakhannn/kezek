# SQL scenarios: scope и ограничения

Статус: `reference`. Сверено с исходниками: **2026-11-10**. Владелец: **Engineering**.

Основной процесс — [TESTING_GUIDE.md](../TESTING_GUIDE.md). [Индекс](../docs/README.md), [эксплуатация](../docs/OPERATIONS.md), [инженерное состояние](../docs/PROJECT_STATUS.md).

SQL-файл выполняет записи и массовые расчёты. Его команды предназначены только для отдельной разрешённой задачи на подготовленной изолированной БД. Эта документация не разрешает подключаться к рабочему Supabase, создавать fixtures, применять миграции, сбрасывать БД или очищать данные. В документационной работе 30 октября SQL и тесты не запускались; [WEB handoff](../docs/WEB_AGENT_HANDOFF.md) остаётся действующим для закрытой кампании.

## Что находится в файле

[tests_critical_scenarios.sql](tests_critical_scenarios.sql) содержит пять последовательных PostgreSQL `DO`-блоков:

| Сценарий | Фактическое действие | Граница вывода |
| --- | --- | --- |
| Смена без клиентов с гарантией | Создаёт сущности, сам вычисляет и записывает суммы в `staff_shifts`, затем читает их | Не вызывает настоящее закрытие смены; не доказывает его расчёт |
| Промо при `paid` | Создаёт данные и вызывает `update_booking_status_with_promotion` | Проверяет выбранный пример на фактической схеме, не все акции/роли |
| Инициализация рейтингов | Вызывает `initialize_all_ratings(30)` и `recalculate_ratings_for_date` | Расчёт может затронуть другие данные той же БД |
| Смены, промо и рейтинги за несколько дней | Создаёт связанные данные и вызывает функции рейтингов/промо | Не заменяет HTTP/UI lifecycle или конкурентный тест |
| Рейтинг без активности | Удаляет метрики созданного сотрудника и вызывает `calculate_staff_rating` | Один отдельный инвариант |

Названия сценариев описывают намерение тестового кода, а не свежий PASS. Фактическую совместимость со схемой нужно подтвердить в отдельно подготовленной среде.

## Два разных способа запуска

Для отдельно разрешённой проверки legacy scenarios на подготовленной изолированной БД:

```bash
pnpm test:sql
```

Нужен явно заданный `SUPABASE_DB_URL` и установленный `psql`. [Root script](../package.json) вызывает [единый Node runner](../scripts/run-sql-tests.mjs): один запуск `psql -X --no-password --set=ON_ERROR_STOP=1`, без shell interpolation, выбора linked project или fallback после ошибки. Отсутствующий target — nonzero exit до запуска процесса. [Bash](../scripts/run-tests.sh) делегирует через `exec`; [PowerShell](../scripts/run-tests.ps1) проверяет `$LASTEXITCODE`. Native nonzero и прерывание завершают runner ошибкой; success другого shell не может её скрыть. [Tooling tests](../scripts/sql-runner.test.mjs) проверяют аргументы и передачу exit code с синтетическим process boundary, без подключения к БД.

Корневой `pnpm test` по-прежнему сначала запускает эти legacy scenarios, затем web Jest. Для unit-only работы использовать web Jest script из [основного справочника](../TESTING_GUIDE.md).

Для отдельных PostgreSQL контрактов и конкурентности существует независимый набор:

```bash
pnpm test:sql:isolated
```

Он требует Docker и образ PostgreSQL 16. Runners создают собственные disposable контейнеры с `--network none`, без host ports и host mounts; fixtures полностью synthetic. Они не читают `.env`, не выбирают linked Supabase и не отправляют сообщения провайдерам. Контейнер удаляется в cleanup; сбой Docker/SQL/assertion — ошибка, а не skip.

| Runner | Проверяемая граница |
| --- | --- |
| [mobile auth / Yandex](../scripts/test-mobile-auth-grants-isolated.cjs) | Однократное потребление grant/OTP/state, параллельные вызовы, expiry, права ролей |
| [finance](../scripts/test-finance-transactions.mjs) | Реальные command RPC на synthetic schema: actor/tenant, revision, rollback, overlap/locks, повторные команды |
| [booking](../scripts/test-booking-requests-isolated.cjs) | Атомарный idempotency claim/create, гонки и выбранные права ролей |
| [notification outbox](../scripts/test-booking-notification-outbox-isolated.cjs) | SQL lifecycle очереди, leases/receipts и конкурентность; детали assertions — в runner |
| [staff-scoped slots](../scripts/test-staff-scoped-slots-isolated.cjs) | Фильтрация выбранных сотрудников до resolver, фактические calls/rows и EXPLAIN на synthetic 1000 staff |

[CI](../.github/workflows/ci.yml) вызывает каждый runner из registry отдельным matrix job. Ни remote DB secret, ни условие «без secret пропустить» им не нужны. Это обязательные по workflow проверки без `continue-on-error`; настройки branch protection не подтверждены. Наличие конфигурации не является результатом CI. SQL gates не доказывают доставку реального provider, полный bootstrap проекта или совместимость всей удалённой схемы.

## Оставшиеся ограничения legacy SQL scenarios

1. **Нет общей rollback/cleanup-границы.** Успешные `DO`-блоки оставляют строки; последующая ошибка не отменяет предыдущие успешные блоки. Есть фиксированные slug и телефоны. Идемпотентность повторного прогона не обеспечена.
2. **Есть глобальные операции.** Например, `initialize_all_ratings` не ограничен единственной fixture. БД с рабочими/чужими тестовыми данными не является подходящей изоляцией.
3. **Первый сценарий проверяет записанные им значения.** Он не вызывает настоящий shift-close. Новый disposable finance runner вызывает command RPC, но это не меняет границу старого файла.
4. **Полный bootstrap отдельно не подтверждён.** Synthetic fixtures включают необходимые таблицы вручную и не являются доказательством развёртывания всего проекта из migrations/seed. Текущее состояние — в [PROJECT_STATUS.md](../docs/PROJECT_STATUS.md).

Для результата сохранять target environment без credentials, версию схемы, точную команду, exit code и failures/skips. Реальные права RLS, жизненный цикл HTTP/UI и delivery providers требуют своих проверок; privileged connection и успешный unit test их не заменяют.

Согласованные методы восстановления и migrations описываются через [OPERATIONS.md](../docs/OPERATIONS.md); старые команды из SQL Editor и ручной кампании не дают разрешения на их выполнение.


[cron execution heartbeat](../scripts/test-cron-execution-isolated.cjs) проверяет lifecycle/права/lease/freshness на synthetic PostgreSQL и входит в обязательную CI SQL matrix вместе с auth/finance/booking/outbox/slots.

[Reporting completeness](../scripts/test-reporting-completeness.mjs) и [shift-close backlog](../scripts/test-shift-close-backlog.mjs) также входят в [единый registry suites](../scripts/sql-isolated-suites.json). Детальная область assertions определяется каждым runner; общий PASS не заменяет replay на фактической схеме.

[WhatsApp inbox](../scripts/test-whatsapp-inbox-isolated.cjs) проверяет concurrent receive/claim, phone ownership, реальные защищённые booking transitions и атомарность outbox/receipt, lease/ambiguity, конечные retries, legacy quarantine и PII pruning с tombstone. Provider не вызывается.
