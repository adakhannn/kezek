# Политика логирования

Статус: правило для нового кода и описание текущих helpers, сверка 2026-11-18 (ARCH-04). Владелец: разработчики web/shared-client. Это не утверждение, что все существующие вызовы уже соответствуют правилу.

## Выбор интерфейса

Web использует [log.ts](log.ts), который создаёт logger из [shared-client/log](../../../../packages/shared-client/src/log.ts). Для нового кода передавайте постоянные scope/message и минимальные технические поля:

```typescript
import { logError } from '@/lib/log';

logError('Booking', 'Confirmation failed', {
    operation: 'confirm',
    outcome: 'dependency_error',
});
```

| Метод | Dev | Production, сервер web (логи Vercel) | Production, браузер и mobile |
| --- | --- | --- | --- |
| logDebug | message и очищенный extra | не выводится | не выводится |
| logWarn | message и очищенный extra | одна строка: message и очищенный extra в JSON | не выводится |
| logError | message и очищенный extra | одна строка: message и очищенный extra в JSON (до 2000 символов) | только scope/message |

Web считает dev любым NODE_ENV, отличным от production, включая test; «сервер» — отсутствие window. Mobile передаёт свой __DEV__ и опций не задаёт, поэтому его вывод не изменился. Extra сначала сериализуется [toLoggable](../../../../packages/shared-client/src/logSafe.ts): Error и ошибки PostgREST сохраняют name, message, `errorCode`, status, hint, details, cause и первые строки stack (раньше Error превращался в `{}`). Message с 18 ноября тоже проходит очистку текста (контакты и credentials), но остаётся постоянной строкой: переменные части передавайте в extra. Правила и ограничения маскирования — [LOGGING_SECURITY](LOGGING_SECURITY.md).

Каждое предупреждение и ошибка также уходят в мониторинг ([monitoring.ts](monitoring.ts)): при заданном `NEXT_PUBLIC_SENTRY_DSN` ошибка становится событием Sentry, предупреждение — хлебной крошкой ([sentryMonitoring.ts](sentryMonitoring.ts), [MONITORING_AND_ALERTS](../../../../MONITORING_AND_ALERTS.md)). Ответ API 5xx оставляет запись сам: [createErrorResponse, handleApiError и withErrorHandler](apiErrorHandler.ts) логируют его один раз (4xx из handleApiError — серверное предупреждение), и сбой логгера никогда не меняет ответ. Маршрут, который отвечает 5xx в обход этих функций, обязан вызвать logError с причиной — это проверяет `pnpm check:silent-errors` в CI.

[Legacy logSafe](logSafe.ts) теперь использует тот же shared sanitizer, но сохраняет прежнюю политику: info/warn/error с очищенным extra разрешены также в production, только debug выключен. Это compatibility API; таблица выше описывает основной интерфейс log.ts.

## Требования к данным

Выбирайте поля по назначению, вместо передачи целого Request, profile, provider payload или Error с неизвестным содержимым. Credentials, OTP, raw cookies и сессионные данные не должны попадать в вызов logger. Имена, email, телефоны, IP и связанные с человеком IDs не являются автоматически безопасной диагностикой.

Не используйте отсутствие предупреждений в production как подтверждение отсутствия проблемы. Для эксплуатации нужны отдельно определённые метрики, alert и обработка бизнесового результата — [мониторинг](../../../../MONITORING_AND_ANALYTICS.md).

## Что действительно проверяет lint

[Web eslint.config.mjs](../../eslint.config.mjs) задаёт no-console:error с allow:['error']. Это разрешает console.error **во всех файлах в области правила**, а не только в log.ts/logSafe.ts. Тесты/e2e исключены; локальные eslint-disable также могут отключать правило. Оно не анализирует содержимое message/extra и не доказывает отсутствие PII.

[CI](../../../../.github/workflows/ci.yml) запускает корневой pnpm lint. [Корневая конфигурация](../../../../eslint.config.mjs) задаёт no-console:warn с allow:['warn','error']; это слабее отдельной web-проверки и не обеспечивает её строгий запрет. Build, root lint и web lint — разные проверки. Требования для продуктовой правки — [CONTRIBUTING](../../../../CONTRIBUTING.md). Исторические заявления о завершённой миграции console не заменяют проверку текущего diff.
