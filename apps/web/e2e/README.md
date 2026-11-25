# Playwright reference

Статус: `reference`. Сверено с исходниками: **2026-11-25**. Владелец: **Engineering**.

Основной процесс: [TESTING_GUIDE.md](../../../TESTING_GUIDE.md). [Индекс](../../../docs/README.md), [инженерное состояние](../../../docs/PROJECT_STATUS.md), [закрытая WEB-кампания](../../../docs/WEB_AGENT_HANDOFF.md).

Seeded, auth и visual specs работают только против **локального** Supabase (`supabase start`) с fixture [scripts/e2e-seed.mjs](../../../scripts/e2e-seed.mjs). [playwright.config.ts](../playwright.config.ts) отказывается запускаться, если base URL или `NEXT_PUBLIC_SUPABASE_URL` не локальные (localhost, 127.0.0.1, host.docker.internal; для smoke допускается placeholder). Production и рабочие данные эти тесты не трогают. Ограничения ручной WEB-кампании этим справочником не отменяются.

## Как это устроено

- **Стек.** `pnpm db:start:check` из корня поднимает локальный Supabase из `supabase/` (prod baseline + migrations + `seed.sql`), как job `db_bootstrap`.
- **Fixture.** `node scripts/e2e-seed.mjs [--workdir <dir>]` читает `supabase status`, через admin API локального GoTrue создаёт (или сбрасывает пароль) пять аккаунтов, а SQL-ом (`docker exec supabase_db_<project_id> psql`) — бизнес `e2e-salon`, филиал, три услуги, двух мастеров (часы 08:00–22:00 каждый день, legacy-модель, как в проде без `SCHEDULE_V2_ENABLED`), роли (владелец, менеджер, супер-админ), акции, брони (вчерашние для отметки посещения, hold, будущая бронь клиента) и закрытую вчерашнюю смену. Строки имеют фиксированные id; повторный запуск идемпотентен и возвращает брони фикстуры в исходные даты и статусы. В stdout печатаются строки `KEY=VALUE` (Supabase URL и ключи локального стека, `E2E_TEST_*`).
- **Пароли.** Пароль аккаунтов — локальное тестовое значение `LOCAL_E2E_PASSWORD` в скрипте; он существует только в одноразовом GoTrue локального стека.
- **Вход.** Страница `/auth/sign-in` предлагает только соцсети, поэтому [authHelpers.ts](authHelpers.ts) входит программно: `@supabase/ssr` `createServerClient` с cookie-jar в памяти выполняет `signInWithPassword` и кладёт полученные cookies (`sb-<ref>-auth-token`, тот же формат, что читает приложение) в контекст Playwright. Имена helpers (`signInWithEmailSeed`, `createStorageStateForEmailSeed`, `signInWithPassword`) сохранены.
- **Приложение.** `webServer` запускает `next dev --port 3100` (по умолчанию порт `E2E_PORT=3100`, чтобы не попасть в чужой dev-сервер на 3000). `E2E_WEB_SERVER=start` использует `next start` после `pnpm build`, но production-сборка без Upstash и доверенного IP-заголовка отклоняет запросы rate limiter-ом (503), поэтому CI использует dev-сервер. Браузер работает в `ru-RU` и `Asia/Bishkek`; процесс runner получает `TZ=Asia/Bishkek`, поэтому «сегодня/завтра» в specs — дни бизнеса.
- **CSP.** [next.config.ts](../next.config.ts) добавляет в `connect-src` origin `NEXT_PUBLIC_SUPABASE_URL`, только если это loopback-адрес (локальный стек по http). Для hosted-проекта политика не меняется.
- **Гидратация.** [fixtures.ts](fixtures.ts) расширяет `test`: `page.goto`/`page.reload` ждут гидратации React, иначе под `next dev` первый клик теряется. Seeded specs импортируют `test`/`expect` оттуда.
- **Общие шаги** текущего UI (поток записи, вкладки броней, смена, клиент смены, статистика дня) — в [flows.ts](flows.ts).

## Локальный запуск

Из корня репозитория, Docker запущен:

