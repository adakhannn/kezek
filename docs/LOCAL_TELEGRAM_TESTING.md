# Локальная проверка Telegram

Статус: руководство для отдельной разрешённой проверки. Сверка исходников и официальных ссылок: 2026-11-01; запуск сервера, туннеля, provider actions и runtime-проверки: `NOT_RUN`. Владелец: authentication / QA. Закрытая WEB-кампания этим документом не возобновляется — [handoff](WEB_AGENT_HANDOFF.md).

Сначала выберите flow в [Telegram implementation](../TELEGRAM_AUTH_IMPLEMENTATION.md). Widget, web bot login, profile link и mobile auth используют разные привязки и секреты. Контракты: [CLIENT_AND_AUTH_FLOWS](api/CLIENT_AND_AUTH_FLOWS.md) и [AUTH_AND_INTEGRATIONS](api/AUTH_AND_INTEGRATIONS.md); общая среда: [Operations](OPERATIONS.md).

## Подготовка тестовой среды

1. Для разрешённой проверки используйте отдельного тестового бота и тестовые аккаунты. Не переназначайте production-боту домен или webhook. Туннель открывает доступ к локальному приложению извне: перед запуском должны быть определены допустимая среда и доступные в ней данные.
2. Подготовьте закрытый локальный конфиг по [telegram-test.env.example](../apps/web/telegram-test.env.example), стандартный путь — `apps/web/telegram-test.env.local`. Не добавляйте заполненный файл, token, OTP, cookies или session в Git/отчёт. Реальные значения не нужны для чтения этого руководства.
3. Задайте `TELEGRAM_BOT_TOKEN` и `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME` одного тестового бота; username без `@`. Для bot flow нужны также `TELEGRAM_WEBHOOK_SECRET` и соответствующий public flag. В шаблоне login flag равен `false`, а link flag отсутствует: для выбранной bot-ветки его нужно задать явно, не считать включённым по умолчанию.
4. Используйте установленный `cloudflared`, если выбран Cloudflare Quick Tunnel. Официальная команда — `cloudflared tunnel --url http://localhost:3000`; прежняя команда через `npx wrangler tunnel quick-start` не соответствует этому руководству. Замените порт, если Next использует другой. Команда создаёт внешнее подключение и выполняется только в рамках разрешённого запуска. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) описывает временный hostname и отсутствие uptime guarantee.
5. Сохраните полученный HTTPS origin в `PUBLIC_TUNNEL_URL` без path/query/fragment. Для legacy Widget свяжите hostname с **тестовым** ботом через BotFather `/setdomain`, как описано в [официальном legacy Widget guide](https://core.telegram.org/widgets/login-legacy). Домен Widget и адрес webhook — две отдельные настройки.

Quick Tunnel публичен для знающих URL и прекращает работу при остановке процесса. Интерактивный interstitial/access challenge перед webhook может помешать Telegram доставить POST; не обходите защиту существующей среды ради проверки. При смене hostname потребуются новые origin/bot bindings и новый вход в браузере.

## Что именно делают скрипты репозитория

| Скрипт | Поведение и ограничения |
| --- | --- |
| [start-telegram-local-test.ps1](../scripts/start-telegram-local-test.ps1) | Читает локальный config, валидирует формат token/username, экспортирует token, username, webhook secret и два web bot flags. При `PUBLIC_TUNNEL_URL` устанавливает `LOCAL_AUTH_PUBLIC_ORIGIN`. Затем запускает локальный `next.cmd dev --turbopack` из `apps/web`. Не устанавливает зависимости, не создаёт туннель, не настраивает BotFather/webhook |
| [configure-telegram-test-webhook.ps1](../scripts/configure-telegram-test-webhook.ps1) | Требует token, username, webhook secret и public tunnel URL. **Делает внешний POST `setWebhook`**, назначая `https://<tunnel-host>/api/webhooks/telegram` и `secret_token`. Меняет webhook выбранного бота; не является read-only проверкой и не выполняется для Widget-only сценария |

Оба скрипта принимают `-ConfigPath`; default описан выше. Для разрешённого запуска сервера команда из корня репозитория:

```powershell
.\scripts\start-telegram-local-test.ps1
```

Регистрацию webhook выполняют отдельно, только когда выбран bot flow и проверено, что config относится к тестовому боту. Семантика `setWebhook`, ограничения `secret_token` и конфликт webhook с `getUpdates` — в [Telegram Bot API](https://core.telegram.org/bots/api#setwebhook). Здесь нет команды автоматического переключения рабочего бота.

Скрипт запуска **не экспортирует произвольные ключи** из config. В частности, он не переносит `TELEGRAM_MOBILE_BOT_SECRET`, `MOBILE_TELEGRAM_DEEPLINK_AUTH` или rollout percent. Для mobile-ветки эти server settings нужны отдельно в разрешённой конфигурации процесса. `TELEGRAM_WEBHOOK_SECRET` проверяет входящий Telegram header, а `TELEGRAM_MOBILE_BOT_SECRET` используется mobile callback service; они не взаимозаменяемы. Общая Supabase-конфигурация также должна уже соответствовать тестовой среде.

## Как оценивать результат

- Откройте приложение через тот же HTTPS origin, который указан в config. [Origin resolver](../apps/web/src/lib/localAuthPublicOrigin.ts) использует override только вне production; web bot login дополнительно требует HTTPS и browser-cookie.
- Widget-only: callback проверяется HMAC в `/api/auth/telegram/login` или `/link`, webhook не требуется. Не передавайте данные новой OIDC library этому legacy endpoint — [различия](../TELEGRAM_AUTH_IMPLEMENTATION.md).
- Bot web login/profile link: настройка webhook, переход в тестового бота, подтверждение и возврат в исходный браузер нужны целиком. Попытка действует 5 минут; наличие сообщения в боте ещё не доказывает завершённую web session или сохранённую привязку.
- Mobile: attempt действует 5 минут, а exchange-code — 2 минуты. После локального исправления 2026-11-10 start требует SHA256 challenge, exchange — сохранённый verifier; GET discovery отключён. [Integration handbook](api/AUTH_AND_INTEGRATIONS.md) описывает новую миграцию и совместимый клиент. Локальные tests/SQL race не заменяют отдельную provider/build проверку и не разрешают rollout.
- Ошибки 403 проверяйте по Origin и соответствию webhook secret; 503 — по flag/config; истёкшую или потреблённую attempt заменяют новой через UI. Не исправляйте эти ошибки подстановкой cookies, обходом auth или повторным использованием чужих кодов.

В отчёт входят среда, выбранный flow, время, шаг и обезличенный статус ошибки. Реальные сообщения, коды, токены и raw callback payload не требуются. После разрешённого smoke завершите локальные процессы и отдельно согласуйте судьбу webhook тестового бота: остановка туннеля сама не удаляет webhook в Telegram.

Google/Yandex callbacks не настраиваются по этому Telegram guide. Их отдельные параметры описаны в [auth flow handbook](api/CLIENT_AND_AUTH_FLOWS.md); wildcard production redirect не является частью локального Telegram сценария.
