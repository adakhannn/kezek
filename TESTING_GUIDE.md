# Проверки Kezek

Статус: `reference`. Сверено с исходниками: **2026-11-10**. Владелец: **Engineering**.

Это основной справочник по проверкам. [Индекс документации](docs/README.md), [процесс изменений](CONTRIBUTING.md), [текущее инженерное состояние](docs/PROJECT_STATUS.md), [эксплуатация](docs/OPERATIONS.md).

Команды ниже описывают существующий инструментарий для отдельной разрешённой задачи в изолированной среде. Обновление документации не запускает проверки, не создаёт тестовые данные и не разрешает доступ к рабочей БД. Закрытая ручная WEB-кампания остаётся остановленной: её ограничения и приёмка находятся в [handoff](docs/WEB_AGENT_HANDOFF.md) и [ledger](docs/WEB_VERIFICATION_LEDGER.json).

## Что подтверждает каждый слой

| Слой | Что проверяет | Чего сам по себе не доказывает |
| --- | --- | --- |
| Lint / TypeScript | Правила кода и совместимость типов в выбранном scope | Работоспособность приложения, доступность интеграций |
| Jest с моками | Ветви логики, обработку входов, договорённости между модулями | Реальные RLS/RPC, конкурентность БД, доставку уведомлений |
| SQL scenarios | Выполнение выбранных SQL-сценариев на конкретной схеме | HTTP/auth/UI, все инварианты финансов и бронирования |
| Playwright | Наблюдаемые переходы в конкретной среде и с подготовленными данными | Невыполненные и пропущенные сценарии, другие роли/устройства |
| Нагрузочные и recovery-проверки | Ёмкость и восстановление при зафиксированных условиях | Другие конфигурации и объёмы данных |

Наличие тестового файла не означает PASS. Статический разбор кода не является результатом выполнения. Состав проверки, исходный кандидат, окружение и пропуски должны быть указаны рядом с результатом.

## Команды и их фактический scope

Все команды выполняются из корня репозитория. Источники: [root package.json](package.json), [web package.json](apps/web/package.json), [mobile package.json](apps/mobile/package.json), [core-domain package.json](packages/core-domain/package.json).

| Команда | Фактическое действие |
| --- | --- |
| `pnpm lint` | Корневой ESLint (рекомендованные правила JS для `scripts/` и `packages/`, `typescript-eslint` и запрет `console` для TypeScript в `packages/`), затем web и mobile (CI-02) |
| `pnpm -C apps/web lint` | `eslint . --max-warnings=13` внутри web: ошибки и рост предупреждений сверх зафиксированного потолка роняют проверку |
| `pnpm -C apps/mobile lint` | `eslint . --max-warnings=4` внутри mobile по конфигу Expo (`eslint-config-expo`): ошибки и новые предупреждения роняют проверку; четыре оставшихся — `react-hooks/exhaustive-deps` в потоках входа |
| `pnpm -C apps/web typecheck` | `tsc -p tsconfig.json --noEmit` внутри web |
| `pnpm -C apps/web test` | Jest по текущему web config; Playwright E2E исключены. Тесты API получают общие моки из `jest.setup.js` и проверяют фильтр по бизнесу через `expectBusinessScoped` ([справочник](apps/web/src/__tests__/api/TESTING_GUIDE.md)) |
| `pnpm -C apps/web test:coverage` | Полный web Jest с coverage по всему `src/**` и порогом-храповиком |
| `pnpm -C apps/web test:ci:core` | Явно перечисленные lib/finance/notification suites без coverage (локальная быстрая обратная связь; в CI их запускает полный `web_full_tests`) |
| `pnpm -C apps/web test:ci:extended` | Jest только под `src/__tests__/lib` и `src/__tests__/api`, без coverage gate |
| `pnpm -C apps/mobile typecheck` | TypeScript mobile |
| `pnpm -C apps/mobile test:runInBand` | Mobile Jest последовательно, без watch |
| `pnpm -C packages/core-domain test` | Все test.ts shared domain package, включая файлы рядом с исходниками и __tests__ |
| `pnpm -C packages/core-domain typecheck` | TypeScript shared domain package |
| `pnpm typecheck` | Typecheck web и mobile; packages проверяются своими командами |
| `pnpm check:i18n` | Паритет ключей ru/ky/en и `{параметров}` в переводах, `t('…')`-ключи, которых нет в словарях (`--report` выводит список), и повторы русского текста в серверных словарях. Храповик — русский текст `.tsx` и `.ts` вне `t()` по файлам ([база](scripts/i18n-untranslated-baseline.json)): в серверном коде сообщение из серверного словаря считается переведённым; рост роняет проверку, снижение записывается через `--write-baseline` (FE-10) |
| `pnpm check:silent-errors` | Ответ API с литеральным 5xx без `logError`/`logWarn`/`handleApiError`/`throw` в той же функции или catch — ошибка CI (ARCH-04); `createErrorResponse` логирует 5xx сам. Тесты сторожа — `node --test scripts/check-silent-server-errors.test.mjs` |
| `pnpm test:api` | Полный web Jest script; имя не ограничивает запуск API-папкой |
| `pnpm test:sql` | Legacy scenarios одним `psql -X --set=ON_ERROR_STOP=1` через Node внутри транзакции, которая откатывается; `SUPABASE_DB_URL` — только локальная база (localhost, контейнер) или хост из `KEZEK_SQL_TESTS_TARGET_HOST`, production отклоняется всегда |
| `pnpm test:sql:isolated` | Перечисленные в registry synthetic PostgreSQL contract/race runner в disposable Docker, без linked project и providers |
| `pnpm test` | Только web Jest (как `pnpm test:api`); legacy SQL scenarios запускаются отдельно и явно через `pnpm test:sql` |

