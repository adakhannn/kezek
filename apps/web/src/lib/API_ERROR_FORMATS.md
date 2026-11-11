# Форматы ответов API

Актуализировано: 2026-10-30. Владелец: backend. По исходникам сверены контракт [apiErrorHandler.ts](apiErrorHandler.ts) и отдельные места вызова. **Существующий API неоднороден:** наличие helpers не означает одинаковую форму всех endpoint-ответов.

Основной справочник — [API_DOCUMENTATION](../../../../API_DOCUMENTATION.md); правила новой реализации — [HOWTO](HOWTO_NEW_API_ENDPOINT.md) и [CONTRIBUTING](../../../../CONTRIBUTING.md). Ограничения авторизации, атомарности и достоверности успеха — [ENGINEERING_FINDINGS](../../../../docs/ENGINEERING_FINDINGS.md).

## Success helper

`createSuccessResponse(data?, additionalFields?)` возвращает HTTP 200. Переданный `data` помещается в поле `data`; при `undefined` поле отсутствует. Второй аргумент добавляет поля в корень. Helper не принимает HTTP status: иной код требует явного response construction в вызывающем коде.

```json
{ "ok": true, "data": { "id": "example-id" } }
```

Без payload:

```json
{ "ok": true }
```

Поля additionalFields должны быть частью задокументированного контракта и не переопределять `ok`/`data`. Тип `ApiSuccessResponse<T>` допускает необязательный data и дополнительные поля; он не доказывает фактическое содержимое ответа выбранного endpoint.

## Error helper

`createErrorResponse(error, message?, details?, status = 500)` формирует:

```json
{
  "ok": false,
  "error": "validation",
  "message": "Validation failed",
  "details": {
    "errors": [{ "path": "email", "message": "Invalid email" }]
  }
}
```

`message` включается, если truthy; `details` — если не undefined. **Details передаются и в production.** Helper не очищает и не маскирует их; вызывающий код отвечает за безопасные данные. `ApiErrorType` допускает произвольную строку, поэтому список кодов не является закрытым enum.

Следующая таблица — соглашение для новых ответов. Код ошибки сам по себе **не выбирает HTTP status**: без четвёртого аргумента даже `createErrorResponse('auth')` вернёт 500.

| Код | Обычно HTTP | Смысл |
| --- | ---: | --- |
| auth | 401 | Не установлена допустимая identity |
| forbidden | 403 | Операция не разрешена |
| validation | 400 | Неверный формат или недопустимые входные данные |
| not_found | 404 | Ресурс не найден; отдельные helpers так скрывают чужие IDs |
| conflict | 409 | Конфликт с текущим состоянием |
| rate_limit | 429 | Ограничение частоты в коде, использующем этот helper |
| internal | 500 | Непредвиденная серверная ошибка |
| service_unavailable | 503 | Временная недоступность зависимости/операции |

Пример явного статуса:

```ts
return createErrorResponse('forbidden', 'Доступ запрещен', undefined, 403);
```

## Validation и exception wrapper

[validateRequest / validateQuery](validation/apiValidation.ts) возвращают HTTP 400 с `error: validation`. Zod-ошибки содержат `details.errors[]` с dotted `path` и `message`. Некорректный JSON возвращает `Invalid JSON in request body` без details. Неизвестная validation-ошибка сейчас может передать строку исключения в details; отсутствие внутренних сведений автоматически не гарантируется.

`withErrorHandler(scope, handler)` ловит exception и вызывает `handleApiError`. Он не проверяет корректность возвращённого handler ответа. Текущее поведение:

- выброшенный `NextResponse` возвращается как есть;
- `Error.message` проверяется по текстовым признакам auth/forbidden/validation/not found/conflict;
- объект с `error` использует своё числовое `status`, иначе 500;
- общий fallback — internal/500. Только в этой fallback-ветке raw details ограничены development; message всё ещё может происходить из exception.

Для ожидаемых доменных отказов выбирайте код/status явно, не полагайтесь на текстовую эвристику. При миграции меняйте сервер и потребителей согласованно: помещение прежнего payload под `data` — изменение контракта.

## Подтверждённые различия текущего API

| Цепочка | Форма/особенность |
| --- | --- |
| [withRateLimit](rateLimit.ts) | 429 с `error: rate_limit_exceeded` и `retryAfter` в корне, плюс Retry-After и X-RateLimit-* headers |
| [quick hold HTTP](quickHoldHttpService.ts) | Успех в `data.booking_id`/`data.confirmed`; slot conflict — `booking_slot_unavailable` с HTTP 409 |
| [booking cancel HTTP](bookingCancelHttpService.ts) | Успех `{ ok: true }` без data |
| [service create HTTP](serviceCreateHttpService.ts) | Успех через `createSuccessResponse(result.data)`; schema конкретного payload принадлежит service |
| [admin metrics handler](../app/admin/api/metrics/route.ts) | Прямой NextResponse, собственные поля pagination и error; общий helper не используется |

Ответ limiter, в отличие от примера с `rate_limit` выше:

```json
{
  "ok": false,
  "error": "rate_limit_exceeded",
  "message": "Превышен лимит запросов. Попробуйте через 60 секунд.",
  "retryAfter": 60
}
```

Проверяйте HTTP status и тело вместе; ошибка proxy/сети может вообще не иметь JSON envelope. Клиентский parser должен учитывать контракт выбранного маршрута и безопасно обрабатывать не-JSON/неизвестный код. Автоматический повтор записи после timeout допустим только при предусмотренной идемпотентности.

## Специальные контракты

**Promotion validation.** [Create service](branchPromotionsService.ts) и [update service](branchPromotionService.ts) передают для известных ошибок `details.field: params.visit_count | params.discount_percent`; HTTP services сохраняют эти детали в validation/400. [Web mapper](promotionSaveErrorMessage.ts) локализует стабильный field ID. Не определяйте тип ошибки по тексту message; неизвестное поле требует общего локализованного сообщения.

**Shift item draft identity.** `POST /api/staff/shift/items` поддерживает optional UUID `items[].clientId` для новой позиции. [Сервис сохранения](staffShiftItemsService.ts) использует его как row ID, проверяет принадлежность существующих строк/коллизий смене и для draft insert применяет upsert с ignoreDuplicates. Чужая row identity возвращает forbidden/403, ошибка её lookup — internal/500. [HTTP adapter](staffShiftItemsHttpService.ts) на успех возвращает `{ ok: true }`.

Стабильный clientId помогает избежать повторной вставки строки; старые callers без clientId такой гарантии не получают. Это не request-wide transaction/versioning и не доказательство авторизации вложенных booking IDs. Открытые ограничения финансового сохранения и закрытия описаны в инженерном реестре; `ok:true` само по себе их не устраняет.
