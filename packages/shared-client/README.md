# Shared Client Package

Статус: справочник исходников, сверка 2026-11-10. Аудитория: разработчики web/mobile. Пакет содержит клиентские утилиты и DTO; server credentials и привилегированные запросы в него не входят.

## Публичные входы

Exports определяет [package.json](package.json), состав корневого экспорта — [src/index.ts](src/index.ts).

| Импорт | Назначение и источник |
| --- | --- |
| @shared-client | Общий экспорт, включая createApiClient/ApiError, rating и остальные helpers |
| @shared-client/log | [Logger](src/log.ts) и [маскирование](src/logSafe.ts) |
| @shared-client/validation | [Валидаторы](src/validation.ts) формата и диапазонов |
| @shared-client/types | [DTO](src/types.ts), включая BookingDto, Slot, StaffInfo |
| @shared-client/i18n | [Имена услуг/мастеров и статусы](src/i18n.ts) |
| @shared-client/formatters | [Форматирование](src/formatters.ts) |
| @shared-client/generated-sdk | [Проверенный booking/shift subset](src/generated-sdk/README.md); собственный fetch transport и ApiError |

Отдельного package export @shared-client/api нет; API client импортируется из корня пакета. Вспомогательные исходники не становятся публичными subpath автоматически.

## Логирование

```typescript
import { createLogger } from '@shared-client/log';

const { logDebug, logWarn, logError } =
    createLogger(() => process.env.NODE_ENV !== 'production');

logError('Booking', 'Request failed', { outcome: 'dependency_error' });
```

Mobile передаёт () => __DEV__. При false debug/warn не выводятся, error содержит только scope/message. При true extra проходит sanitizeObject; scope/message не очищаются. Маскирование частично и зависит от имён ключей/шаблонов строк — [точные ограничения](../../apps/web/src/lib/LOGGING_SECURITY.md). Logger пишет в console, поэтому пакет целиком нельзя называть чистым и без побочных эффектов.

## Валидация и типы

```typescript
import { validateEmail, validatePhone, isUuid } from '@shared-client/validation';

const emailResult = validateEmail('user@example.invalid');
const phoneResult = validatePhone('+996555000000', true);
const uuidValid = isUuid('11111111-1111-4111-8111-111111111111');
```

validateEmail принимает пустой email как optional. validatePhone имеет отдельный required flag; isUuid проверяет форму UUID v1–v5. Успешная проверка формата не доказывает владение контактом, существование записи или право её менять.

DTO и generic TypeScript не валидируют ответ сервера runtime. Контракт конкретной операции определяет [API guide](../../API_DOCUMENTATION.md); клиентские типы могут быть уже фактической формы API.

## HTTP client

[createApiClient](src/api.ts) принимает явно выбранный baseUrl, необязательные getAuthToken и onError. Для подключения импортировать createApiClient из @shared-client и передать адрес разрешённого стенда, без fallback на production.

Текущие ограничения:

- URL составляется конкатенацией baseUrl + endpoint; согласуйте разделяющий slash.
- Bearer добавляется при наличии токена, если skipAuth не задан. Ошибка получения токена подавляется: запрос может уйти без него. Bearer не заменяет cookies для cookie-only handler.
- JSON тела надо сериализовать вызывающему коду; request options передаются в fetch. Собственных retry, deadline и idempotency нет.
- При успешном HTTP возвращается весь JSON, без unwrap data и без проверки ok. Не-JSON успешный ответ превращается в пустой объект, приведённый к T.
- При HTTP-ошибке создаётся ApiError со status/details/response. Корневые message/error-string распознаются, вложенный error.message текущим parser не извлекается.

Не используйте старый пример GET /api/bookings как существующий endpoint: нужный метод и путь выбираются по [каталогу](../../docs/api/ROUTE_CATALOG.md). API client выполняет сеть, а типизация не гарантирует контракт или безопасность повтора.

## Сопровождение

Пакет включён через workspace; отдельная переустановка/публикация для локального использования не требуется. Проверки изменений shared и потребителей указаны в [CONTRIBUTING](../../CONTRIBUTING.md). Для новых exports обновляйте package manifest, index и этот справочник. Каталог generated SDK имеет [отдельные ограничения](src/generated-sdk/README.md).

BookingStatus определяется единожды в types.ts; корневой export и прежний i18n subpath ссылаются на тот же union.

Проверки из корня: `pnpm -C packages/shared-client typecheck` выполняет отдельно build и test TypeScript config; `pnpm -C packages/shared-client test --runInBand --watchAll=false` исполняет все src/**/*.test.ts. Пакет переиспользует установленный Jest/Next SWC и @types/jest из apps/web, не загружая Next config/.env. Обе проверки обязательны в CI; исключение тестов из build config не исключает их из test gate.
