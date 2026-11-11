# Закрытие начатого пакета — 11 ноября 2026

Статус: **LOCAL_PACKAGE_COMPLETE**. Аудитория: владелец проекта, разработчик и ревьюер. Ответственная роль: сопровождающий репозитория. Это локальная инженерная проверка по прямому запросу человека; готовность к публичному выпуску не заявляется.

## Граница пакета

Завершены уже начатые изменения: финансовые revision/атомарность/календарь и корректировка часов, повторяемые booking-команды, SQL ACL, durable outbox/inbox, Redis limiter/metrics, ограниченная выдача слотов, полные SQL-отчёты, cron tracking и общие проверки. Новый geo-функционал и переработка удаления/блокировки пользователей не начинались.

Старую WEB-кампанию и automation не возобновляли. Ledger/acceptance не изменялись. Рабочие файлы и заранее подготовленный индекс сохранены; commit, stage, reset, push, deploy и изменение удалённой БД не выполнялись. Реальные provider-сообщения не отправлялись.

## Проверки

| Проверка | Итог |
| --- | --- |
| Полный web test:coverage | **600 suites / 3498 tests PASS**, 0 failures, 0 skipped/todo |
| Web lint | **0 errors / 124 warnings**, exit 0 |
| Web typecheck | PASS, чистый `tsc --noEmit --incremental false` |
| Mobile | **46 suites / 257 tests PASS**, typecheck PASS |
| Core domain | **4 suites / 58 tests PASS**, typecheck PASS; все существующие test.ts включены |
| Shared client | **2 suites / 10 tests PASS**, production/test typecheck PASS |
| Web release build | PASS на изолированной копии с синтетическими env и блокировкой внешней сети |
| SQL | **Все 14 зарегистрированных изолированных наборов PASS**: 9 до обнаруженного сбоя синхронизации, затем исправленный boundary runner и 4 оставшихся набора |
| Redis | Atomic counters/TTL/principal budgets и shared metrics/retention PASS на отдельных локальных Redis |
| Копия фактической БД | Исходные public + auth восстановлены; **21 новая миграция PASS** по порядку, каждый файл с ON_ERROR_STOP и транзакцией |
| Поведение на копии БД | Finance revision/tenant/DML; booking receipt/proof/outbox; paged slots; maintenance ACL; platform-role grant/revoke; closed-hours revision/aggregates; queue health и legacy RPC ACL — PASS, проверочные изменения rollback |
| Документация / генераторы / diff | 29 tooling tests PASS; ссылки/каталоги/OpenAPI/SDK/8 cron jobs PASS; diff-check PASS |

Полный первый web-прогон выявил 21 падение: 3460 PASS / 21 FAIL. Причины — не обновлённые под новые границы тестовые doubles/fixtures: RPC вместо цепочек REST, service-only booking с abortSignal, calendarDate/revision/day metadata и канонический сохранённый master_share. Все исходные сценарии сохранены, добавлены отрицательные проверки неполного финансового снимка. Проверки результатов не заменялись на acceptance ошибок: тест неверного period дополнительно ужесточён до обязательного 400 без RPC.

В SQL concurrency runner фиксированная двухсекундная пауза не гарантировала старт второго процесса при нагрузке. Теперь первая транзакция держит настоящие блокировки до наблюдения Lock wait второй сессии; затем разрешается commit. Проверки сериализации, отката, списаний и outbox сохранены. Это исправление синхронизации теста, не SQL обход.

Отдельный core-domain gate обнаружил незакрытую скобку и устаревшие типы в useCases.test.ts. Исправлены fixtures и удалены ненужные suppressions; Jest теперь включает все четыре существующих test.ts, включая два ранее не запускавшихся файла. Доменная production-логика на этом шаге не менялась.

ESLint rules, web Jest test selection, существующий coverage allowlist и порог 60% не ослаблялись. Coverage относится только к этому allowlist. Пересекающиеся адресные наборы не прибавляются к полному счётчику.

## База данных и воспроизводимость

Использована частная копия тестового Supabase от 10 ноября: PostgreSQL 17.4, native schema/data dumps. Восстановление — PostgreSQL 17.6 в собственном контейнере network=none, без портов и пользовательских mounts. Перенесены только восемь Auth UUID для внешних ключей, без Auth secrets/passwords/sessions. Исходные counts: 3 closed shifts, 2 shift items, 30 bookings. Определения/данные дампов не публикуются в Git.

