# API: клиентские сценарии и дополнительные способы входа

Статус: reference. Владелец: engineering. Статическая сверка: **2026-11-01**. Runtime с реальными внешними сервисами: **NOT_RUN**.

Справочник покрывает 30 пар METHOD/path из текущего [каталога routes](ROUTE_CATALOG.md): дополнительные auth flows, мобильный каталог и брони, запрос удаления аккаунта, email preferences, публичный поиск. Методы сверены по exports `route.ts` / `route.tsx`, HTTP adapters и services. Описанные запросы при этой работе не исполнялись; конфигурация среды, фактические права БД, доставка сообщений и применение миграций не проверялись.

Связанные документы: [общий API-вход](../../API_DOCUMENTATION.md), [основные auth/integration endpoints](AUTH_AND_INTEGRATIONS.md), [бронирования и каталог](BOOKING_AND_CATALOG.md), [индекс документации](../README.md), [engineering findings](../ENGINEERING_FINDINGS.md). Этот справочник не изменяет WEB acceptance и не возобновляет закрытую кампанию.

## Обозначения и границы

`S(value)` означает HTTP 200 с `{ ok: true, data: value }`. `E(status, code)` — ошибку с `{ ok: false, error: code, message?, details? }`. Это краткие формы описания типов, а не JSON для отправки. Корневые поля, redirects и нестандартные ошибки оговорены отдельно. Источник общего mapper — [apiErrorHandler.ts](../../apps/web/src/lib/apiErrorHandler.ts): он классифицирует исключения по тексту, поэтому ошибочный JSON не везде даёт 400. У routes без общей обёртки нельзя обещать JSON-envelope для необработанного исключения.

Cookie session означает серверный Supabase client из [supabaseHelpers.ts](../../apps/web/src/lib/supabaseHelpers.ts). Bearer поддерживается явно в mobile booking handlers через [mobileBookingAuthService.ts](../../apps/web/src/lib/mobileBookingAuthService.ts). Management context и его неоднородные auth-ошибки описаны в [общих правилах booking/catalog](BOOKING_AND_CATALOG.md).

Limiter: `public/shared` = 10 / 60 секунд, `normal/shared` = 30 / 60 секунд, `auth/route` = 5 / 15 минут с отдельным prefix пути. Shared использует общий IP-key с другими непредфиксированными routes; это не независимая квота endpoint. Остальные квоты приведены явно. [Rate limiter](../../apps/web/src/lib/rateLimit.ts) возвращает 429 `rate_limit_exceeded`, `retryAfter`, `Retry-After` и `X-RateLimit-*`, поддерживает Redis и память процесса. Нет wrapper означает только отсутствие этой обёртки в рассмотренной цепочке; внешние ограничения неизвестны.

`OPEN static risk` означает конкретное наблюдение в исходниках, не воспроизведённый runtime-инцидент. Оно не устранено этой документационной работой. Особенно нельзя считать передачу credentials или exchange-code доказательством безопасной привязки к инициатору.

## Управление способами входа и OAuth

<!-- api-contract: POST /api/auth/connections/unlink -->
### POST `/api/auth/connections/unlink`

