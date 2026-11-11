# HOWTO: новый API endpoint

Актуализировано: 2026-10-30. Владелец: backend. Это правило для новой реализации, а не утверждение, что существующий API уже приведён к одному виду.

Основные документы: [CONTRIBUTING](../../../../CONTRIBUTING.md), [карта API](../../../../API_DOCUMENTATION.md), [открытые инженерные проблемы](../../../../docs/ENGINEERING_FINDINGS.md). Контракт выбранного маршрута проверяется по route, HTTP/service-коду и схеме; [форматы ответов](API_ERROR_FORMATS.md) описывают helpers и известные различия.

## Граница слоёв

Целевой поток: HTTP → auth/context → валидация формата → service/use-case → явное преобразование результата в HTTP.

В `route.ts` остаются метод, transport, wrappers и делегирование. HTTP service выбирает auth, валидирует body/query/params и переводит ожидаемые ошибки в статус/код ответа. App-level service и persistence adapters выполняют работу с БД; независимые бизнес-инварианты относятся в `packages/core-domain`. Порты определяются рядом с соответствующим доменным модулем или в `core-domain/ports`; не все действующие use-cases уже используют один общий набор портов.

## Выбор контекста и валидации

| Задача | Существующий helper | Граница ответственности |
| --- | --- | --- |
| Проверить пользователя из Bearer или cookies | [resolveRequestAuthContext](requestAuthContext.ts) | Возвращает контекст либо NextResponse; не проверяет право на конкретный бизнес/объект |
| Получить текущий manager/owner business context | [withManagerContext](withManagerContext.ts) | Использует cookie-based `getBizContextForManagers`; `req` не делает его Bearer-wrapper |
| Дополнительно проверить staff из route params | [withManagerAndStaffContext](withManagerAndStaffContext.ts) | Проверяет staff.biz_id; не проверяет автоматически booking/package IDs внутри тела |
| Публичное чтение | [createSupabaseAnonClient](supabaseHelpers.ts) | Анонимный клиент без cookies; публичность операции и доступ к данным всё равно должны быть определены |
| Body/query | [validateRequest / validateQuery](validation/apiValidation.ts) | Возвращают discriminated result; при неуспехе вернуть `result.response` |
| UUID в route params | [getRouteParamUuid](routeParams.ts) | Проверка формата не равна проверке принадлежности объекта |

`validateRequest(req, schema)` асинхронен, `validateQuery(new URL(req.url), schema)` синхронен. Повторяющиеся query-параметры могут стать массивами, числовые значения требуют явного преобразования схемой. `withValidation(schema, handler)` возвращает функцию `(req) => Promise<NextResponse>`; это не готовый ответ без вызова с запросом.

Для операций с service-role клиентом проверяйте actor, бизнес и все вложенные ссылки до мутаций. Наличие context wrapper, page layout или UUID validation не заменяет tenant authorization. Прямо доступный RPC также должен соблюдать эту границу; конкретные пробелы сохранены в инженерном реестре.

## Тонкий transport

Пример фабрики для нового POST-handler. `runHttp` — уже реализованный HTTP service с auth, validation и result mapping:

```ts
import type { NextResponse } from 'next/server';
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';

export function makePostHandler(
  scope: string,
  routeId: string,
  runHttp: (req: Request) => Promise<NextResponse>,
) {
  return async (req: Request) =>
    withRateLimit(
      req,
      routeRateLimit(routeId, RateLimitConfigs.normal),
      () => withErrorHandler(scope, () => runHttp(req)),
    );
}
```

Это пример формы, не универсальная политика лимитов. Выберите preset и action key для конкретной операции; user/business budgets требуют установленной identity. Голый preset без prefix сейчас может делить IP-счётчик с другими маршрутами — [RATE_LIMITING](../../../../RATE_LIMITING.md).

Действующий booking flow можно читать в [runQuickHoldHttp](quickHoldHttpService.ts) и [runQuickHold](quickHoldService.ts): Bearer/cookie context, schema, domain validation и явная проверка `result.ok`. Не копируйте его как доказательство готовой отказоустойчивости уведомлений; соответствующие ограничения описаны в инженерном реестре.

## Ожидаемая ошибка — явный результат

Не превращайте ожидаемый отказ в произвольный `Error` в расчёте на распознавание текста. `handleApiError` использует эвристики по message; текст меняется и может раскрыть внутренние сведения. В HTTP service укажите стабильный error code, безопасное сообщение и статус:

```ts
const result = await runCommand(validatedInput);

if (!result.ok) {
  return createErrorResponse(
    result.error,
    result.message,
    result.publicDetails,
    result.status,
  );
}

return createSuccessResponse(result.data);
```

Фрагмент предполагает такой контракт вашего `runCommand`; это не общий тип всех сервисов репозитория. Нельзя извлекать поля успешной ветки до проверки `ok`. Supabase `{ data, error }` тоже требует явной проверки: fulfilled Promise не означает бизнес-успех.

`withErrorHandler` остаётся внешней защитой от непредвиденного exception. Переданные `details` не скрываются helper автоматически в production. Не передавайте credentials, raw DB errors или персональные данные в публичный ответ.

## Перед завершением изменения

- Зафиксировать метод, auth/tenant boundary, schema, статусы и форму ответа; синхронизировать существующих потребителей и соответствующее OpenAPI-описание.
- Для записи определить атомарность, поведение при частичном отказе и повторе. Изменение envelope само по себе не решает retry/idempotency.
- Выполнить проверки по [CONTRIBUTING](../../../../CONTRIBUTING.md) для изменённых слоёв и проверить значимые негативные/конкурентные случаи в разрешённой среде.

Это руководство не подтверждает закрытие известных дефектов и не возобновляет остановленную WEB-кампанию.

