# Swagger и OpenAPI в Kezek

Статус: reference, обновлено 2026-11-10. Владелец: engineering. Локально проверены offline generation, typed consumer и HTTP/UI unit tests с synthetic boundaries. Браузер, deployment и live providers этими проверками не охвачены.

Основные ручные контракты — [API_DOCUMENTATION](API_DOCUMENTATION.md); полный список exports — [HTTP-каталог](docs/api/ROUTE_CATALOG.md).

## Два уровня описания

[Генератор](scripts/generate-openapi.mjs) использует существующий TypeScript AST [каталога](scripts/generate-api-catalog.mjs): route.ts/tsx/js, локальные re-export, маршруты вне /api и динамические сегменты. Он не исполняет приложение. Автоматические HEAD/OPTIONS Next, middleware, rewrites, прямые Supabase/RPC вызовы и доступность deployment не входят в inventory. Новый catch-all требует явного согласования модели пути; генерация остановится.

- [openapi.json](apps/web/src/generated/openapi.json) содержит все явные METHOD/path. Для каждой операции есть x-source-file, x-next-route и x-manual-contract. Только x-contract-status=reviewed содержит проверенную типизацию. Для inventory-only нет выдуманных auth/body/response schemas; отсутствие security здесь не означает публичный доступ.
- [openapi-sdk.json](apps/web/src/generated/openapi-sdk.json) содержит только четыре reviewed операции: POST /api/quick-hold, POST /api/quick-book-guest, POST /api/staff/shift/items и POST /api/staff/shift/close. Только этот subset используется для SDK.

[Источник reviewed schemas](scripts/openapi-contracts.mjs) сверяется с Zod, HTTP/services и SQL. JSON schema отражает wire shape и основные ограничения; календарные, tenant, schedule и прочие бизнес-правила остаются серверными. Генератор клиента не превращает все anyOf/oneOf/range ограничения в TypeScript. Типы не заменяют runtime validation.

Описанный bearerAuth — поддерживаемый транспорт SDK. Browser handlers также используют существующую проверенную Supabase cookie session; имена и chunking cookies не выдумываются как фиксированная cookie-схема. Manager Save с staffId использует cookie-session context; bearer staff path не даёт менеджерских прав.

## Runtime потребители

[GET /api/swagger.json](apps/web/src/app/api/swagger.json/route.ts) возвращает OpenAPI 3.0.3 object в корне JSON, без ok/data. [swagger.ts](apps/web/src/lib/swagger.ts) импортирует сохранённый artifact; filesystem, cwd, env и swagger-jsdoc при запросе не используются. Это публичное описание; у самого handler нет auth/limiter.

[UI /api-docs](apps/web/src/app/api-docs/page.tsx) проверяет HTTP status, отклоняет envelopes, неверную форму и пустые paths, отменяет запрос при unmount. Это проверка границы потребителя, а не полноценный валидатор OpenAPI. Swagger отображается без Try it out: страница не служит интерфейсом выполнения финансовых/административных команд.

servers=/ означает same origin, а info.version — версию документа. Это не объявление совместимости всех HTTP handlers или адрес production.

## Обновление и проверка

Из корня, без сервера, .env, БД и сети после установки зависимостей:

~~~bash
pnpm generate:openapi
pnpm check:openapi
pnpm generate:sdk
node --test scripts/openapi-tools.test.mjs
~~~

Генерация записывает артефакты. При изменении контрактов сначала сверить смысл route → validation → service → SQL и обновить тематический справочник/marker. Затем изменить reviewed schemas и перегенерировать JSON/SDK. Не редактировать generated файлы вручную.

check:openapi проверяет полный inventory, manual markers и совпадение артефактов. Fingerprint включает перечисленные x-reviewed-sources и четыре route-файла, нормализует CRLF и не содержит timestamp/env. Изменение источника требует повторной смысловой проверки; обновление hash само по себе её не доказывает. Это явная граница файлов, а не полный транзитивный граф.

[Tooling tests](scripts/openapi-tools.test.mjs) проверяют AST parity, dynamic paths, воспроизводимость вне cwd, stale artifacts, SDK во временном каталоге, его совпадение с сохранённым клиентом и реальную TS-компиляцию потребителя. CI выполняет их вместе с check:openapi. [HTTP consumer tests](apps/web/src/__tests__/lib/openApiSdkContract.test.ts) проводят generated requests через настоящие HTTP/Zod validators, подменяя auth/DB, и проверяют identity, guest proof, canonical Save, Close envelope и отсутствие автоматического повтора на 409. Это не live E2E.

SDK и его эксплуатационные ограничения описаны в [README клиента](packages/shared-client/src/generated-sdk/README.md). Общие ошибки — [API_ERROR_FORMATS](apps/web/src/lib/API_ERROR_FORMATS.md).