```bash
pnpm db:start:check                                  # локальный Supabase (порты из supabase/config.toml)
node scripts/e2e-seed.mjs > apps/web/e2e/.e2e.env    # fixture; файл в .gitignore
pnpm -C apps/web exec playwright install chromium
pnpm -C apps/web test:e2e:full-seeded                # функциональные specs
pnpm -C apps/web test:e2e:smoke                      # публичные страницы
pnpm exec supabase stop --no-backup                  # по завершении
```

`playwright.config.ts` сам читает `e2e/.e2e.env` (или файл из `E2E_ENV_FILE`); переменные окружения имеют приоритет. Если на машине уже работает другой стек с теми же портами, скопируйте `supabase/` во временный каталог, поменяйте `project_id` и порты в `config.toml`, запустите `supabase start --workdir <dir>` и `node scripts/e2e-seed.mjs --workdir <dir>`.

Specs меняют данные (брони, смены, пакеты); на одном стеке их можно запускать повторно — seed возвращает брони фикстуры, а specs сами открывают/переоткрывают смену. Перед visual-прогоном нужен свежий стек (`supabase db reset` + seed), см. ниже.

## Scripts

| Команда | Выборка |
| --- | --- |
| `pnpm -C apps/web test:e2e:smoke` | `smoke-public.spec.ts`: business apply, sign-in, terms, privacy (без БД) |
| `pnpm -C apps/web test:e2e:http` | `whatsapp-webhook.spec.ts`: request-level сценарий |
| `pnpm -C apps/web test:e2e:visual` | `visual-regressions.spec.ts` |
| `pnpm -C apps/web test:e2e:auth-required` | QuickDesk, ratings-admin, role-switching, shift-management |
| `pnpm -C apps/web test:e2e:seed-required` | Booking, branch, recovery, finance, hours, promotions, packages, visual |
| `pnpm -C apps/web test:e2e:full-seeded` | Все функциональные seeded/auth specs и webhook, `--workers=1` (specs делят смену одного мастера); visual и smoke не входят |
| `pnpm -C apps/web test:e2e` | Все обнаруженные specs |

## Env (печатает e2e-seed)

