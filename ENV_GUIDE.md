# Переменные окружения Kezek

Статус: справочник конфигурации, уточнён 28 ноября 2026. Сопровождение: разработка и эксплуатация. Значения реальных окружений здесь не хранятся.

Подготовка среды описана в [GETTING_STARTED.md](GETTING_STARTED.md), факты deployment и секретов — в [OPERATIONS.md](docs/OPERATIONS.md). Этот справочник содержит ключевые имена; полный набор конкретной функции проверяют по коду её потребителей. Шаблоны `apps/web/.env.example` и `apps/mobile/.env.example` помогают заполнить конфигурацию, но их наличие не доказывает полноту или правильность среды.

## Правила

- Web использует `apps/web/.env.local`, mobile — `apps/mobile/.env.local`. При подготовке новой среды создавать файл только при его отсутствии; существующий не перезаписывать шаблоном.
- `NEXT_PUBLIC_*` и `EXPO_PUBLIC_*` доступны клиентскому приложению. Service role, provider tokens, cron secrets и приватные ключи туда помещать нельзя.
- Dev, staging и production имеют разные значения и доступы. Локальный сервер с production-ключами работает с реальными данными.
- Секреты передавать через согласованное хранилище; не печатать в логах, документах, issue или командах с раскрывающимися значениями.
- Проверять имя, наличие, предназначение и среду переменной без публикации значения. Изменение deployment-конфигурации и перезапуск следуют из отдельной задачи.

## Web

Полный перечень переменных, которые читает код web, с пометками «обязательно / обязательно в production / необязательно» — в [apps/web/.env.example](apps/web/.env.example) (сверено с кодом 28 ноября 2026; `NODE_ENV`, `NEXT_RUNTIME`, `CI` и `TZ` задаёт платформа). Основные server helpers: [env.ts](apps/web/src/lib/env.ts). Browser client читает публичные настройки непосредственно: [supabaseClient.ts](apps/web/src/lib/supabaseClient.ts). Дополнительные потребители могут читать `process.env` без этого helper.

