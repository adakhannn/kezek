# Playwright reference

Статус: `reference`. Сверено с исходниками: **2026-10-30**. Владелец: **Engineering**.

Основной процесс: [TESTING_GUIDE.md](../../../TESTING_GUIDE.md). [Индекс](../../../docs/README.md), [инженерное состояние](../../../docs/PROJECT_STATUS.md), [закрытая WEB-кампания](../../../docs/WEB_AGENT_HANDOFF.md).

Этот документ описывает текущие файлы и команды, а не успешный прогон. Команды предназначены только для отдельной разрешённой задачи в изолированной среде. В документационной работе 30 октября E2E, сервер и build не запускались. Ограничения ручной WEB-кампании, включая допустимый метод браузерных проверок, этим справочником не отменяются.

## Реальная конфигурация

Источники: [package.json](../package.json), [playwright.config.ts](../playwright.config.ts), [testEnv.ts](testEnv.ts), [CI workflow](../../../.github/workflows/ci.yml).

- Browser project — Chromium с Desktop Chrome preset. Наличие отдельных viewport в visual specs не подтверждает реальные устройства.
- `fullyParallel: true`; в CI задан один worker и до двух retries. Несколько scripts дополнительно задают `--workers=1`.
- Runner использует `PLAYWRIGHT_TEST_BASE_URL` или `http://localhost:3000`.
- `webServer` настроен на `pnpm dev`, localhost:3000 и reuse существующего сервера вне CI. Он не переключается автоматически на production build; наличие внешнего base URL не убирает этот локальный webServer config.
- Env читается из `process.env`. В Playwright config нет явной загрузки `.env.local` для runner. Загрузка env самим Next.js не является настройкой env процесса Playwright; передавать значения нужно согласованным способом в окружение runner, без публикации секретов.
- При отсутствии Supabase env конфигурация содержит placeholder-значения. Они не являются рабочей test DB.

## Scripts

Все команды запускаются из корня репозитория после отдельного разрешения и подготовки среды.

| Команда | Выборка |
| --- | --- |
| `pnpm -C apps/web test:e2e:smoke` | `smoke-public.spec.ts`: sign-in, terms, privacy |
| `pnpm -C apps/web test:e2e:http` | `whatsapp-webhook.spec.ts`: request-level сценарий; это не offline unit test |
| `pnpm -C apps/web test:e2e:visual` | `visual-regressions.spec.ts` |
| `pnpm -C apps/web test:e2e:auth-required` | QuickDesk, ratings-admin, role-switching, shift-management |
| `pnpm -C apps/web test:e2e:seed-required` | Booking, map, recovery, finance, hours, promotions, packages, visual |
| `pnpm -C apps/web test:e2e:full-seeded` | Явный список seeded/auth/visual specs плюс webhook; smoke в этот script не входит |
| `pnpm -C apps/web test:e2e` | Все обнаруженные Playwright specs |
| `pnpm -C apps/web test:e2e:ui` | Playwright UI mode |
| `pnpm -C apps/web test:e2e:headed` | Видимый browser mode |
| `pnpm -C apps/web test:e2e:debug` | Debug mode |

Названия групп не гарантируют только read-only действия. Specs могут создавать брони и пакеты, менять статусы и финансы или инициировать auth/integration effects; выбранный сценарий нужно прочитать до запуска.

## Обязательные env по текущим specs

Это contract preflight, не обещание достаточности данных. [testEnv.ts](testEnv.ts) вызывает suite-level `test.skip` при отсутствующей обязательной переменной. Внутри сценариев есть дополнительные условия и runtime skips.

