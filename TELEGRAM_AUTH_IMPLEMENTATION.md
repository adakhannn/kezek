# Telegram: реализованные сценарии и настройка

Статус: текущий source-справочник, не инструкция внедрить уже существующий код. Сверка: 2026-11-01; runtime/provider checks: `NOT_RUN`. Владелец: authentication / operations.

HTTP-контракты: [login/link и webhook](docs/api/AUTH_AND_INTEGRATIONS.md), [web bot/profile-link/mobile flows](docs/api/CLIENT_AND_AUTH_FLOWS.md). Локальная среда: [Local Telegram testing](docs/LOCAL_TELEGRAM_TESTING.md). Эксплуатация: [Operations](docs/OPERATIONS.md); открытые дефекты: [Engineering findings](docs/ENGINEERING_FINDINGS.md).

## Четыре разных flow

| Flow | Текущая цепочка |
| --- | --- |
| Legacy Login Widget | [TelegramLoginWidget](apps/web/src/components/auth/TelegramLoginWidget.tsx) загружает `telegram-widget.js?22`, передаёт подписанные данные в `/api/auth/telegram/login`. Сервер проверяет подпись, находит/создаёт пользователя, меняет password и возвращает `{ok:true,data:{userId,email,password,needsSignIn,redirect,linkage}}`. Компонент затем вызывает Supabase `signInWithPassword`; endpoint сам не ставит cookie-сессию |
| Legacy Widget для профиля | [TelegramLinkWidget](apps/web/src/app/cabinet/components/TelegramLinkWidget.tsx) вызывает `/api/auth/telegram/link`; нужны cookie session, подписанные данные и отсутствие другого владельца Telegram ID. Меняет профиль/metadata; это привязка, не вход |
| Browser bot login / profile link | [TelegramBotLogin](apps/web/src/components/auth/TelegramBotLogin.tsx) и [TelegramBotLink](apps/web/src/app/cabinet/components/TelegramBotLink.tsx) используют соответственно `/api/auth/telegram/web-login` и `/api/auth/telegram/profile-link`. Действия `create/status/cancel/finish`; подтверждение проходит через бота и webhook. Attempt TTL — 5 минут |
| Mobile deep link | `/api/auth/telegram/mobile/start` требует SHA256 challenge и создаёт nonce/ссылку на бота; status опрашивает попытку, confirm/callback обрабатывают решение. Attempt TTL — 5 минут; exchange grant TTL — 2 минуты. POST mobile-exchange требует verifier инициатора; одноразовое погашение атомарно в БД |

Подтверждённые TTL: [web login service](apps/web/src/lib/telegramWebLoginService.ts), [profile link service](apps/web/src/lib/telegramProfileLinkService.ts), [mobile attempts](apps/web/src/lib/telegramMobileAuthAttemptService.ts). Срок attempt не равен сроку жизни Supabase session.

## Provider contract и legacy Widget