`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (локальный стек), `E2E_TEST_PASSWORD`, `E2E_TEST_BUSINESS_SLUG`, `E2E_TEST_BUSINESS_ID`, `E2E_TEST_BRANCH_ID`, `E2E_TEST_STAFF_ID`, `E2E_TEST_MANAGER_EMAIL` (владелец), `E2E_TEST_STAFF_EMAIL`, `E2E_TEST_STAFF_PASSWORD`, `E2E_TEST_CLIENT_EMAIL`, `E2E_TEST_CLIENT_SEARCH` (полный e-mail клиента: поиск QuickDesk находит аккаунт по точному контакту), `E2E_TEST_SUPER_ADMIN_EMAIL` и `E2E_TEST_SUPERADMIN_EMAIL` (одно значение, specs используют оба имени), `E2E_TEST_MULTI_ROLE_EMAIL` (менеджер + мастер «E2E Мульти» + клиент), `WHATSAPP_APP_SECRET` и `WHATSAPP_PHONE_NUMBER_ID` (локальные тестовые значения: приложение проверяет ими подпись и получателя webhook, `whatsapp-webhook.spec.ts` подписывает запрос; отправок нет). Необязательные: `E2E_TEST_TODAY`, `E2E_PORT`, `E2E_WEB_SERVER`, `E2E_SKIP_WEB_SERVER`, `E2E_SUPABASE_AUTH_URL` (адрес GoTrue для runner в контейнере; имя cookie по-прежнему берётся из `NEXT_PUBLIC_SUPABASE_URL`). [testEnv.ts](testEnv.ts) пропускает suite, если env нет.

## Не проверяется локально (`test.fixme`)

- `branch-map`: клик по карте — нужен JS API и ключ Яндекс.Карт; запросы к Яндексу в spec блокируются.
- `promotion-application`: лимит использований, выбор одной из нескольких акций, минимальная сумма — таких правил у акций в продукте нет.
- `quickdesk`: изменение брони — в кабинете бизнеса есть только подтверждение, отмена и отметка посещения.

Вход через Google, Яндекс, Telegram и WhatsApp e2e не покрывает (вход программный); реальные отправки WhatsApp/Telegram не выполняются.

## Visual regressions

Эталоны лежат в `visual-regressions.spec.ts-snapshots/*-chromium-linux.png` и сняты в официальном образе `mcr.microsoft.com/playwright:v<версия @playwright/test>-noble` (CI: ubuntu-24.04). Маскируются даты, дни недели, месяцы и поля дат ([spec](visual-regressions.spec.ts)); [visual-regressions.css](visual-regressions.css) скрывает dev-индикатор Next.js. На Windows/macOS имена снимков другие (`-win32`, `-darwin`), поэтому сравнение запускают в контейнере.

Пересъёмка эталонов (стек и `next dev` на хосте, runner в контейнере; так сняты текущие эталоны 25.11.2026). Windows-`node_modules` (pnpm-ссылки) в Linux-контейнер не монтируются, поэтому два чистых JS-пакета ставятся в каталог вне репозитория, а браузер в контейнере ходит на `localhost:3100` и `127.0.0.1:<API-порт>` через TCP-переадресацию на `host.docker.internal` — по тем же адресам, с которыми собрано приложение:

```bash
pnpm exec supabase db reset && node scripts/e2e-seed.mjs > apps/web/e2e/.e2e.env   # свежие данные
(cd apps/web && set -a && . e2e/.e2e.env && set +a && pnpm dev --port 3100)         # отдельный терминал
mkdir -p /tmp/vis && (cd /tmp/vis && npm init -y >/dev/null &&   npm i @playwright/test@1.58.0 @supabase/ssr@0.12.7 @supabase/supabase-js@2.119.0)
docker run --rm --add-host=host.docker.internal:host-gateway   -v "$PWD/apps/web/e2e:/work/apps/web/e2e" -v "$PWD/apps/web/playwright.config.ts:/cfg/playwright.config.ts:ro"   -v /tmp/vis/node_modules:/work/apps/web/node_modules:ro   mcr.microsoft.com/playwright:v1.58.0-noble bash -c '
    for port in 3100 54321; do node -e "
      const net=require(\"net\"),p=+process.argv[1];
      net.createServer(c=>{const u=net.connect(p,\"host.docker.internal\");c.pipe(u).pipe(c);
        c.on(\"error\",()=>u.destroy());u.on(\"error\",()=>c.destroy())}).listen(p,\"127.0.0.1\")" $port & done
    cd /work/apps/web && cp /cfg/playwright.config.ts . &&
    E2E_SKIP_WEB_SERVER=1 node node_modules/@playwright/test/cli.js test e2e/visual-regressions.spec.ts       --workers=1 --update-snapshots'
```

Порт API (54321) — из `supabase/config.toml` выбранного стека. После пересъёмки тот же запуск без `--update-snapshots` должен пройти. Порог сравнения — `maxDiffPixelRatio: 0.01` в config.

## CI

[Workflow](../../../.github/workflows/ci.yml): `e2e_tests` и `e2e_visual_regressions` запускают `pnpm db:start:check`, затем `node scripts/e2e-seed.mjs >> "$GITHUB_ENV"`, проверяют, что env fixture не пуст, выполняют Playwright и в `if: always()` останавливают стек (`supabase stop --no-backup`). Secrets GitHub не используются. `e2e_smoke_tests` работает без БД с placeholder-значениями Supabase. Отчёты: `playwright-report/` и `test-results/` (diff-снимки visual).

## Артефакты и интерпретация

Config включает reporters `list` и HTML (`open: never`), screenshot `only-on-failure`, trace `on-first-retry`; видео не записывается. В CI — один worker и до двух retries. PASS относится только к выполненным assertions; отдельно перечислять retries, FAIL, SKIP и fixme. Общие требования к отчёту — в [TESTING_GUIDE.md](../../../TESTING_GUIDE.md#как-выбирать-и-фиксировать-проверку).