Для изменения web-кода базовый набор — lint, typecheck и полный web Jest. Для логики сервисов, routes, repositories, validation и domain-adjacent кода добавляется coverage. Для shared packages выбираются проверки пакета и затронутых потребителей; минимум consumer typecheck указан в [CONTRIBUTING.md](CONTRIBUTING.md). Для документационных правок нужны проверка diff, ссылок и согласованности утверждений с источниками; продуктовые tests/build сами по себе не требуются.

## Что означает coverage

[apps/web/jest.config.js](apps/web/jest.config.js) считает coverage по **всему `apps/web/src`** (кроме тестов, `generated/` и `types/`). Порог — храповик по измерению 16 ноября 2026 на полном наборе (56,4% statements, 48,0% branches, 54,6% functions, 58,1% lines): падение ниже роняет `test:coverage`. Пороги поднимают по мере роста покрытия и не опускают, чтобы пропустить изменение. Mobile и packages этим знаменателем не охватываются.

`test:ci:core`, `test:ci:extended` и полный Jest пересекаются; результаты нельзя складывать как независимые тесты. Успех core не заменяет полный Jest. Отчёт должен называть команду, scope, coverage denominator и оставшиеся failures.

## Что действительно настроено в CI

Источник: [.github/workflows/ci.yml](.github/workflows/ci.yml). Ниже описана конфигурация, а не свежий результат CI и не настройки обязательных branch checks в GitHub.

| Job | Настроенные проверки | Ограничения |
| --- | --- | --- |
| `lint_typecheck` | Lint (scripts, packages, apps/web и apps/mobile), docs links, offline OpenAPI/SDK generation + typed consumer, shared client build/test typechecks + Jest, SQL runner unit checks, generated cron manifest parity, hotspot guardrails, typecheck web + mobile | Shared-client проверяется отдельными обязательными шагами |
| `build` | Web production build | Это сборка, не production smoke; при отсутствии Supabase secrets используются build placeholders |
| `web_full_tests` | Полный web Jest с coverage-храповиком: `test:coverage --ci --watchAll=false --maxWorkers=50%` | Включает components; внешние сервисы остаются mocked |
| `e2e_smoke_tests` | `test:e2e:smoke` | Страницы sign-in, terms, privacy; lifecycle не проверяется |
| `e2e_visual_regressions` | `test:e2e:visual` | На main/schedule есть preflight трёх env; остальные условия/skip-sites остаются в specs |
| `e2e_tests` | `test:e2e:full-seeded` | Job имеет `continue-on-error: true`; не все обязательные env переданы |
| `db_bootstrap` | `supabase start` + `db reset` с нуля, `check:db-types`, `check:sql-functions`, `check:function-catalog` | Локальный стек в CI: baseline, миграции и seed; не проверяет удалённую БД |
| `mobile_tests` | `test:runInBand` | Jest smoke, без доказательства реального устройства; mobile typecheck — в `lint_typecheck` |
| `mobile_build` | Metro-бандлы Android и iOS (`expo export`) на каждом прогоне; на тегах `mobile-*` и `release-*` — сборки EAS | Бандл не подписывается и не запускается на устройстве; без `EXPO_TOKEN` шаги EAS пропускаются |
| `sql_tests` | Matrix из всех зарегистрированных disposable PostgreSQL suites: mobile/Yandex auth, finance transactions, booking requests, notification outbox, staff-scoped slots, cron execution heartbeat, reporting completeness, shift-close backlog и дополнительные gates из registry | Нет skip по secret; synthetic fixtures не доказывают полную deployed schema или bootstrap |
| `redis_tests` | Production Lua в disposable Redis7: limiter concurrency/TTL/principal/tenant и shared performance merge/window/histogram/retention | Synthetic локальный Redis не доказывает Upstash deployment/ingress |
| `security_audit` | `pnpm audit --audit-level=high` | Dependency audit, не проверка ACL/RLS или прикладной безопасности |

Отдельные core-domain tests и mobile typecheck сейчас не вызываются в workflow отдельными jobs. Полный web Jest добавлен в `web_full_tests`; наличие job не подтверждает настройки обязательных branch checks. Это открытые пробелы, а не утверждение, что соответствующий код не проверялся никогда.

## Открытые ограничения проверок

