# Локальный справочник API-тестов

Статус: `reference`. Сверено с исходниками: **2026-11-01**. Владелец: **Engineering**. Runtime-проверка при обновлении документа: **NOT_RUN**.

Эта папка содержит Jest-тесты API routes и их зависимостей. Общий процесс, CI и coverage описаны в [TESTING_GUIDE.md](../../../../../TESTING_GUIDE.md), выбор слоя и границы mocked tests — в [API_TESTING.md](../../../../../API_TESTING.md). Контракты endpoints находятся в [API reference](../../../../../API_DOCUMENTATION.md).

## Расположение и примеры

Тесты обычно именуются `*.test.ts` и сгруппированы по API-теме; точные правила обнаружения задаёт [jest.config.js](../../../jest.config.js). Имена папок не всегда повторяют URL буквально. Общие утилиты находятся рядом: [testHelpers.ts](testHelpers.ts).

| Тема | Существующий тестовый код |
| --- | --- |
| Авторизованное и гостевое бронирование | [quick-hold.test.ts](quick-hold.test.ts), [quick-book-guest.test.ts](quick-book-guest.test.ts) |
| Отмена и отметка посещения | [bookings/cancel.test.ts](bookings/cancel.test.ts), [bookings/mark-attendance.test.ts](bookings/mark-attendance.test.ts) |
| Закрытие смены и финансы | [staff/shift/close.test.ts](staff/shift/close.test.ts), [dashboard/finance/all.test.ts](dashboard/finance/all.test.ts) |
| CRUD и промо | [services/create.test.ts](services/create.test.ts), [branches/schedule.test.ts](branches/schedule.test.ts), [promotions/promotions.test.ts](promotions/promotions.test.ts) |
| Auth и ограничения запросов | [auth/mobile-exchange.test.ts](auth/mobile-exchange.test.ts), [authRateLimitIsolation.test.ts](authRateLimitIsolation.test.ts) |
| Уведомления и webhook | [notify.test.ts](notify.test.ts), [webhooks/whatsapp.test.ts](webhooks/whatsapp.test.ts) |
| Admin и health | [admin/user-update-basic-params.test.ts](admin/user-update-basic-params.test.ts), [admin/health-check.test.ts](admin/health-check.test.ts) |

Это навигация по исходникам, не матрица PASS и не доказательство полного покрытия сценариев. [Реестр бизнес-сценариев](../../../../../SCENARIO_TEST_REGISTRY.md) помогает выбрать предмет проверки; его ожидаемые ветки нужно сверять с текущим контрактом и конкретными assertions. E2E находятся отдельно; их команды, fixtures и ограничения описаны в [E2E reference](../../../e2e/README.md).

## Что делают общие утилиты

| Экспорт из `testHelpers.ts` | Поведение и ограничение |
| --- | --- |
| `createMockRequest(url, options)` | Создаёт обычный `Request`, по умолчанию GET с JSON content type; truthy `body` сериализует, строку передаёт как есть. Для тел `false`, `0`, `null`, пустой строки и проверки raw body используйте явно созданный `Request`. |
| `createMockNextRequest(url, options)` | Создаёт `NextRequest`; truthy body сериализуется через `JSON.stringify`, headers передаются из options. |
| `createMockSupabase()` | Возвращает набор `jest.fn` с цепочкой query-методов на одном объекте. Ответы terminal-методов и RPC нужно задавать в тесте; это не реализация SQL, RLS или транзакций. |
| `setupApiTestMocks()` | Регистрирует моки limiter, `next/headers`, Supabase SDK и устанавливает тестовые значения трёх Supabase env-переменных. Limiter просто вызывает handler; реальные квоты этим helper не проверяются. |
| `createTelegramMobileSignedHeaders(params)` | Использует production helper подписи bot-запроса для переданных secret/body/time/requestId; правильная подпись сама по себе не проверяет отказ при неверной подписи или replay. |
| `expectErrorResponse(response, status, error?)` | Проверяет статус и `ok: false`; при переданном error нормализует старые коды через внутреннюю таблицу. Возвращает разобранный JSON. |
| `expectSuccessResponse(response, status = 200)` | Проверяет статус и `ok: true`; если `data` — объект, дополнительно разворачивает его поля наверх возвращаемого значения. Для точной проверки wire envelope читайте `response.json()` непосредственно. |

