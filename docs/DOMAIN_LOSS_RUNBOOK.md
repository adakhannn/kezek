# Потеря домена kezek.kg: что сделано и что осталось владельцу

Актуализировано: 2026-11-17. Аудитория: владелец проекта и эксплуатация. Статус: код, переменные Vercel и Supabase Auth переведены на `https://kezek.vercel.app`; кабинеты Telegram, Meta и Yandex меняет владелец.

## Что произошло

`kezek.kg` перешёл к третьему лицу. Зона домена переписана 12 ноября 2026 (SOA serial `2026111201`): A-записи нет, `www` не существует, Vercel помечает домен как misconfigured. Сейчас домен никуда не ведёт, но новый владелец может направить его на свой сервер в любой момент. Всё, что проект отправляет на `kezek.kg`, тогда попадёт к нему.

## Что уже сделано (17 ноября)

| Где | Было | Стало |
| --- | --- | --- |
| Частые cron-задания | workflow GitHub по умолчанию слал `CRON_SECRET` на `https://kezek.kg` (ни разу не запустился) | workflow удалён; задания вызывает [pg_cron из Supabase](../CRON_SETUP.md) на адрес из Vault (`kezek_cron_origin`), `CRON_SECRET` ротирован |
| Supabase Auth | Site URL `https://kezek.kg/`, redirect на `kezek.kg`, `localhost` и временный `trycloudflare` | Site URL `https://kezek.vercel.app`; redirect: `kezek://auth/callback`, `https://kezek.vercel.app/**`, `http://localhost:3000/**`. Остальные настройки Auth не тронуты |
| Уведомления о бронях | `vercel.app` подменялся на `kezek.kg` во всех ссылках | ссылки строятся от `NEXT_PUBLIC_SITE_ORIGIN` |
| Алерты health-check | запасной адресат `EMAIL_FROM` или `admin@kezek.kg` | только явный `ALERT_EMAIL_TO`, иначе письмо не отправляется |
| Мобильное приложение | API, deep links и вход в веб-кабинет с access/refresh token в URL шли на `kezek.kg` | `kezek.vercel.app`; веб-кабинет открывается одноразовым кодом ([handoff](api/AUTH_AND_INTEGRATIONS.md)) |
| Vercel env | `NEXT_PUBLIC_SITE_ORIGIN=https://kezek.kg` | `https://kezek.vercel.app` (production, preview, development) |
| SEO | sitemap с `http://localhost:3000`, hreflang на `kezek.app`, относительный sitemap в robots | всё от `NEXT_PUBLIC_SITE_ORIGIN` |

Пользователей с email на `kezek.kg` (включая служебный `whatsapp.kezek.kg`) в проде нет, так что перехват сброса пароля через почту домена невозможен (проверено запросом к `auth.users` 17 ноября, только агрегаты).

## Что должен сделать владелец (по убыванию срочности)

1. ~~**Supabase → Authentication → URL Configuration.**~~ Сделано 17 ноября по согласованию (`supabase config push` с объявленными только `site_url` и `additional_redirect_urls`; diff после применения пуст). Прежние значения: Site URL `https://kezek.kg/`; redirect `kezek://auth/callback`, `https://kezek.kg/auth/callback-mobile`, `https://kezek.kg/auth/callback-yandex`, `http://localhost:3000/auth/callback/google`, `http://localhost:3000/**`, `http://localhost:3000/auth/callback-yandex`, `https://fotos-clearing-cuisine-owns.trycloudflare.com/auth/callback/google*`. Если `CRON_SECRET` был сохранён и в секретах GitHub, его можно удалить: workflow больше нет.
2. **Telegram.** В @BotFather для бота `kezek_auth_bot` выполнить `/setdomain` → `kezek.vercel.app`; иначе виджет входа на новом адресе не работает, а на `kezek.kg` выдавал бы подписанные данные входа чужому сайту. Если у бота задан webhook на `kezek.kg`, перенастроить на `https://kezek.vercel.app/api/webhooks/telegram` (секрет тот же `TELEGRAM_WEBHOOK_SECRET`).
3. **Meta (WhatsApp Cloud API).** Callback URL вебхука → `https://kezek.vercel.app/api/webhooks/whatsapp`; иначе входящие сообщения клиентов (номера и текст) пойдут на `kezek.kg`. Заодно добавить в Vercel `WHATSAPP_APP_SECRET` (без него вебхук отвечает 503).
4. **Yandex OAuth** (oauth.yandex.ru): добавить Redirect URI `https://kezek.vercel.app/auth/callback-yandex`, старый удалить.
5. **Google Cloud Console** (если используется One Tap / JavaScript origins): добавить `https://kezek.vercel.app`, убрать `kezek.kg`. Redirect URI Supabase (`…supabase.co/auth/v1/callback`) не меняется.
6. **Vercel → Project → Domains:** удалить `kezek.kg` из проекта.
7. **Мобильное приложение:** собрать и раздать новую сборку. В уже установленных сборках API зашит на `kezek.kg`: они не работают и, если домен оживёт, будут отправлять туда bearer-токены. OTA (expo-updates) в проекте не настроен, поэтому старые сборки нужно удалить с устройств.
8. **Почта.** `EMAIL_FROM=noreply@mail.kezek.kg` использует потерянный домен: DNS-записи DKIM/SPF исчезли, письма будут отклоняться или попадать в спам. Для писем нужен свой домен с записями Resend; `kezek.vercel.app` для почты не подходит.
9. **Сессии (по желанию).** В браузерах, где входили на `kezek.kg`, остались cookie и localStorage этого origin; если новый владелец поднимет сайт, он сможет их прочитать при визите. Живых сессий в проде 4. Отозвать все можно одним SQL `delete from auth.sessions;`: все пользователи выйдут.

## Переход на новый домен

Когда появится собственный домен (рекомендуется с автопродлением и 2FA у регистратора):

1. Vercel → Domains: добавить домен и DNS-записи, которые покажет Vercel.
2. Vercel env: `NEXT_PUBLIC_SITE_ORIGIN=https://<домен>`, затем redeploy (значение встраивается при сборке).
3. Повторить пункты 1–5 выше с новым доменом (Supabase Auth — тем же `supabase config push`) и обновить Vault-секрет `kezek_cron_origin` на `https://<домен>` ([CRON_SETUP](../CRON_SETUP.md)).
4. Mobile: `PROD_API_URL` в [apiUrl.ts](../apps/mobile/src/lib/apiUrl.ts), `extra.apiUrl` и Android intent filter в [app.json](../apps/mobile/app.json), prefixes в [linking.ts](../apps/mobile/src/navigation/linking.ts); новая сборка.
5. Resend: подтвердить домен для почты и сменить `EMAIL_FROM`.

В коде публичный адрес задаётся одной переменной через [siteOrigin.ts](../apps/web/src/lib/siteOrigin.ts); `kezek.kg` остаётся только в UID календарных событий (непрозрачный идентификатор, смена дублировала бы события у пользователей).