Источники: [route](../../apps/web/src/app/api/auth/connections/unlink/route.ts) → [socialIdentityUnlinkService.ts](../../apps/web/src/lib/socialIdentityUnlinkService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Cookie session; JSON `provider` — ровно `google`, `yandex`, `telegram` или `whatsapp`. Ручная проверка, без Zod |
| Success | `S({ provider, remainingMethods: number })` |
| Errors | 401 `auth`; 400 `validation` с `details.code` = `invalid_json` / `invalid_provider`; 404 `not_found` / `identity_not_connected`; 409 `conflict` / `last_login_method`; 500 `internal` для lookup/unlink/metadata cleanup |
| Limiter | Нет |
| Effects | Считает подключённые Google/Yandex/Telegram/WhatsApp, запрещает удалять последний из этих методов. Google отвязывается RPC `unlink_auth_identity`; другие — через profile и metadata. Для Google/Yandex удаляется источник notification email. Операции не атомарны: `metadata_cleanup_failed` возможен после уже изменённого profile. Email/password как отдельный способ входа в этом счётчике не учитывается |

<!-- api-contract: GET /auth/callback/google -->
### GET `/auth/callback/google`

Источники: [route](../../apps/web/src/app/auth/callback/google/route.ts), [sanitizeAuthReturnPath](../../apps/web/src/lib/authReturnUrl.ts), [email sync](../../apps/web/src/lib/userNotificationEmailService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | OAuth `code` в query, cookie-контекст code exchange; `next` необязателен и нормализуется в локальный путь, default `/` |
| Success | Redirect на `/auth/callback?next=...`, auth cookies формируются через Supabase `exchangeCodeForSession` |
| Errors | Redirect `/auth/sign-in?error=no_code`, `oauth_config_error` или `oauth_exchange_failed`; общего JSON-handler нет |
| Limiter | Нет |
| Effects | Обменивает OAuth code, устанавливает/удаляет cookies по ответам Supabase, синхронизирует notification emails найденного пользователя. Ошибка синхронизации логируется и не отменяет redirect. Внешняя конфигурация Google/Supabase не проверена |

<!-- api-contract: GET /api/auth/yandex/start -->
### GET `/api/auth/yandex/start`

Источники: [route](../../apps/web/src/app/api/auth/yandex/start/route.ts), [OAuth config](../../apps/web/src/lib/yandexOAuthConfig.ts), [return-path sanitizer](../../apps/web/src/lib/authReturnUrl.ts), [state service](../../apps/web/src/lib/yandexOAuthState.ts), [state storage/RPC](../../supabase/migrations/20261109100000_yandex_oauth_state.sql).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Пользовательская session не нужна; query `redirect`, нормализуемый в локальный путь, default `/` |
| Success | Redirect на Yandex authorize с `response_type=code`, `client_id`, `redirect_uri`, случайным `state` |
| Errors | Нет OAuth credentials или недоступно state storage → redirect `/auth/sign-in?error=yandex_unavailable`; другие исключения без общего JSON-handler |
| Limiter | 5/15 минут, отдельный prefix `yandex-sign-in-start` |
| Effects | Создаёт в БД hash случайного state, flow и сохраненный return path с server TTL 10 минут; raw state хранится в HttpOnly cookie. Cookies `kezek_yandex_sign_in_state` и `kezek_yandex_return_path`: SameSite=Lax, `secure` в production, maxAge 10 минут |

<!-- api-contract: POST /api/auth/yandex/link/start -->
### POST `/api/auth/yandex/link/start`

Источники: [route](../../apps/web/src/app/api/auth/yandex/link/start/route.ts), [OAuth config](../../apps/web/src/lib/yandexOAuthConfig.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Cookie session; тело не используется |
| Success | HTTP 200, корневые `{ ok: true, authUrl: string }`, без `data` |
| Errors | 401 `auth`; отсутствие credentials — 503 `config`; ошибка сохранения state — 503 `service_unavailable`; другие исключения не унифицированы |
| Limiter | 5/15 минут, отдельный prefix `yandex-link-start` |
| Effects | Создаёт state record с flow `link` и текущим user_id; cookie `kezek_yandex_link_state` на 10 минут, HttpOnly/SameSite=Lax, `secure` в production. Непосредственной привязки identity на этом шаге нет |

<!-- api-contract: GET /api/auth/yandex/callback -->
### GET `/api/auth/yandex/callback`

Источники: [route](../../apps/web/src/app/api/auth/yandex/callback/route.ts) → [HTTP](../../apps/web/src/lib/yandexAuthCallbackHttpService.ts) → [route service](../../apps/web/src/lib/yandexAuthCallbackRouteService.ts) → [OAuth service](../../apps/web/src/lib/yandexAuthCallbackService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Обязательный query `state` формата 64 lowercase hex должен совпасть с browser cookie; иначе обмен `code` не начинается. Link дополнительно требует текущую session. БД атомарно потребляет неистёкший state нужного flow и user_id; повтор/просроченный/чужой state не проходит. Query `redirect` заменяется сохраненным серверным return path |
| Success | Link → redirect `/cabinet/profile?linked=yandex`. Sign-in → redirect `/auth/callback?next=...` с `access_token` и `refresh_token` во fragment. JSON-сессия не возвращается |
| Errors | Redirect error: `session_required`, `yandex_state`, `no_code`, `yandex_unavailable`, `yandex_exchange_failed`, `yandex_profile_failed`; link errors `yandex_identity_already_linked` / `yandex_link_failed`. Ошибка state storage или неожиданный отказ callback → `yandex_unavailable`; для новой попытки после consume нужно снова начать OAuth |
| Limiter | Нет |
| Effects | После consume обращается к token/profile API Yandex; находит/создаёт пользователя и profile, связывает identity, синхронизирует email. Sign-in вызывает [verifiedIdentitySession](../../apps/web/src/lib/verifiedIdentitySession.ts): generateLink + verifyOtp без сброса существующего пароля; проверяется целевой user ID. Link не создаёт новую session. Часть profile/email/metadata ошибок только логируется. Callback очищает cookies обеих веток |

Изменение 9–10 ноября 2026: [HTTP cases](../../apps/web/src/__tests__/lib/yandexAuthCallbackHttpService.test.ts), [start cases](../../apps/web/src/__tests__/api/auth/yandex-start.test.ts), [state adapter](../../apps/web/src/__tests__/lib/yandexOAuthState.test.ts) и service tests прошли изолированно. [PostgreSQL harness](../../scripts/test-mobile-auth-grants-isolated.cjs) проверил 12 параллельных consume → ровно один успех, expiry, user binding и запрет create/consume для anon/authenticated. Это disposable PostgreSQL, не deployed Supabase. Для включения нового пути нужна миграция `20261109100000_yandex_oauth_state.sql`; до её применения start/callback отказывают закрыто. Реальный вход у провайдера не проверялся.

## Telegram: браузерный вход и привязка

<!-- api-contract: POST /api/auth/telegram/web-login -->
### POST `/api/auth/telegram/web-login`

Источники: [route](../../apps/web/src/app/api/auth/telegram/web-login/route.ts) → [HTTP](../../apps/web/src/lib/telegramWebLoginHttpService.ts) → [attempt service](../../apps/web/src/lib/telegramWebLoginService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / gate | `NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED === "true"`; HTTPS public origin и точное совпадение заголовка Origin. `create` / `finish` отклоняют уже вошедшего пользователя. Это отдельный flow от Widget login |
| Input | JSON `action`: `create`, `status`, `cancel`, `finish`. Для всех кроме create нужны `token` по `[A-Za-z0-9_-]{32}` и соответствующая browser-cookie `__Host-kezek-telegram-login`; finish требует положительный safe integer `telegramId` |
| Success | `S(...)`: create `{ token, expiresAt: ISO string, code, botDeepLink }`; status `{ status, account: null или {id,name} }`; cancel `{status:"cancelled"}`; finish `{status:"signed_in"}` |
| Errors | Нестандартный `{ok:false,message}`: 400 input; 401 browser/token; 403 Origin; 404 attempt недоступен браузеру; 409 уже вошёл/attempt closed/not linked/неподходящий профиль; 503 flag/config/storage/session. Limiter имеет собственный общий error envelope |
| Limiter | Отдельный IP-prefix на action: create 5 / 15 минут; status 40 / минуту; cancel/finish 10 / минуту |
| Effects | Create сохраняет hashes token/browser и 5-минутную attempt, ставит Secure HttpOnly SameSite=Strict cookie. Finish вызывает transition RPC, затем generateLink/verifyOtp и устанавливает auth cookies, очищает attempt-cookie. `generateLink` сам не отправляет email. Ошибка session после consume требует новой attempt; успешный consume не откатывается. Ответы handler имеют `Cache-Control: no-store`, `Referrer-Policy: no-referrer` |

<!-- api-contract: POST /api/auth/telegram/profile-link -->
### POST `/api/auth/telegram/profile-link`

Источники: [route](../../apps/web/src/app/api/auth/telegram/profile-link/route.ts) → [HTTP](../../apps/web/src/lib/telegramProfileLinkHttpService.ts) → [service](../../apps/web/src/lib/telegramProfileLinkService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / gate | Cookie session, точный Origin; `NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED === "true"` |
| Input | JSON action `create/status/cancel/finish`; кроме create — строковый token `[A-Za-z0-9_-]{32}`; finish — положительный safe integer `telegramId` |
| Success | Create `S({token,expiresAt,botDeepLink})`, TTL 5 минут; status `S({status,expiresAt,account})`, account раскрывается только при approved; cancel/finish возвращают transition `{status?}`. Cancel для expired/closed/not_found нормализуется в `{status:"cancelled"}` |
| Errors | 401 `auth`; 403 `forbidden`; 400 `validation`; status missing — 404 `not_found`; transition expired — 410 `expired`; другие transition errors — 409 с соответствующим code (`already_linked`, `already_connected`, `different_account`, `not_approved`, `closed`, `not_found`); 503 flag/config; исключения через общий mapper |
| Limiter | Отдельный **user**-key на action: create 5 / 15 минут, status 40 / минуту, cancel/finish 15 / минуту |
| Effects | Записывает attempt с owner ID/token hash; transition RPC управляет подтверждением/привязкой. Чтение status ограничено owner ID. Route добавляет `Cache-Control: no-store` и к обработанным ошибкам |

## Telegram: мобильный flow

Контракт mobile обновлён 2026-11-10. Локальные unit/integration и изолированный PostgreSQL пройдены; provider end-to-end, remote migration и mobile build runtime — **NOT_RUN**. Перед выпуском нужна [миграция bound grants](../../supabase/migrations/20261109090000_bound_mobile_session_grants.sql) и совместимый клиент; attempts старой версии без challenge отклоняются.

Все четыре route используют [featureFlags.ts](../../apps/web/src/lib/featureFlags.ts): start учитывает flag и rollout, остальные — flag. Выключенная ветка возвращает 503 `service_unavailable` до limiter. Значения окружения не проверялись. Источник состояния attempts — [telegramMobileAuthAttemptService.ts](../../apps/web/src/lib/telegramMobileAuthAttemptService.ts); состояние exchange — отдельный flow из [AUTH_AND_INTEGRATIONS](AUTH_AND_INTEGRATIONS.md), с одноразовым атомарным consume и проверкой verifier инициатора.

<!-- api-contract: POST /api/auth/telegram/mobile/start -->
### POST `/api/auth/telegram/mobile/start`

Источники: [route](../../apps/web/src/app/api/auth/telegram/mobile/start/route.ts) → [HTTP](../../apps/web/src/lib/telegramMobileStartHttpService.ts) → [service](../../apps/web/src/lib/telegramMobileStartRouteService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Session не требуется. Обязателен JSON `codeChallenge`: SHA256 локального verifier, 64 lowercase hex. Необязательные строки `appName`, `device`, `region`, `platform` обрезаются до 120 символов; неверные типы игнорируются, default appName `Kezek Mobile`. User-Agent берётся из header |
| Success | `S({nonce,botDeepLink,expiresAt})`; expiresAt — число epoch milliseconds; attempt TTL по умолчанию 5 минут |
| Errors | 400 validation для JSON/отсутствующего или неверного challenge; 503 gate; прочие ошибки через общий mapper |
| Limiter | Отдельный IP-prefix, 8 / 15 минут |
| Effects | Создаёт DB attempt pending с challenge/source metadata, пишет audit event. Verifier остаётся в SecureStore инициирующего приложения |

<!-- api-contract: GET /api/auth/telegram/mobile/status -->
### GET `/api/auth/telegram/mobile/status`

Источники: [route](../../apps/web/src/app/api/auth/telegram/mobile/status/route.ts) → [HTTP](../../apps/web/src/lib/telegramMobileStatusHttpService.ts) → [service](../../apps/web/src/lib/telegramMobileStatusRouteService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Session не требуется; обязательный непустой query `nonce`, trim. Nonce позволяет читать статус; получение session дополнительно требует verifier инициатора при обмене grant |
| Success | `S({status,expiresAt,exchangeCode?})`; status `pending/approved/expired/failed`, внутренний `consumed` показывается как pending; expiresAt число или null. Неизвестная attempt может дать 200 со status failed, не 404 |
| Errors | 400 `validation` без nonce; 503 gate; 429 `rate_limit` от nonce-probe protection с `details.retryAfter`; общий mapper |
| Limiter | Отдельный IP-prefix, 60 / минуту, плюс [probe protection](../../apps/web/src/lib/telegramMobileNonceProbeProtection.ts) |
| Effects | Проверка может пометить истёкшую attempt expired; failed status увеличивает счётчик invalid nonce probes. Approved возвращает exchangeCode; сам code без verifier недостаточен для session. Nonce/code всё равно не следует писать в журналы |

Для confirm/callback применяется [telegramMobileBotRequestAuth.ts](../../apps/web/src/lib/telegramMobileBotRequestAuth.ts): заголовки `x-telegram-bot-secret`, `x-telegram-bot-timestamp` (10-значные epoch seconds), `x-telegram-bot-request-id` (8–128 букв/цифр/`_`/`-`), `x-telegram-bot-signature` (HMAC SHA-256 от `timestamp.requestId.rawBody`, допускается prefix `sha256=`). Проверяются shared secret, подпись, отклонение времени до 5 минут и повтор request ID; replay-cache хранится в памяти процесса на 10 минут. Это не гарантия единого replay-cache нескольких instances.

<!-- api-contract: POST /api/auth/telegram/mobile/confirm -->
### POST `/api/auth/telegram/mobile/confirm`

Источники: [route](../../apps/web/src/app/api/auth/telegram/mobile/confirm/route.ts) → [HTTP](../../apps/web/src/lib/telegramMobileConfirmHttpService.ts) → [service](../../apps/web/src/lib/telegramMobileConfirmRouteService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Bot headers выше; JSON `nonce` (непустая строка), `telegram_id` (положительное целое), необязательные `first_name`, `last_name`, `username`, `photo_url`. JSON разбирается после проверки подписи; полной Zod-схемы нет |
| Success | `S({status:"approved",nonce,expiresAt,linkage:"existing" или "created"})`; повтор уже approved с тем же Telegram ID имеет успешную ветку |
| Errors | 400 validation; 401 auth; 404 attempt not_found; 409 conflict при replay/обработанной attempt/другом Telegram ID; 410 conflict expired; 429 limiter/probe; 503 gate/secret; 500 internal при подготовке login/session/exchange |
| Limiter | Отдельный IP-prefix, 20 / 15 минут, плюс nonce-probe protection |
| Effects | Атомарно потребляет pending attempt, проверяет сохранённый challenge, вызывает identity resolver и создаёт bound grant; отмечает approved либо failed. Password-reset и создание session на этом шаге удалены. Grant/session выдаётся только после отдельного обмена с verifier. Consume/identity/profile/grant не являются общей транзакцией: после промежуточного отказа может потребоваться новая попытка |

<!-- api-contract: POST /api/auth/telegram/mobile/callback -->
### POST `/api/auth/telegram/mobile/callback`

Источники: [route](../../apps/web/src/app/api/auth/telegram/mobile/callback/route.ts) → [HTTP](../../apps/web/src/lib/telegramMobileCallbackHttpService.ts) → [service](../../apps/web/src/lib/telegramMobileCallbackRouteService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Те же bot headers; nonce/telegram_id/metadata как confirm плюс `decision`. После trim/lowercase approve aliases: `approve`, `approved`, `confirm`, `ok`; cancel aliases: `cancel`, `deny`, `reject`, `failed` |
| Success | `S({status:"approved" или "failed",nonce,decision:"approve" или "cancel",expiresAt,linkage?})` |
| Errors | 400 input; 401 bot auth; 404 missing attempt; 409 identity/state/replay conflict; 410 expired; 429 limiter/probe; 503 gate/config; 500 internal и общий mapper |
| Limiter | Отдельный IP-prefix, 20 / 15 минут, плюс nonce-probe protection |
| Effects | Approve делегирует confirm; cancel помечает attempt failed, проверив доступный expected Telegram ID. Пишет audit events для успешных и ошибочных решений |

## WhatsApp: вход и мобильные attempts

Эти auth routes отличаются от `/api/whatsapp/send-otp` / `verify-otp` из [основного integration-справочника](AUTH_AND_INTEGRATIONS.md). Нельзя переносить их проверки caller/OTP/session друг на друга.

<!-- api-contract: POST /api/auth/whatsapp/send-otp -->
### POST `/api/auth/whatsapp/send-otp` — протокол снят с поддержки

Источники: [route](../../apps/web/src/app/api/auth/whatsapp/send-otp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppAuthSendOtpHttpService.ts) → [общий ответ](../../apps/web/src/lib/retiredWhatsAppAuth.ts).

| Аспект | Контракт |
| --- | --- |
| Вход | Тело не читается; cookie/Bearer, phone, userId и OTP не меняют результат |
| Ответ | **410**, `{ok:false,error:"auth_protocol_retired",message}`, `Cache-Control: no-store`; 429 возможен до обработчика от auth limiter |
| Эффекты | Нет обращений к Auth, БД и провайдеру, смены пароля, выдачи credentials или сессии |
| Совместимость | Старые внешние клиенты должны перейти на актуальный start/verify/exchange с verifier; наличие таких клиентов вне checkout не проверено |

<!-- api-contract: POST /api/auth/whatsapp/verify-otp -->
### POST `/api/auth/whatsapp/verify-otp` — протокол снят с поддержки

Источники: [route](../../apps/web/src/app/api/auth/whatsapp/verify-otp/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppAuthVerifyOtpHttpService.ts) → [общий ответ](../../apps/web/src/lib/retiredWhatsAppAuth.ts).

| Аспект | Контракт |
| --- | --- |
| Вход | Тело не читается; cookie/Bearer, phone, userId и OTP не меняют результат |
| Ответ | **410**, `{ok:false,error:"auth_protocol_retired",message}`, `Cache-Control: no-store`; 429 возможен до обработчика от auth limiter |
| Эффекты | Нет обращений к Auth, БД и провайдеру, смены пароля, выдачи credentials или сессии |
| Совместимость | Старые внешние клиенты должны перейти на актуальный start/verify/exchange с verifier; наличие таких клиентов вне checkout не проверено |

<!-- api-contract: POST /api/auth/whatsapp/create-session -->
### POST `/api/auth/whatsapp/create-session` — протокол снят с поддержки

Источники: [route](../../apps/web/src/app/api/auth/whatsapp/create-session/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppCreateSessionHttpService.ts) → [общий ответ](../../apps/web/src/lib/retiredWhatsAppAuth.ts).

| Аспект | Контракт |
| --- | --- |
| Вход | Тело не читается; cookie/Bearer, phone, userId и OTP не меняют результат |
| Ответ | **410**, `{ok:false,error:"auth_protocol_retired",message}`, `Cache-Control: no-store`; 429 возможен до обработчика от auth limiter |
| Эффекты | Нет обращений к Auth, БД и провайдеру, смены пароля, выдачи credentials или сессии |
| Совместимость | Старые внешние клиенты должны перейти на актуальный start/verify/exchange с verifier; наличие таких клиентов вне checkout не проверено |

Для mobile start/verify действуют [feature flags](../../apps/web/src/lib/featureFlags.ts), [abuse protection](../../apps/web/src/lib/whatsAppMobileAbuseProtection.ts) и опциональная [идемпотентность](../../apps/web/src/lib/whatsAppMobileAuthIdempotency.ts): `x-client-timestamp`, если присутствует, — epoch milliseconds с окном ±5 минут; `x-idempotency-key` позволяет повторно получить успешный результат из памяти процесса на 5 минут. Это не распределённый durable idempotency store. Abuse checks выполняются до чтения cache.

<!-- api-contract: POST /api/auth/whatsapp/mobile/start -->
### POST `/api/auth/whatsapp/mobile/start`

Источники: [route](../../apps/web/src/app/api/auth/whatsapp/mobile/start/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppMobileStartHttpService.ts) → [service](../../apps/web/src/lib/whatsAppMobileStartRouteService.ts), [provider error mapping](../../apps/web/src/lib/whatsAppMobileProviderErrorMapping.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Session не требуется; flag + rollout. JSON `phone`, непустой и нормализуемый в E.164, и обязательный `codeChallenge` (SHA256 verifier, 64 lowercase hex); optional headers выше |
| Success | `S({attemptId,maskedDestination,expiresAt})`, expiresAt ISO string, OTP TTL 5 минут |
| Errors | 400 validation JSON/challenge/phone/timestamp; 429 rate_limit abuse/provider; 503 service_unavailable gate/service-role/template config; 500 internal attempt storage; provider codes: 400 template_mismatch/recipient_unavailable, 502 provider_error, 503 provider_unavailable |
| Limiter | Отдельный IP-prefix, 10 / 15 минут + abuse checks по IP/phone |
| Effects | Генерирует OTP через crypto, сохраняет attempt, OTP hash и совместимое поле code, отправляет template, пишет metrics. При provider error пытается пометить attempt failed/consumed; успех означает завершение send-call, не доказанную доставку. Idempotency key строится из flow/входного phone/challenge/header; retry клиента сохраняет тот же challenge и verifier |

<!-- api-contract: POST /api/auth/whatsapp/mobile/verify -->
### POST `/api/auth/whatsapp/mobile/verify`

Источники: [route](../../apps/web/src/app/api/auth/whatsapp/mobile/verify/route.ts) → [HTTP](../../apps/web/src/lib/whatsAppMobileVerifyHttpService.ts) → [service](../../apps/web/src/lib/whatsAppMobileVerifyRouteService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Session не требуется; flag. JSON `attemptId` непустая строка, `code` — 6 цифр после trim, необязательный `phone` должен соответствовать attempt; UUID-схемы attemptId нет. Optional headers выше |
| Success | `S({status:"approved",attemptId,exchangeCode,expiresAt,userId,linkage})`; linkage existing/created, expiresAt ISO string |
| Errors | 400 validation input/phone/invalid_code/timestamp; 404 not_found; 409 conflict already used/identity link/нет challenge/atomic consume отказал; 410 validation expired; 429 rate_limit locked/abuse; 503 gate; ошибки user/session/exchange могут дать 400/404/409/500 по нижнему service, общий mapper |
| Limiter | Отдельный IP-prefix, 20 / 15 минут + abuse checks по IP/attempt |
| Effects | Проверяет OTP hash и phone. RPC атомарно потребляет OTP с сохранённым challenge до user/profile/grant effects; второй concurrent verify не создаёт grant. Неверные попытки также считаются атомарно, максимум 5, затем lock 10 минут. Находит/создаёт user, сохраняет verified profile и выдаёт bound grant без смены password и без Auth session на этом шаге. Идентификация, profile и grant не составляют общую транзакцию; после позднего отказа нужен новый OTP. Idempotency cache key включает attemptId/code/header, но авторитет однократного consume — DB |

## Мобильный каталог и брони

<!-- api-contract: GET /api/mobile/businesses -->
### GET `/api/mobile/businesses`

Источники: [route](../../apps/web/src/app/api/mobile/businesses/route.ts) → [HTTP](../../apps/web/src/lib/mobileBusinessesHttpService.ts) → [service](../../apps/web/src/lib/mobileBusinessesService.ts); `PublicBusinessDto` в [shared types](../../packages/shared-client/src/types.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Публичный anon client. Query `search`, `category`, `page` default 1, `limit` default 20. Не-конечные числа заменяются default; page округляется вниз и ограничен снизу 1, limit — целое 1..50. Search обрезается до 100 и экранирует `%`, `_`, `\` для ilike |
| Success | `S(PublicBusinessDto[])`: `{id,name,slug,address,phones,categories,rating_score}`; нет total/hasMore envelope |
| Errors | 500 internal query error; общий mapper; 429 |
| Limiter / effects | `public/shared`; читает approved businesses, фильтрует search по name/address и category, сортирует name и применяет range. Записи не изменяет |

Для всех трёх mobile booking methods auth — Bearer (при наличии непустого префикса `Bearer `) либо cookie fallback. Неверный переданный Bearer не переключается на действующую cookie. Чтение/изменение дополнительно ограничены `client_id = user.id`. Источники общие: [HTTP](../../apps/web/src/lib/mobileBookingsHttpService.ts), [auth resolver](../../apps/web/src/lib/mobileBookingAuthService.ts), [service](../../apps/web/src/lib/mobileBookingsService.ts), DTO в [shared types](../../packages/shared-client/src/types.ts).

<!-- api-contract: GET /api/mobile/bookings -->
### GET `/api/mobile/bookings`

Источник route: [GET](../../apps/web/src/app/api/mobile/bookings/route.ts).

| Аспект | Контракт |
| --- | --- |
| Input / output | Тело/query не используются. `S(ClientBookingListItemDto[])`: id/start_at/end_at/status и nullable вложенные service(name_ru), staff(full_name), branch(name/address), business(name/slug) |
| Auth / errors | Auth выше; 401 auth, 500 internal при query, 429 |
| Limiter / effects | `normal/shared`; читает максимум **50** собственных броней, start_at descending. Параметров следующей страницы нет; это не полная история |

<!-- api-contract: GET /api/mobile/bookings/[id] -->
### GET `/api/mobile/bookings/[id]`

Источник route: [GET](../../apps/web/src/app/api/mobile/bookings/[id]/route.ts).

| Аспект | Контракт |
| --- | --- |
| Input / output | `[id]` UUID; `S(ClientBookingDetailsDto)`, поля list + service duration_min/price_from/price_to, business phones. Связанные объекты nullable |
| Auth / errors | Auth выше; 401 auth, 400 validation UUID, 404 not_found при отсутствующей/чужой брони, 500 internal query, 429 |
| Limiter / effects | `normal/shared`; только чтение выбранной собственной брони |

<!-- api-contract: POST /api/mobile/bookings/[id] -->
### POST `/api/mobile/bookings/[id]`

Источник route: [POST](../../apps/web/src/app/api/mobile/bookings/[id]/route.ts).

| Аспект | Контракт |
| --- | --- |
| Input / output | `[id]` UUID; тело не читается. Отмена возвращает `S({alreadyCancelled:boolean})`, true при ранее cancelled |
| Auth / errors | Auth выше; 401 auth, 400 UUID, 404 отсутствующая/чужая бронь, 409 financial_reversal_required/not_cancellable/booking_changed, 403 forbidden при отказе RPC, 500 internal, 429 |
| Limiter / effects | `normal/shared`; checked `cancel_booking` RPC после проверки client_id. Только hold/confirmed; paid/ledger/applied benefit требуют финансового возврата. DB trigger ставит уведомление в ту же транзакцию. Прямой UPDATE удалён |

<!-- api-contract: POST /booking/[id]/cancel -->
### POST `/booking/[id]/cancel`

Источники: [route](../../apps/web/src/app/booking/[id]/cancel/route.ts) → [serverCancelBookingService.ts](../../apps/web/src/lib/serverCancelBookingService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Cookie client; `[id]` берётся как строка без UUID-схемы. Тело не используется. Для обычной отмены нужен пользователь-владелец брони. Already-cancelled возвращается после auth/ownership; первоначальное чтение зависит от cookie-client/RLS |
| Success | Redirect обратно на `/booking/[id]`; это не JSON API cancellation response |
| Errors | 403 `{ok:false,error:"FORBIDDEN"}` для отсутствующего пользователя/брони/ownership; стабильные RPC-отказы — 403/404/409 с message, включая financial_reversal_required; прочие пойманные errors — 400; ошибки до try не унифицированы |
| Limiter / effects | Нет limiter. Checked Cancel RPC без прямого UPDATE fallback. После изменения статуса DB trigger транзакционно записывает notification outbox; отдельный anonymous fetch `/api/notify` удалён 10 ноября. Redirect не означает доставку провайдером |

## Аккаунт и уведомления

Все методы account deletion используют [route](../../apps/web/src/app/api/account/deletion/route.ts) и [accountDeletionService.ts](../../apps/web/src/lib/accountDeletionService.ts). Cookie session обязательна, limiter отсутствует. `context()` создаётся до локального try; неожиданные ошибки создания клиента/auth могут не иметь описанного JSON-envelope.

<!-- api-contract: GET /api/account/deletion -->
### GET `/api/account/deletion`

| Аспект | Контракт |
| --- | --- |
| Input / success | Без тела/query. `S({request,blockers,eligible})`; request null или `{status,requested_at,scheduled_for}`, blocker `{code,message,count}` |
| Auth / errors | Cookie session; 401 auth, 500 internal lookup/assessment |
| Limiter / effects | Нет; читает состояние и зависимости. Blockers: super_admin, владение бизнесом, любые найденные business/global roles, staff records, будущие hold/confirmed/paid брони. Несмотря на имя `active_staff`, query считает staff без фильтра is_active |

<!-- api-contract: POST /api/account/deletion -->
### POST `/api/account/deletion`

| Аспект | Контракт |
| --- | --- |
| Input | JSON `confirmation`; значение преобразуется в string, trim/uppercase должно дать `УДАЛИТЬ`, `DELETE` или `ӨЧҮРҮҮ` |
| Success | `S({ok:true,scheduledFor: ISO string})`: внутренний ok сохраняется в data. Срок — текущее время + 7 суток |
| Auth / errors | Cookie session; 401 auth; 400 validation JSON или `details.code=confirmation_required`; 409 validation с `details.code=deletion_blocked` и blockers; 500 internal |
| Limiter / effects | Нет. Upsert pending request со snapshot preferences, выключение уведомлений, metadata account_deletion_pending/scheduled_for. **Фактического удаления Auth user/данных этот маршрут не выполняет.** Повторный допустимый POST пересчитывает срок и snapshot; идемпотентного возврата первоначальной заявки нет. Часть profile update errors не проверяется; общей транзакции нет |

<!-- api-contract: DELETE /api/account/deletion -->
### DELETE `/api/account/deletion`

| Аспект | Контракт |
| --- | --- |
| Input / success | Тело/query не используются; `S({ok:true})` |
| Auth / errors | Cookie session; 401 auth, 500 internal |
| Limiter / effects | Нет. Pending request переводится в cancelled; допустимые boolean preferences восстанавливаются из snapshot, deletion metadata очищается. Отсутствие pending request не является 404. Ошибка позднего metadata шага возможна после изменения request/preferences; некоторые profile errors игнорируются |

<!-- api-contract: GET /api/profile/notification-emails -->
### GET `/api/profile/notification-emails`

Источники: [route](../../apps/web/src/app/api/profile/notification-emails/route.ts), [sync service](../../apps/web/src/lib/userNotificationEmailService.ts), [SQL RPC](../../supabase/migrations/20260723090000_user_notification_emails.sql).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Cookie session; тело/query не используются |
| Success | `S(Array<{email,verified,enabled,sources:string[]}>)`; SQL `get_my_notification_emails` ограничен auth.uid; при null data возвращается [] |
| Errors | 401 `{ok:false,error:"auth"}`; 500 `{ok:false,error:"notification_email_lookup_failed"}` для RPC lookup. Ошибка sync не обёрнута общим JSON-handler |
| Limiter / effects | Нет. **GET сначала выполняет записи** через `sync_user_notification_email` для подтверждённого account email, Google identities и Yandex metadata, затем читает результат. Это не чистый read endpoint |

## Публичное расписание, карта и поиск

<!-- api-contract: GET /api/public/work-locations -->
### GET `/api/public/work-locations`

Источники: [route](../../apps/web/src/app/api/public/work-locations/route.ts) → [locations.ts](../../apps/web/src/lib/scheduling/locations.ts), [date validator](../../apps/web/src/lib/scheduling/model.ts), [V2 flag](../../apps/web/src/lib/scheduling/config.ts), [SQL read_staff_work_locations](../../supabase/migrations/20260918130000_explicit_staff_schedules.sql).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Без caller session; серверный service client. Query `bizId` (проверка 36 символов hex/hyphen, не полноценная UUID-схема), `from`, `to` — валидные даты; to >= from, разница не более 62 дней. Approved business обязателен, from не раньше текущей даты в timezone бизнеса (fallback Asia/Bishkek) |
| Success | Корневой `{ok:true,data:Array<{staff_id,branch_id,date_on}>,availabilityComplete:boolean}`. Flag true → RPC `read_staff_work_locations`: рабочие дни активных сотрудников в филиале, отличающемся от их домашнего. False → строки активных date-rules. Семантика источников различается, хотя поля совпадают |
| Errors | 400 validation период/прошлое; 404 not_found business; query/RPC exceptions через общий mapper |
| Limiter / effects | Нет. Читает местоположения работы; флаг true не доказывает фактическую полноту данных/применение миграций. Legacy `availabilityComplete:false` явно сигнализирует неполноту |

<!-- api-contract: GET /api/branches/map -->
### GET `/api/branches/map`

Источники: [route](../../apps/web/src/app/api/branches/map/route.ts) → [HTTP](../../apps/web/src/lib/branchesMapHttpService.ts) → [service и BranchMapItem](../../apps/web/src/lib/branchesMapService.ts), [approved query](../../apps/web/src/lib/branches/buildApprovedBusinessesQuery.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Публичный anon client; необязательные query `cityId`, `categoryId` (trim, без UUID-схемы), `onlyActive` default true; только точная строка `false` выключает active-filter |
| Success | `S(BranchMapItem[])`: id/businessId/businessName/businessSlug/branchName/address/lat/lon/categoryId/categoryName; nullable значения определены в source type |
| Errors | 500 internal при businesses/branches query; общий mapper, 429 |
| Limiter / effects | `public/shared`; approved businesses по city/category, затем их филиалы с координатами. Ограничения **500 businesses и 500 branches**, без pagination. Это обрезанная выборка, не полный каталог; business limit применяется до загрузки филиалов. Записей нет |

<!-- api-contract: GET /api/branches/nearby -->
### GET `/api/branches/nearby`

Источники: [route](../../apps/web/src/app/api/branches/nearby/route.ts) → [HTTP](../../apps/web/src/lib/branchesNearbyHttpService.ts) → [service и BranchNearbyItem](../../apps/web/src/lib/branchesNearbyService.ts).

| Аспект | Контракт |
| --- | --- |
| Auth / input | Публичный anon client. Query lat [-90,90], lon [-180,180] обязательны; `limit` default 20, положительное конечное число округляется вниз/max50; `radiusKm` default20, диапазон1..200; cityId/categoryId необязательны |
| Success | `S(BranchNearbyItem[])`: поля map + distanceKm, округлённое до 2 знаков; categoryName здесь всегда null |
| Errors | 400 validation координат/limit/radius; 500 internal queries/обработка; 429 |
| Limiter / effects | `public/shared`; максимум 500 approved businesses и 2000 активных branches с координатами, затем расстояние/радиус/сортировка/limit вычисляются в JS. **Результат не гарантирует ближайшие филиалы всего каталога**: предварительный лимит способен исключить их до геофильтра. Это дефект полноты, не установленный RPS ceiling. Записей нет |

<!-- api-contract: GET /api/businesses/search -->
### GET `/api/businesses/search`

Источник: [route](../../apps/web/src/app/api/businesses/search/route.ts), отдельного HTTP/service файла нет.

| Аспект | Контракт |
| --- | --- |
| Auth / input | Нет caller auth; service-role client. Query `q` trim/max80, необязателен |
| Success | Корневой `{ok:true,items:Array<{id,name,slug}>}`, slug nullable; approved businesses, name ascending, максимум25 |
| Errors | 400 `{ok:false,message:<DB error>}`, **без error code**; исключения вне этого ответа не унифицированы |
| Limiter / effects | Нет. Непустой q подставляется в PostgREST OR ilike name/slug; отдельного escaping `%`, `_` или синтаксиса OR тут нет. Чтение, без pagination/total |

<!-- api-contract: POST /api/users/search -->
### POST `/api/users/search`

Источники: [route.tsx](../../apps/web/src/app/api/users/search/route.tsx) → [HTTP](../../apps/web/src/lib/usersSearchHttpService.ts) → [service](../../apps/web/src/lib/usersSearchService.ts); [usersSearchSchema](../../apps/web/src/lib/validation/schemas.ts). Это иной путь/метод, чем административный GET `/admin/api/users/search`.

| Аспект | Контракт |
| --- | --- |
| Auth / input | Management cookie context. Строгий JSON: обязательный trim/nonempty `q`; необязательные целые `page` default1, `perPage` default50; service ограничивает оба 1..100, q lowercase/max100 |
| Success | Корневой `{ok:true,items,page,perPage}`, item `{id,email,phone,full_name}`; email/phone nullable. Нет data, total или hasMore |
| Errors | 400 validation JSON/schema; ошибки management context по общему mapper; ошибки Auth list/profile lookup также бросаются в mapper; 429 |
| Limiter / effects | `normal/shared`. Сначала загружает страницу платформенных Auth users, затем обогащает display name, исключает уже назначенных staff текущего бизнеса и фильтрует q **внутри этой страницы**. Это не глобальный поиск совпадений с корректной search-pagination. Возвращает контактные поля найденных аккаунтов; scope не ограничен прежними клиентами бизнеса. Ничего не изменяет |

## Не подтверждено этой работой

Фактические flags, OAuth provider settings, gateway-защита, состояние схемы/RLS, доставка OTP, распределённые replay/idempotency гарантии и соответствие live response описанию остаются **NOT_RUN**. Успешные ветки source-кода не являются evidence приёмки. Выявленные отсутствующие проверки доступа, условная state-проверка, неполная выдача и частичные side effects описаны для корректного использования и будущего исправления; source-код не изменялся.
