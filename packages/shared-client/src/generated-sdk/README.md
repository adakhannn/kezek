# Проверенный subset SDK

Статус: reference, обновлено 2026-11-10. Владелец: engineering.

[Сгенерированный fetch-клиент](client/index.ts) доступен через @shared-client/generated-sdk. Он содержит только BookingsService.quickHold/quickBookGuest и ShiftsService.saveShiftItems/closeShift. Остальные HTTP handlers перечислены в полном inventory, но не включены в SDK. Этот клиент не заменяет автоматически существующий createApiClient или consumers приложения.

Из корня после смысловой сверки контракта:

~~~bash
pnpm generate:openapi
pnpm check:openapi
pnpm generate:sdk
node --test scripts/openapi-tools.test.mjs
~~~

[Генератор SDK](../../../../scripts/generate-sdk.mjs) использует локальный reviewed OpenAPI object с внутренними refs. Сервер, .env, БД и сеть не нужны. Он отказывается работать при stale OpenAPI artifacts. Только подкаталог client перегенерируется; README и стабильный index.ts остаются вне него. Версия установленного openapi-typescript-codegen фиксируется lockfile; отдельная миграция генератора в эту работу не входит.

## Использование и ограничения

Импортируйте OpenAPI, BookingsService, ShiftsService из @shared-client/generated-sdk. Перед вызовом выберите разрешённый base URL через OpenAPI.BASE; для browser same-origin используется пустая строка. Для bearer transport задайте OpenAPI.TOKEN; для cookie-сессии — OpenAPI.WITH_CREDENTIALS и CREDENTIALS с учётом origin/CORS. Состояние OpenAPI глобальное: не храните в нём пользовательские токены на многопользовательском сервере. Экземпляры и lifecycle авторизации приложение организует отдельно.

Booking requires Idempotency-Key UUID v4; guest дополнительно требует X-Booking-Client-Token из 32 случайных байтов в lowercase hex. Создавайте и сохраняйте их до отправки; при неизвестном результате повторяйте тот же payload с той же парой. SDK не генерирует identity, не сохраняет попытки, не делает retry или refresh token.

Save/Close требуют исходные expectedShiftId/expectedRevision. Сохраняйте канонические IDs и revision из Save; сериализуйте команды. На 409 сохраните draft и явно сверяйте его со свежими данными. Подмена revision свежей без review может потерять чужие изменения. Поля note из ответа не входят в strict входную схему позиции.

HTTP success возвращается с ok/data, без unwrap. Неуспешный status выбрасывает отдельный generated ApiError с status/body; это другой класс, чем ApiError корневого shared-client. Типизация не валидирует JSON runtime и не кодирует все cross-field/business ограничения. SDK предоставляет транспорт, а не готовый offline finance workflow.

Полные границы и проверки: [Swagger guide](../../../../SWAGGER_SETUP.md), [API guide](../../../../API_DOCUMENTATION.md). Локальные тесты подтверждают выбранный synthetic contract; совместимость live deployment и браузерный Swagger здесь не проверены.
