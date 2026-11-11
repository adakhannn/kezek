# Проверки API и сервисов

Статус: `reference`. Сверено с исходниками: **2026-11-10**. Владелец: **Engineering**.

Основной процесс и CI scope описаны в [TESTING_GUIDE.md](TESTING_GUIDE.md); общий вход — [docs/README.md](docs/README.md). Этот документ уточняет работу с Jest-тестами API, не хранит отдельный список принятых требований.

Команды предназначены для отдельной разрешённой задачи в изолированной среде. Документационное обновление не запускает тесты и не возобновляет [закрытую WEB-кампанию](docs/WEB_AGENT_HANDOFF.md).

## Где искать тесты

- [apps/web/src/__tests__/api](apps/web/src/__tests__/api) — route-level проверки request/response, валидации и делегирования.
- [apps/web/src/__tests__/lib](apps/web/src/__tests__/lib) — сервисы, HTTP adapters, repositories и helpers.
- [packages/core-domain](packages/core-domain) — отдельный shared domain package со своим test script.

Примеры существующих файлов: [закрытие смены](apps/web/src/__tests__/api/staff/shift/close.test.ts), [отметка посещения](apps/web/src/__tests__/api/bookings/mark-attendance.test.ts), [cron закрытия смен](apps/web/src/__tests__/api/cron/close-shifts.test.ts), [finance API](apps/web/src/__tests__/api/dashboard/finance/all.test.ts). Наличие файла подтверждает только наличие тестового кода; актуальный PASS требует отчёта запуска на выбранном кандидате.

## Команды из корня репозитория

```bash
# Только API test directory
pnpm -C apps/web test --runInBand src/__tests__/api

# Дополнительная локальная выборка lib + API
pnpm -C apps/web test:ci:extended

# Полный web Jest
pnpm -C apps/web test

# Web Jest с coverage по allowlist в jest.config.js
pnpm -C apps/web test:coverage
```

Источники: [web package.json](apps/web/package.json), [Jest config](apps/web/jest.config.js). Корневой `pnpm test:api` запускает полный web Jest, несмотря на название. Корневой `pnpm test` сначала запускает SQL и не подходит как синоним изолированного API unit run.

Порог 60% относится к `collectCoverageFrom`, а не ко всем endpoints. `test:ci:extended` coverage не собирает. Точная интерпретация — в [основном справочнике](TESTING_GUIDE.md#что-означает-coverage-60).

## Границы mocked tests

API-тесты обычно заменяют auth/context, Supabase, уведомления и другие внешние зависимости моками. Состав моков зависит от конкретного файла. Проверка ответа `403` с замокированным auth не доказывает, что реальная RLS запрещает доступ; успешный mocked RPC не подтверждает существование функции или её конкурентную корректность в БД.

При добавлении проверки:

1. Зафиксировать контракт и независимое ожидаемое поведение: статус, payload, side effect и его однократность.
2. Выбрать правильный слой: parsing/auth wiring — route/HTTP service; бизнес-правило — service/domain; constraint/RLS/concurrency — отдельная SQL/integration задача.
3. Мокировать внешнюю границу, сохраняя существенные ошибки и отказы. Не подменять тестируемую реализацию вычислением ожидаемого ответа внутри mock.
4. Проверить, что запрещённый запрос не вызывает mutation/notification, а повторный запрос не создаёт повторный эффект там, где обещана идемпотентность.
5. Зафиксировать что именно запускалось. Не заменять failure основного набора успехом одной адресной выборки.

Полезные рисковые случаи: неверный tenant/роль, отсутствие данных против ошибки чтения, гонка обновлений, повтор команды, частичный отказ зависимости и истёкшая сессия. Live API/RPC проверки и новые fixtures требуют отдельно разрешённого метода и изолированной среды; этот перечень их не запускает.

## CI и результаты

[Workflow](.github/workflows/ci.yml) вызывает `test:ci:core` с coverage и полный web Jest в `web_full_tests`, включая components. `test:ci:extended` остаётся доступной локальной выборкой. Это описание конфигурации, не свежая проверка CI. Общие открытые ограничения SQL, E2E и полноты gate перечислены один раз в [TESTING_GUIDE.md](TESTING_GUIDE.md#открытые-ограничения-проверок).

В отчёте указывать scope, exit code, failures и пропуски. Для принятия реальных ролей, RPC и пользовательских переходов использовать соответствующий метод; mocked PASS не переносится автоматически в [WEB ledger](docs/WEB_VERIFICATION_LEDGER.json).

