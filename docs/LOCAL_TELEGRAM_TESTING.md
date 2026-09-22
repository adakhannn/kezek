# Локальное тестирование Telegram

Обычный `localhost` Telegram Login Widget не принимает. Для теста используется отдельный бот и временный публичный HTTPS-туннель. Production-бот и его webhook не меняются.

## Один раз

1. В `@BotFather` создайте отдельного бота, например `Kezek Local Test`.
2. Сохраните username и токен этого бота.
3. Скопируйте `apps/web/telegram-test.env.example` в `apps/web/telegram-test.env.local` и заполните токен и username тестового бота. Файл исключён из Git. Не отправляйте токен в чат.

## На каждую тестовую сессию

1. Запустите `scripts/start-telegram-local-test.ps1`: скрипт подставит тестового бота только в этот локальный процесс Kezek; обычный `.env.local` не меняется.
2. Откройте HTTPS-туннель до порта `3000`: `npx wrangler tunnel quick-start http://localhost:3000`. Cloudflare выдаст временный адрес вида `https://...trycloudflare.com`. Оставьте окно туннеля работающим. `localtunnel` для входа не используйте: он показывает промежуточную страницу с запросом IP. Если также проверяете вход через Яндекс, запишите этот адрес в `PUBLIC_TUNNEL_URL` файла `telegram-test.env.local` и перезапустите локальный Kezek тем же скриптом.
3. В `@BotFather` у тестового бота выполните `/setdomain` и укажите домен туннеля без `https://`.
4. Откройте адрес туннеля, а не `localhost`, и проверьте вход и привязку Telegram в профиле.

Для входа через Telegram Login Widget webhook не нужен. Если также тестируете мобильный вход через бота и уведомления, дополнительно задайте в `telegram-test.env.local` длинный случайный `TELEGRAM_WEBHOOK_SECRET` и `PUBLIC_TUNNEL_URL`, затем выполните `scripts/configure-telegram-test-webhook.ps1`. Не используйте для этого production-токен.

Для локального входа через Яндекс в отдельном тестовом Яндекс OAuth-приложении должен быть зарегистрирован точный Redirect URI `https://<домен-туннеля>/auth/callback-yandex`. Его `YANDEX_OAUTH_CLIENT_ID` и `YANDEX_OAUTH_CLIENT_SECRET` запишите в `telegram-test.env.local`: скрипт подставит их только в локальный процесс. Не добавляйте временный адрес туннеля в production OAuth-приложение и не меняйте рабочие ключи в основном `.env.local`.

Для входа через Google по тому же туннелю добавьте `https://<домен-туннеля>/auth/callback/google*` в Supabase Authentication → URL Configuration → Redirect URLs. Скрипт использует `PUBLIC_TUNNEL_URL`, чтобы после ответа Google локальный Kezek вернул браузер на HTTPS-туннель, а не на внутренний `localhost`.

Туннельные адреса обычно меняются после перезапуска. В этом случае повторите `/setdomain` с новым доменом, обновите `PUBLIC_TUNNEL_URL` и **замените** прежний Redirect URI тестового Яндекс-приложения новым. Старый временный адрес не оставляйте в настройках. Рабочие Telegram-бот и Яндекс-приложение для этой процедуры не используются.