Пример использования только request helper; он не вызывает endpoint:

```typescript
import { createMockRequest } from './testHelpers';

const request = createMockRequest('http://localhost/api/services/create', {
    method: 'POST',
    body: { name_ru: 'Стрижка', duration_min: 30, price_from: 500 },
});
```

Не копируйте общий набор моков автоматически. Например, [mark-attendance](bookings/mark-attendance.test.ts) подменяет business context, service client и route params; [authRateLimitIsolation](authRateLimitIsolation.test.ts) сохраняет реальный limiter и подменяет его внешние зависимости. Выбирайте границу по проверяемому поведению. При обходе auth, параметров или limiter отдельным mock тест не доказывает работу этой границы. Порядок регистрации моков и загрузки route также существенен; в [quick-hold](quick-hold.test.ts) route загружается после настройки через `require`.

## Как добавлять содержательную проверку

1. Сопоставьте route, HTTP service, schema и вызываемый service; сформулируйте ожидаемый результат независимо от mock. Коды ошибок и форма ответа различаются между endpoints — нельзя назначать всем единый `401/403/400/200` шаблон.
2. Для защищённой операции проверьте отсутствие сессии, недостаточную роль и чужой tenant; отдельно убедитесь, что запрещённый запрос не вызывает запись или уведомление. Не считайте admin, auth и debug endpoints низкоприоритетными только из-за названия.
3. Проверьте обязательные поля, неверные типы, граничные значения и успешный ответ. Если форма JSON важна клиенту, проверяйте исходный envelope, а не только значение, развёрнутое helper.
4. Для DB/RPC зависимостей различайте отсутствие данных и ошибку чтения; для mutations — конфликт, частичный отказ и повтор запроса. Проверяйте аргументы и количество side effects, если контракт обещает однократность.
5. Изолируйте mocks между cases. `jest.clearAllMocks()` очищает историю вызовов, но не сбрасывает реализации и очереди `mockResolvedValueOnce`; настройку и сброс выбирайте с учётом этого.
6. Свяжите тест с бизнес-сценарием и укажите оставшуюся границу: mocked RPC не проверяет реальную constraint, конкурентность или доставку сообщения. Такие проверки требуют отдельного SQL/integration/E2E scope.

## Запуск и интерпретация результата

Следующие команды выполняются из корня репозитория **только в отдельно разрешённой задаче и изолированной среде**. Документационная правка не запускает приложение или тесты и не возобновляет [закрытую WEB-кампанию](../../../../../docs/WEB_AGENT_HANDOFF.md).

```bash
# Только эта папка
pnpm -C apps/web test --runInBand src/__tests__/api

# Один конкретный файл
pnpm -C apps/web test --runInBand --runTestsByPath src/__tests__/api/quick-hold.test.ts
```

Источник команд — [web package.json](../../../package.json). Корневой `pnpm test:api` запускает полный web Jest, а `pnpm test` сначала запускает SQL. Для coverage и CI используйте [канонический справочник](../../../../../TESTING_GUIDE.md#что-означает-coverage-60): текущий порог **60%** действует только на allowlist `collectCoverageFrom`; отдельного подтверждённого порога «80% всех критичных endpoints» нет.

Сохраняйте точную команду, scope, ревизию, среду, exit code, failures и skipped. Наличие файлов и статическое чтение не заменяют отчёт запуска. Процесс изменений — в [CONTRIBUTING.md](../../../../../CONTRIBUTING.md); локальный гайд не создаёт отдельный источник приёмки.