1. **SQL isolation и legacy scenarios.** Ошибки native process теперь передаются без fallback, `psql` получает `-X` и `ON_ERROR_STOP=1`; PowerShell проверяет `$LASTEXITCODE`. Сценарии `tests_critical_scenarios.sql` выполняются в одной откатываемой транзакции и с 19 ноября 2026 идут в CI (`db_bootstrap`) на базе из полной цепочки миграций и seed. Расчёты рейтингов в них глобальные, поэтому цель — только локальная или явно разрешённая база. Подробности — в [supabase/TESTING.md](supabase/TESTING.md).
2. **E2E optional/skip.** Full-seeded job допускает ошибку, а `skipIfMissingE2EEnv` пропускает suites при отсутствии env. Например, workflow не передаёт необходимые для некоторых specs `E2E_TEST_MULTI_ROLE_EMAIL` и `E2E_TEST_CLIENT_SEARCH`. Реальное количество skipped определяется только сохранённым runtime report. См. [E2E reference](apps/web/e2e/README.md).
3. **Независимость ожиданий.** Первый SQL-сценарий закрывает смену настоящей командой, но суммы передаёт готовыми, как core-domain на сервере. Формулы гарантии и долей доказывают тесты core-domain, а не этот сценарий.
4. **Воспроизводимость среды.** Подготовленная схема, роли и fixtures обязательны для SQL/E2E. Наличие migrations/seed не подтверждает успешный bootstrap чистой БД; актуальное ограничение зафиксировано в [инженерном состоянии](docs/PROJECT_STATUS.md).
5. **Ёмкость и восстановление.** Здесь нет подтверждённого нагрузочного лимита или результата restore drill. Их протоколы и условия должны быть связаны с [эксплуатационной документацией](docs/OPERATIONS.md), а не выводиться из числа unit-tests.

## Как выбирать и фиксировать проверку

Перед разрешённым запуском назвать проверяемый инвариант, метод, среду и разрешённые побочные эффекты. SQL/E2E с созданием брони, изменением смен, пакетов или отправкой сообщений требуют отдельной подготовленной среды и согласованных fixtures; не направлять их на рабочие данные ради выполнения команды из справочника.

Для результата сохранить:

- ревизию/состав исходников, точную команду и рабочую директорию;
- среду, версию схемы и необходимые роли без секретов;
- время выполнения, exit code и первичный отчёт;
- PASS/FAIL/SKIP/NOT_RUN раздельно, с причинами пропусков;
- границу вывода: что проверено и какие требования остались открыты.

Не объявлять выпуск готовым по одному build, проценту coverage или успешной выборке тестов. Исторические результаты WEB не переписывать: [handoff](docs/WEB_AGENT_HANDOFF.md) указывает их дату, кандидата и первичные evidence.

## Специализированные справочники

- [API_TESTING.md](API_TESTING.md) — mocked route/service tests и границы их доказательств.
- [E2E_TESTING.md](E2E_TESTING.md) — вход в Playwright reference.
- [apps/web/e2e/README.md](apps/web/e2e/README.md) — реальные scripts, env contract и артефакты.
- [supabase/TESTING.md](supabase/TESTING.md) — SQL runner, данные и открытые ограничения.

Каждый набор в конце сверяет свои функции с [каталогом](supabase/generated/function-catalog.json), который `pnpm generate:function-catalog` строит из локальной базы со всей цепочкой миграций ([сверка](scripts/lib/live-schema.cjs)): тело, аргументы с умолчаниями, результат, SECURITY DEFINER, владельца, `config` и EXECUTE. Устаревшая или самописная копия живой функции и функция, которую миграции удалили, валят набор. Зависимость, которую набор не проверяет, ставится живым определением (`installLiveFunction`) или объявляется заглушкой с причиной; заглушка может отличаться только телом, языком, изменчивостью и `config`. Расхождений нет: 211 расхождений, найденных 19 ноября, исправлены в самих наборах, и ратчет, в котором они временно лежали, удалён; [guard](scripts/sql-suite-parity.test.mjs) держит его бюджет на нуле и требует сверку в каждом зарегистрированном наборе. Канонический список disposable SQL suites — [sql-isolated-suites.json](scripts/sql-isolated-suites.json). Команда test:sql:isolated читает его и останавливается на первом nonzero exit; [unit guard](scripts/isolated-sql-runner.test.mjs) проверяет совпадение обязательной CI matrix со списком.

ENG-31 добавляет в обязательную SQL-матрицу [изолированный Auth/REST runner](scripts/test-user-lifecycle-isolated.cjs): `node scripts/test-user-lifecycle-isolated.cjs`. Он использует отдельную internal Docker network, PostgreSQL 17, GoTrue v2.180.0, PostgREST v13.0.7 и Node 22 Alpine; host ports, production env и реальные provider-сообщения не нужны. Синтетические пользователи создаются через локальный Auth admin API. Проверяются сохранность ролей/истории, полный откат FK/session failure, повторы, устаревшие команды и отзыв access/refresh tokens. Это узкий интеграционный E2E ENG-31, не возобновление WEB-кампании и не замена device/remote E2E. Прогон всех миграций на фактической копии схемы/данных описан отдельно в отчёте ENG-31.
