# Telegram bot login с привязкой к браузеру

Статус: текущий протокол по исходникам, сверка 2026-11-01. Runtime, deployed schema, flags и provider configuration: `NOT_RUN` / не установлены этой сверкой. Владелец: authentication / operations.

Этот документ сохраняет протокол browser bot login. Старые сведения о сервере, tunnel URL, локальном flag и применении миграции относились к сессии сентября 2026 и не являются текущим состоянием окружения. Они не задают очередь работ или разрешение на повторный запуск — [WEB handoff](WEB_AGENT_HANDOFF.md).

Общий выбор Telegram flow и env — [Telegram implementation](../TELEGRAM_AUTH_IMPLEMENTATION.md). HTTP inputs/errors/limits — [CLIENT_AND_AUTH_FLOWS](api/CLIENT_AND_AUTH_FLOWS.md). Для отдельного разрешённого локального smoke — [LOCAL_TELEGRAM_TESTING](LOCAL_TELEGRAM_TESTING.md); deployment — [Operations](OPERATIONS.md).

## Назначение и включение

Flow входит в **существующий профиль с verified Telegram binding**. В этой цепочке нет создания нового пользователя, переназначения Telegram, reset password или изменения notification preferences. Если Telegram не связан, пользователь должен войти другим доступным способом и отдельно подключить его в профиле.

[HTTP handler](../apps/web/src/lib/telegramWebLoginHttpService.ts) включается только при `NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED === 'true'`; отсутствие/другое значение даёт 503. [SignInPageView](../apps/web/src/app/auth/sign-in/SignInPageView.tsx) при выключенном flag показывает legacy Widget. Это кодовое поведение, не подтверждение фактического production flag. Mobile auth и profile link сохраняют отдельные протоколы и gates.

Нужны `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` выбранного бота, `TELEGRAM_BOT_TOKEN` для сообщений, `TELEGRAM_WEBHOOK_SECRET` для входящего webhook, согласованный HTTPS origin и необходимые server Supabase settings. Для этого bot flow `/setdomain` legacy Widget не участвует; корректный webhook нужен. `TELEGRAM_MOBILE_BOT_SECRET` относится к другой, mobile-ветке.

## Протокол

[Route](../apps/web/src/app/api/auth/telegram/web-login/route.ts) экспортирует POST `/api/auth/telegram/web-login`; [service](../apps/web/src/lib/telegramWebLoginService.ts) хранит attempts; [webhook service](../apps/web/src/lib/telegramWebLoginWebhookService.ts) принимает решения бота.

1. Browser вызывает `create` с точным `Origin`, совпадающим с public HTTPS origin. Create/finish отклоняют уже вошедшего пользователя.
2. Create генерирует независимые token и browser secret по 24 случайных байта, сохраняет SHA-256 hashes. Ответ содержит token, ISO expiresAt, code для сравнения и botDeepLink. Browser secret сохраняется в `__Host-kezek-telegram-login`: Secure, HttpOnly, SameSite=Strict, Path=/, Max-Age=300; в JSON/боту он не передаётся.
3. Bot payload `kw1_...` и callback `kw1:ok/no:...` отделены от profile-link/mobile prefixes. [Общий webhook](../apps/web/src/lib/telegramWebhookHttpService.ts) сначала проверяет secret header. Web-login handler принимает только private chat с `chat.id === actor.id` и положительным safe integer actor ID.
4. Первый Telegram actor занимает attempt; другой actor не может подтвердить её. Бот показывает код сравнения и предупреждение подтверждать только самостоятельно начатый вход. Code — визуальная подсказка, не credential для входа.
5. Status требует исходные browser cookie и token. Telegram account раскрывается только для approved attempt; затем исходный браузер передаёт `finish` и подтверждённый `telegramId`.
6. [SQL transition](../supabase/migrations/20260917130000_telegram_web_login_attempts.sql) блокирует строку `FOR UPDATE`, проверяет browser hash, actor, статус, TTL и актуальную verified связь в `profiles`. После успешного finish помечает attempt consumed и возвращает user ID. Повторный finish закрытой attempt отклоняется.
7. HTTP service получает Auth user, вызывает `generateLink` и `verifyOtp`, проверяет совпадение user ID, затем прикрепляет cookies сессии к ответу. `generateLink` в этом пути не отправляет email. JSON возвращает `{ok:true,data:{status:"signed_in"}}`, не session tokens. Cookie attempt очищается.

Срок attempt — **5 минут**. Новое create заменяет browser-cookie: доступ к прежним attempts из других вкладок этого браузера теряется. Cancel завершает attempt раньше. HTTP ответы handler используют `Cache-Control: no-store` и `Referrer-Policy: no-referrer`.

## Границы SQL и сессии

В migration source таблица `telegram_web_login_attempts` имеет RLS, отозванные права public/anon/authenticated и доступ service role; transition RPC доступен service role. Поиск migrations при этой сверке не нашёл последующего определения этой функции. Наличие файла не подтверждает применённую схему или фактические grants удалённой базы.

Атомарность относится к **SQL consumption одной attempt**. Выпуск Supabase session идёт после consumption отдельными вызовами. Если target/email/link/verify недоступны или ответ потерян, consumed attempt не возвращается в pending; нужен новый flow, а не повторная выдача session по старой attempt. Это не общая транзакция Auth и Postgres.

Описание browser binding не переносится на [mobile-exchange](api/AUTH_AND_INTEGRATIONS.md), где остаётся отдельный OPEN risk. Подключение нового bot flow также не выключает legacy endpoints автоматически — [Engineering findings](ENGINEERING_FINDINGS.md).

## Что проверить для разрешённого rollout

До включения в конкретной среде требуется отдельно подтвердить schema/grants, согласованность bot identity/secret/origin, доступность webhook и существующий verified профиль. Полезные сценарии: связанный и несвязанный аккаунт, чужой Telegram actor, cancel в браузере/боте, expiry, повтор callbacks/finish, две вкладки, reload и ошибка session после consume. Эта сверка их **не выполняла**.

Migration содержит комментарий о service-role удалении attempts с `expires_at < now() - interval '1 day'`, но не устанавливает cron. Наличие cleanup в deployment нужно подтвердить отдельно по [Operations](OPERATIONS.md) и [Data retention](../DATA_RETENTION.md). Истечение TTL само по себе не удаляет все старые строки.

В репозитории есть [DB test script](../scripts/test-telegram-web-login-db.mjs) и связанные HTTP/webhook/component tests. Их наличие не является результатом выполнения; выбранные проверки запускают по новой разрешённой задаче и [CONTRIBUTING](../CONTRIBUTING.md), без возобновления исторической кампании.