| Spec | Обязательные env в preflight |
| --- | --- |
| [booking-flow](booking-flow.spec.ts) | `E2E_TEST_BUSINESS_SLUG` |
| [branch-map](branch-map.spec.ts) | `E2E_TEST_SUPERADMIN_EMAIL`, `E2E_TEST_BUSINESS_ID` |
| [error-recovery](error-recovery.spec.ts) | `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_BUSINESS_SLUG` |
| [finance-disputes-verification](finance-disputes-verification.spec.ts) | `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_STAFF_EMAIL`, `E2E_TEST_STAFF_ID` |
| [hours-worked-recalculation](hours-worked-recalculation.spec.ts) | `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_STAFF_ID` |
| [promotion-application](promotion-application.spec.ts) | `E2E_TEST_BUSINESS_SLUG`, `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_BRANCH_ID` |
| [quickdesk](quickdesk.spec.ts) | `E2E_TEST_MANAGER_EMAIL` |
| [ratings-admin-flow](ratings-admin-flow.spec.ts) | `E2E_TEST_SUPER_ADMIN_EMAIL` |
| [role-switching](role-switching.spec.ts) | `E2E_TEST_MULTI_ROLE_EMAIL` |
| [shift-management](shift-management.spec.ts) | `E2E_TEST_STAFF_EMAIL`, `E2E_TEST_STAFF_PASSWORD` |
| [staff-finance-pages](staff-finance-pages.spec.ts) | `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_STAFF_ID` |
| [visit-packages-flow](visit-packages-flow.spec.ts) | `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_CLIENT_SEARCH` |
| [visual-regressions](visual-regressions.spec.ts) | Public: `E2E_TEST_BUSINESS_SLUG`; workspace: `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_STAFF_ID`; staff cabinet: `E2E_TEST_STAFF_EMAIL` |

`E2E_TEST_SUPERADMIN_EMAIL` и `E2E_TEST_SUPER_ADMIN_EMAIL` — разные имена в текущем коде. Не объединять их в инструкции, пока код не нормализован отдельной задачей. Некоторые booking/package проверки используют optional `E2E_TEST_CLIENT_EMAIL`; часть specs поддерживает `E2E_TEST_TODAY`. Наличие email не подтверждает завершённый auth flow или нужные права.

## Подготовка разрешённого прогона

1. Назвать цель, конкретные specs, среду приложения/БД, ревизию и допустимые эффекты. Рабочие данные и production для этих примеров не предназначены.
2. Подтвердить реально подготовленную схему и разрешённые роли/fixtures. Чистый bootstrap migrations/seed пока нельзя считать доказанным; см. [PROJECT_STATUS.md](../../../docs/PROJECT_STATUS.md).
3. Передать необходимые env в runner и проверить соответствие бизнесов, филиалов, сотрудников и клиентов. Не извлекать credentials/storageState из существующей ручной кампании.
4. Для изменяющих данные сценариев определить изоляцию и согласованный способ завершения. Автоматические DB reset/очистка, новые роли и реальные отправки не следуют из этой документации.
5. Зафиксировать результат и пропуски. При отсутствии fixture или метода ставить NOT_RUN/BLOCKED, не превращать отсутствие данных в успешную проверку.

## Что делает CI и что остаётся открытым

В [workflow](../../../.github/workflows/ci.yml) существуют отдельные smoke, visual и full-seeded jobs. Для visual на main/schedule есть проверка `E2E_TEST_BUSINESS_SLUG`, `E2E_TEST_MANAGER_EMAIL`, `E2E_TEST_STAFF_ID`; она не охватывает все env/fixtures всех сценариев.

Full-seeded `e2e_tests` имеет **`continue-on-error: true`**. Его env блок не передаёт, среди прочего, `E2E_TEST_MULTI_ROLE_EMAIL`, `E2E_TEST_CLIENT_SEARCH`, оба admin-email варианта и `E2E_TEST_BRANCH_ID`, хотя соответствующие specs входят в script. Пропуск при missing env предусмотрен helper. Поэтому существование job и его успешный общий статус не доказывают выполнение всей группы.

Это статически установленные ограничения конфигурации. Фактическое число runtime skips, успешность auth и результат конкретного CI run требуют сохранённого отчёта. В этой документационной задаче workflow и specs не исправлялись.

## Артефакты и интерпретация

[Config](../playwright.config.ts) включает HTML reporter, screenshot `only-on-failure` и trace `on-first-retry`. **Запись видео не включена.** Не обещать видео в отчёте, если оно не настроено отдельным изменением.

CI загружает `apps/web/playwright-report/` после smoke/visual/full-seeded jobs. Локальные `test-results/` и HTML report нужно сохранять вместе с точной командой, кандидатом и условиями. Секреты, auth state и персональные данные не публиковать.

PASS относится только к выполненным assertions. Отдельно перечислять retries, FAIL, SKIP и NOT_RUN. При изменении поведения проверять независимый ожидаемый результат; условное отсутствие кнопки, пустой список или timeout не являются доказательством бизнес-инварианта. Общие требования к отчёту — в [TESTING_GUIDE.md](../../../TESTING_GUIDE.md#как-выбирать-и-фиксировать-проверку).