Все **новые миграции пакета**, начиная с 20261109090000 и заканчивая 20261110140000, применены к восстановленному baseline. Старые уже применённые миграции не проигрывались заново; это не чистый bootstrap из пустой БД. Точный порядок и SHA-256 — в [verification.json](verification.json). Два расхождения истории июля/октября остаются описаны в [порядке миграций](../../../supabase/APPLY_MIGRATIONS.md); слепой db push --include-all не выполнялся.

[Предыдущие проверки фактической схемы](../engineering-2026-11-10-critical/summary.md) сохранены отдельно. Проверка исходных constraints подтвердила существующее booking no_overlap; отсутствие exclusion-защиты не заявляется. Native restore и миграционный replay не измеряют PITR/RTO всего сервиса.

Для повторения локальных проверок из корня checkout:

~~~bash
pnpm -C apps/web test:coverage --maxWorkers=2 --silent --json --outputFile=<private-report>
pnpm -C apps/web lint
pnpm -C apps/web exec tsc -p tsconfig.json --noEmit --incremental false
pnpm -C apps/mobile test --runInBand --silent
pnpm -C apps/mobile typecheck
pnpm -C packages/core-domain typecheck
pnpm -C packages/core-domain test --runInBand --silent
pnpm -C packages/shared-client typecheck
pnpm -C packages/shared-client test --runInBand --silent
node scripts/run-isolated-sql-tests.mjs
node scripts/test-rate-limit-isolated.mjs
node scripts/test-performance-metrics-isolated.mjs
node --test scripts/sql-runner.test.mjs scripts/isolated-sql-runner.test.mjs scripts/openapi-tools.test.mjs scripts/docs-tools.test.mjs
node scripts/generate-cron-manifests.mjs --check
node scripts/check-doc-links.mjs
git diff --check
~~~

Release build запускался как `next build` в отдельной копии исходников/dependencies без .env, с синтетическими ключами и запрещённой внешней сетью. Это настоящая оптимизированная сборка с TypeScript и prerender, но не проверка доступности Supabase/провайдеров или настроек Vercel. Private logs и backup hashes перечислены в verification.json; чувствительные файлы остаются вне репозитория.

## Оставшиеся проблемы

1. **ENG-31 / P1 — удаление и блокировка пользователей.** Частичные изменения до Auth outcome, неполный target-role guard, не подтверждён отзыв сессий. Новый atomic toggle-super не устраняет эти сценарии. [Контракты admin API](../../api/ADMIN_API.md).
2. **ENG-10 / P1 — полнота карты/nearby.** Ограничение кандидатов до геофильтра может скрывать подходящие филиалы; SQL geo/pagination в этот пакет не включались.
3. **Развёртывание.** Исправления остаются локальными; удалённая БД сохраняет прежние границы доступа. Нужны проверка актуальности baseline, reconciliation истории и согласованный выпуск SQL/web/mobile. Старые клиенты могут перестать работать после новых ACL/protocol.
4. **E2E и CI.** Полный browser/provider/device/seeded E2E не выполнен. Штатный Playwright использует application env/reuseExistingServer и зависимые от auth fixtures; безопасный изолированный полный bootstrap не подготовлен. Старый ручной campaign не запускался. Remote CI execution и обязательность всех E2E jobs не подтверждены.
5. **Нагрузка и эксплуатация.** Реальный предел RPS, длительный backlog, расходы Vercel/Redis/Supabase, provider throughput, внешний монитор, PITR/RTO и доставка до получателя не измерены. Синтетические SQL/Redis проверки не дают числа пользователей, которое выдержит проект.
6. **Неполный охват оставшихся сценариев.** Legacy today reader сохраняет application-TZ/default-rate поведение; old Telegram Widget, остальные destructive/admin workflows, geo и общая RPC-поверхность не объявлены полностью проверенными. `admins/list` сохраняет отдельно описанную проблему tenant check. [Реестр](../../ENGINEERING_FINDINGS.md).
7. **Технический остаток.** 124 lint warnings, предупреждения сборки о middleware convention/нескольких lockfiles/устаревшей browser baseline базе. Полный базовый SQL bootstrap отсутствует в checkout. SDK подробно моделирует 4 операции; остальные присутствуют в inventory, а не выдаются за готовые typed contracts.

Этот остаток фиксируется для следующей отдельной задачи; текущий пакет его не скрывает и не расширяется на его исправление.