| Имя или группа | Назначение | Граница |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | URL и публичный ключ одного согласованного Supabase-проекта | Клиентские значения; не заменяют RLS/ACL |
| `SUPABASE_SERVICE_ROLE_KEY` | Привилегированные server operations | Только сервер; helpers в [supabaseService](apps/web/src/lib/supabaseService.ts) и [supabaseHelpers](apps/web/src/lib/supabaseHelpers.ts) |
| `NEXT_PUBLIC_SITE_ORIGIN` | Origin приложения, ссылки и возвраты | Для локальной среды обычно `http://localhost:3000`; сверять callback allowlist отдельно |
| `NEXT_PUBLIC_TZ` | Часовой пояс приложения | Договорённости: [DATE_HANDLING_MODEL](docs/DATE_HANDLING_MODEL.md) |
| `RESEND_API_KEY`, `EMAIL_FROM` | Отправка email | Отсутствие email key не является проверенным dry-run для всей цепочки уведомлений |
| `RATE_LIMIT_TRUSTED_IP_HEADER` | Явный single-IP ingress header для limiter | Edge обязан удалять/перезаписывать клиентское значение; без подтверждённой policy production IP limits дают503. [Контракт](RATE_LIMITING.md) |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Redis limiter и performance aggregates | Limiter в production и performance reads требуют общий Redis; missing/error дают503. Performance export не отменяет business result. Детали: [RATE_LIMITING](RATE_LIMITING.md) |
| `CRON_SECRET`, `VERCEL_CRON_SECRET` | Секрет доступа cron с fallback в handlers | Все handlers отклоняют отсутствующий/некорректный secret до работы; автоматический заголовок Vercel требует `CRON_SECRET` и нового deployment после изменения: [CRON_SETUP](CRON_SETUP.md) |
| `BOOKING_NOTIFICATION_WORKER_ENABLED` | Активация отправки накопленного booking outbox | Только точное `true` включает worker. До этого cron возвращает `enabled:false`; события могут накапливаться. Миграции, провайдеры и получатели должны быть готовы до включения |
| `WHATSAPP_INBOX_WORKER_ENABLED` | Обработка сохранённых входящих WhatsApp-команд | Только точное `true` включает worker. Подписанный webhook сохраняет события и при выключенном worker; это не подтверждение обработки или отправки ответа |
| `NEXT_PUBLIC_YANDEX_MAPS_API_KEY` | Карты | Клиентский ключ, ограничения провайдера задаются отдельно |
| `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_OTP_HASH_SECRET` | WhatsApp integration и OTP | Приватные server settings; список templates зависит от сценария |
| `WHATSAPP_APP_SECRET` | Проверка HMAC-SHA256 подписи входящего WhatsApp POST webhook | С 2026-11-09 обязателен: без него POST возвращает 503. Это Meta app secret, отдельный от access/verify token; [контракт](docs/api/AUTH_AND_INTEGRATIONS.md#post-apiwebhookswhatsapp--подписанный-входящий-запрос) |
| `WHATSAPP_OTP_TEMPLATE_NAME`, `WHATSAPP_OTP_TEMPLATE_LANG`, `WHATSAPP_AUTH_TEMPLATE_NAME`, `WHATSAPP_AUTH_TEMPLATE_LANGUAGE` | Выбор шаблона и языка | Приоритеты/fallback сверять в `env.ts`; одобрение шаблона провайдером отдельно |
| `NEXT_PUBLIC_SENTRY_DSN` | Включает Sentry в браузере, на сервере и в edge | Публичный, встраивается при сборке: после изменения нужен новый деплой. Без него ничего не отправляется. Порядок включения — [MONITORING_AND_ALERTS](MONITORING_AND_ALERTS.md#ошибки-приложения-логи-vercel-и-sentry) |
| `SENTRY_ENVIRONMENT` | Метка окружения событий | Необязательно; по умолчанию `vercel-production`/`vercel-preview`, иначе NODE_ENV |
| `ANDROID_APP_LINK_SHA256_FINGERPRINTS` | Отпечатки SHA-256 ключа подписи Android-приложения для `/.well-known/assetlinks.json` (MOB-05) | Через запятую, формат `AB:CD:…` (32 байта; EAS: `eas credentials`). Пока не задано, файла нет и ссылки открываются в браузере |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Загрузка source maps при сборке | Только в сборке Vercel; токен — секрет, в CI и репозиторий не попадает |
| `ALERT_EMAIL_TO` | Получатель оповещений health check и сбоев cron | Без него (или без `EMAIL_FROM`) письмо-оповещение пропускается. [MONITORING_AND_ALERTS](MONITORING_AND_ALERTS.md), [PERFORMANCE_MONITORING](PERFORMANCE_MONITORING.md) |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Запасные имена Upstash из Vercel Marketplace | Читаются, только когда `UPSTASH_REDIS_REST_*` пусты |
| `EXPO_ACCESS_TOKEN` | Bearer-токен Expo Push API | Нужен, только если в проекте Expo включена enhanced push security |
| `WHATSAPP_GRAPH_API_VERSION` | Версия Graph API (например `v21.0`) | Необязательно; иначе версия по умолчанию из кода |
| `WHATSAPP_OTP_TEMPLATE_TYPE`, `WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON` | Стратегия OTP-шаблона (`utility` по умолчанию или `authentication`) и JSON его компонентов с `{{OTP_CODE}}` | `WHATSAPP_OTP_TEMPLATE_*` имеют приоритет над старыми `WHATSAPP_AUTH_TEMPLATE_*` |
| `WHATSAPP_BOOKING_{CONFIRMED,CANCELLED,REMINDER}_TEMPLATE_NAME`, `WHATSAPP_BOOKING_TEMPLATE_LANG`, `WHATSAPP_BOOKING_TEMPLATE_LANG_KY`, `WHATSAPP_BOOKING_TEMPLATE_LANG_EN` | Шаблоны уведомлений о записях и коды их переводов | Пустое имя — WhatsApp-сообщение этого вида не отправляется; e-mail и Telegram не зависят. Язык по умолчанию `ru`; ky/en — только после одобрения перевода |
| `WHATSAPP_{STAFF,BUSINESS,OWNER}_APPLICATION_*_TEMPLATE_NAME`, `WHATSAPP_APPLICATION_TEMPLATE_LANGUAGE`, `WHATSAPP_APPLICATION_NAMED_PARAMETERS` | Шаблоны уведомлений о заявках (владельцу/админу, заявителю, об одобрении), их язык и именованные параметры (JSON по типу) | Пустое имя — канал WhatsApp для этого типа не включён; без JSON — позиционные параметры |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` | Бот: уведомления, вход и привязка профиля; секрет входящего webhook | Только сервер. [TELEGRAM_AUTH_IMPLEMENTATION](TELEGRAM_AUTH_IMPLEMENTATION.md) |
| `TELEGRAM_MOBILE_BOT_SECRET` | Секрет callback-ов бота входа из мобильного приложения | Только сервер; нужен для входа через Telegram deep link |
| `NEXT_PUBLIC_TELEGRAM_BOT_USERNAME`, `NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED`, `NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED` | Имя бота для виджетов; показ входа и привязки через бота | Публичные; включается значением `true` |
| `MOBILE_WHATSAPP_AUTH`, `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT`, `MOBILE_TELEGRAM_DEEPLINK_AUTH`, `MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT` (и `NEXT_PUBLIC_MOBILE_*` как запасные) | Флаги и доля пользователей (0–100) для входа в приложение через WhatsApp и Telegram | [featureFlags.ts](apps/web/src/lib/featureFlags.ts) |
| `SCHEDULE_V2_ENABLED` | Явная модель расписания сотрудников | Только точное `true` |
| `LOCAL_AUTH_PUBLIC_ORIGIN` (старое имя `YANDEX_OAUTH_PUBLIC_ORIGIN`) | HTTPS-туннель для OAuth callback в разработке | Вне `NODE_ENV=production`; в production берётся origin запроса |
| `SMS_PROVIDER`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM`, `SMS_WEBHOOK_URL`, `SMS_WEBHOOK_TOKEN` | Старый SMS-отправитель (`twilio` по умолчанию или `webhook`) | Только сервер |
| `E2E_*`, `PLAYWRIGHT_TEST_BASE_URL` | Запуск Playwright и тестовые фикстуры | Только тестовая среда, обычно `apps/web/e2e/.e2e.env`: [Playwright reference](apps/web/e2e/README.md) |
| Yandex OAuth и прочие flows | Зависит от конкретного auth/notification flow | Тематические документы ниже и текущий код; не переносить старые значения между окружениями |

Внешние отправки и auth callbacks проверяются только для разрешённого сценария и получателей. Пустая или недействительная конфигурация не является полноценной изоляцией интеграций.

## Mobile

Потребители: [supabase.ts](apps/mobile/src/lib/supabase.ts), [apiUrl.ts](apps/mobile/src/lib/apiUrl.ts). Окружение сборки и адреса бэкенда задаёт [app.config.ts](apps/mobile/app.config.ts) (MOB-06). Прод по умолчанию получает только сборка профиля `production` (`EAS_BUILD_PROFILE` или `APP_ENV=production` из [eas.json](apps/mobile/eas.json)). Сборки `development` и `preview` и `expo start` берут адреса только из переменных ниже, обычно из `apps/mobile/.env.local` по [образцу](apps/mobile/.env.example). Без них приложение сразу сообщает, что окружение не задано, и не обращается к проду.

| Имя | Назначение |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL согласованного Supabase-проекта |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Публичный ключ того же проекта |
| `EXPO_PUBLIC_API_URL` | Разрешённый web API, доступный устройству/эмулятору |
| `EXPO_PUBLIC_APP_ENV` | Окружение сборки (`production`, `preview`, `development`); по умолчанию берётся из профиля EAS, без профиля — `development` |
| `EXPO_PUBLIC_SENTRY_DSN` | Включает отчёты о сбоях и ошибках приложения (MOB-07); без него и в development-сборке ничего не отправляется. Порядок включения — [MONITORING_AND_ALERTS](MONITORING_AND_ALERTS.md#ошибки-приложения-логи-vercel-и-sentry) |

`SENTRY_ORG` и `SENTRY_PROJECT` (переменные сборки EAS) включают плагин Sentry, который загружает source maps и отладочные символы; ему нужен и `SENTRY_AUTH_TOKEN` — секрет EAS, не в репозитории и не в CI. Без них сборка отправляет отчёты с DSN, но стек остаётся минифицированным.

Переменные попадают в приложение через `expo.extra` и не подходят для серверных секретов. Сборка не production требует и Supabase, и API URL. В некоторых других ветках, включая `NODE_ENV=test`, код имеет fallback на production URL — поэтому для изолированной проверки следует явно задать URL и контролировать/mock network. Это описание текущего кода, а не рекомендация выполнять тесты против production.

На телефоне `localhost` означает сам телефон. Адрес или tunnel выбирается для согласованного стенда. При диагностике загрузки env проверять путь, имя и наличие настройки; не публиковать сессию или значения ключей. Перезапуск bundler и очистка кэша применяются к конкретной разрешённой dev-сессии, а не как автоматический шаг по старому руководству.

## CI и хостинг

Фактические имена CI secrets задаёт [.github/workflows/ci.yml](.github/workflows/ci.yml); требования E2E fixtures — [Playwright reference](apps/web/e2e/README.md). Наличие имени в workflow не доказывает, что secret установлен. Нельзя делать одинаковыми production и test credentials ради успешного job.

При добавлении переменной обновляют потребителя, шаблон и тематический документ, указывая публичность, обязательность, default/fallback и эффект отсутствия. Перечень в этом файле не следует выдавать за автоматически сгенерированный контракт.

## Тематические ссылки

- [WhatsApp setup](WHATSAPP_SETUP.md), [mobile provider setup](docs/MOBILE_WHATSAPP_PROVIDER_SETUP.md).
- [Telegram implementation](TELEGRAM_AUTH_IMPLEMENTATION.md), [web login](docs/TELEGRAM_WEB_LOGIN.md).
- [Mobile Google ADR](docs/MOBILE_GOOGLE_AUTH_ADR.md).
- [Текущее состояние](docs/PROJECT_STATUS.md), [индекс документации](docs/README.md).