На 2026-11-01 официальная страница [Telegram Login](https://core.telegram.org/bots/telegram-login) описывает новую library/OIDC-интеграцию и отдельно ссылается на [legacy iframe Widget](https://core.telegram.org/widgets/login-legacy). Компоненты этого репозитория используют именно legacy Widget; OIDC `id_token` нельзя передавать существующему HMAC endpoint как совместимый payload.

Для legacy Widget официальная инструкция связывает домен с выбранным ботом через `/setdomain` в BotFather. Используйте домен той среды и того бота, которые проверяются; production-домен не является локальным default. Webhook для получения Widget callback не нужен. Источник: [legacy Widget setup и проверка данных](https://core.telegram.org/widgets/login-legacy).

[verify.ts](apps/web/src/lib/telegram/verify.ts) строит отсортированный `data-check-string`, проверяет HMAC-SHA256 с ключом SHA256(bot token) и отклоняет данные старше 86 400 секунд. Это **24-часовое окно возраста**, не одноразовый nonce: отдельной проверки будущего `auth_date` и server-side replay store здесь нет. При несовпадении hash helper пишет expected/actual hash в лог. Эти свойства не следует описывать как полную защиту от replay.

## Переменные и разные секреты

| Имя | Назначение |
| --- | --- |
| `TELEGRAM_BOT_TOKEN` | Серверный credential выбранного бота: Widget HMAC, исходящие сообщения и Bot API. Не публикуется как `NEXT_PUBLIC_*` |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` | Публичное имя того же бота, без `@`; компонент Widget и mobile start имеют fallback `kezek_auth_bot`, но для отдельной среды имя нужно задать явно |
| `TELEGRAM_WEBHOOK_SECRET` | Значение `secret_token` при регистрации webhook; входящий header `X-Telegram-Bot-Api-Secret-Token` сравнивается сервером. Это не bot token и не секрет mobile confirm |
| `TELEGRAM_MOBILE_BOT_SECRET` | Отдельный shared secret для mobile confirm/callback. HTTP-ветки требуют его и HMAC запроса; webhook вызывает callback service внутри сервера с этим secret |
| `NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED` | Только точное `true` включает web bot login |
| `NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED` | Только точное `true` включает bot profile link |
| `MOBILE_TELEGRAM_DEEPLINK_AUTH` | Server mobile flag; fallback `NEXT_PUBLIC_MOBILE_TELEGRAM_DEEPLINK_AUTH`; кодовый default `true` |
| `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT` | Доля запросов mobile start, 0–100; остальные mobile routes проверяют общий flag. Невалидное/пустое значение процента не ограничивает rollout |
| `LOCAL_AUTH_PUBLIC_ORIGIN` | Только вне production: public HTTPS origin для локального reverse proxy; fallback `YANDEX_OAUTH_PUBLIC_ORIGIN`. Не путь callback и не настройка Telegram |

Источник flag semantics — [featureFlags.ts](apps/web/src/lib/featureFlags.ts); origin — [localAuthPublicOrigin.ts](apps/web/src/lib/localAuthPublicOrigin.ts). Public flags не доказывают состояние deployment и не выключают автоматически legacy Widget или mobile-exchange. Ротация bot token требует согласовать server runtime с выбранным ботом; часть consumers читает token при загрузке модуля.

## Binding browser flow и webhook

[Web login HTTP](apps/web/src/lib/telegramWebLoginHttpService.ts) требует HTTPS origin и точного совпадения `Origin`. Create сохраняет hashes token/browser-secret и ставит cookie `__Host-kezek-telegram-login`: Secure, HttpOnly, SameSite=Strict, Path=/, Max-Age=300. Status/finish требуют token и cookie того же браузера. Finish потребляет попытку, создаёт Supabase session через generateLink/verifyOtp и очищает attempt-cookie; ошибка после consume требует новой попытки.

[Profile link HTTP](apps/web/src/lib/telegramProfileLinkHttpService.ts) требует текущего пользователя и совпадения Origin; attempt принадлежит owner ID. Проверки status/finish и конфликта привязки описаны в [API flow handbook](docs/api/CLIENT_AND_AUTH_FLOWS.md). Эти гарантии относятся к данным двум цепочкам, а не ко всем Telegram endpoints.

[Webhook HTTP](apps/web/src/lib/telegramWebhookHttpService.ts) принимает POST на `/api/webhooks/telegram`. Без `TELEGRAM_WEBHOOK_SECRET` возвращает 503, с неверным header — 403. Обработка идёт сначала через profile link, затем web login, затем mobile `/start`/callback. Сервер может отправить или изменить реальное сообщение бота. Официальный [setWebhook](https://core.telegram.org/bots/api#setwebhook) принимает HTTPS URL и `secret_token`; регистрация webhook меняет внешнее состояние конкретного бота, это не read-only диагностика.

[Mobile request auth](apps/web/src/lib/telegramMobileBotRequestAuth.ts) отдельно проверяет `x-telegram-bot-secret`, timestamp, request ID и подпись `timestamp.requestId.rawBody`. Допустимое отклонение времени — 5 минут, replay-cache — 10 минут в памяти процесса. Его нельзя считать общим cache нескольких instances. Подробный wire contract — [CLIENT_AND_AUTH_FLOWS](docs/api/CLIENT_AND_AUTH_FLOWS.md).

## Что настройка не исправляет

- **Локальное исправление 2026-11-10:** mobile start требует codeChallenge, приложение хранит verifier, GET mobile-exchange отключён. Confirm не сбрасывает password; session создаётся после POST code + verifier. Нужны [миграция](supabase/migrations/20261109090000_bound_mobile_session_grants.sql) и новый клиент. Локальные tests и SQL race прошли; provider/runtime/deployment — NOT_RUN. [Контракт](docs/api/AUTH_AND_INTEGRATIONS.md). Legacy Widget password-reset остаётся отдельной открытой проблемой.
- Login/link и создание сессии включают несколько записей Auth/profile/attempt. Их нельзя считать единой транзакцией или подтверждённо идемпотентным процессом.
- Привязанный `profiles.telegram_id` — идентификатор пользователя, который notification sender использует как private-chat destination. Это не произвольный group chat ID. Успешная привязка не подтверждает доставку будущих сообщений; [правила уведомлений](NOTIFICATIONS_PREFERENCES.md) различаются по роли.
- `/api/notify/ping` отправляет email через Resend, не проверяет Telegram и не подходит для безопасного smoke. Настройка переменных и docs-check не являются runtime acceptance.

Для дальнейшей проверки необходима отдельная разрешённая тестовая среда с тестовым ботом и аккаунтами. Дублировать старые фрагменты handler/widget или применять SQL из прежней версии руководства не нужно: источником реализации остаются связанные файлы и migrations репозитория.
