# Генератор API-заготовки

Статус: справочник, сверено с [generate-api-route.mjs](scripts/generate-api-route.mjs) 1 ноября 2026. Сам генератор не запускался.

Из корня для отдельно выбранного нового пути:

```bash
pnpm generate:api-route example/action
```

Команда создаёт при отсутствии route в apps/web/src/app/api/example/action/route.ts и test в apps/web/src/__tests__/api/example/action/route.test.ts. Существующие файлы пропускаются; это не проверка корректности их содержимого.

## Что требует доработки

- Заготовка создаёт GET с withErrorHandler и общим normal limiter. Auth, schema и бизнес-операция ещё отсутствуют.
- Limiter не получает отдельный prefix; выбрать политику по [RATE_LIMITING](RATE_LIMITING.md).
- Успех содержит вложенное data.ok, поскольку вызывается createSuccessResponse({ ok: true }); это демонстрационная заготовка.
- Test импортирует ../testHelpers. Для вложенного пути этот относительный импорт необходимо проверить и исправить.
- Параметр пути очищается только от крайних слешей. Передавать только проверенный путь внутри app/api, без ..; нельзя использовать произвольный внешний ввод.
- Swagger содержит TODO и ссылку на схему; это не полный контракт.

Логику реализовывать по [HOWTO](apps/web/src/lib/HOWTO_NEW_API_ENDPOINT.md): route делегирует HTTP/service слоям, правила домена размещаются по [MODULE_BOUNDARIES](docs/MODULE_BOUNDARIES.md). Тест должен проверять поведение и отказы, а не только успех пустого handler.

Автоматического генератора страниц и use cases этот скрипт не предоставляет. Проверки изменения — [CONTRIBUTING](CONTRIBUTING.md).
