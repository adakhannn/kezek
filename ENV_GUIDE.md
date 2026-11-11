# Переменные окружения Kezek

Статус: справочник конфигурации, уточнён 10 ноября 2026. Сопровождение: разработка и эксплуатация. Значения реальных окружений здесь не хранятся.

Подготовка среды описана в [GETTING_STARTED.md](GETTING_STARTED.md), факты deployment и секретов — в [OPERATIONS.md](docs/OPERATIONS.md). Этот справочник содержит ключевые имена; полный набор конкретной функции проверяют по коду её потребителей. Шаблоны `apps/web/.env.example` и `apps/mobile/.env.example` помогают заполнить конфигурацию, но их наличие не доказывает полноту или правильность среды.

## Правила

- Web использует `apps/web/.env.local`, mobile — `apps/mobile/.env.local`. При подготовке новой среды создавать файл только при его отсутствии; существующий не перезаписывать шаблоном.
- `NEXT_PUBLIC_*` и `EXPO_PUBLIC_*` доступны клиентскому приложению. Service role, provider tokens, cron secrets и приватные ключи туда помещать нельзя.
- Dev, staging и production имеют разные значения и доступы. Локальный сервер с production-ключами работает с реальными данными.
- Секреты передавать через согласованное хранилище; не печатать в логах, документах, issue или командах с раскрывающимися значениями.
- Проверять имя, наличие, предназначение и среду переменной без публикации значения. Изменение deployment-конфигурации и перезапуск следуют из отдельной задачи.

## Web

Основные server helpers: [env.ts](apps/web/src/lib/env.ts). Browser client читает публичные настройки непосредственно: [supabaseClient.ts](apps/web/src/lib/supabaseClient.ts). Дополнительные потребители могут читать `process.env` без этого helper.

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
| Sentry и health alert settings | Телеметрия и оповещения | [MONITORING_AND_ALERTS](MONITORING_AND_ALERTS.md), [PERFORMANCE_MONITORING](PERFORMANCE_MONITORING.md) |
| Telegram, Yandex OAuth и feature flags | Зависит от конкретного auth/notification flow | Тематические документы ниже и текущий код; не переносить старые значения между окружениями |

Внешние отправки и auth callbacks проверяются только для разрешённого сценария и получателей. Пустая или недействительная конфигурация не является полноценной изоляцией интеграций.

## Mobile

Потребители: [supabase.ts](apps/mobile/src/lib/supabase.ts), [apiUrl.ts](apps/mobile/src/lib/apiUrl.ts).

| Имя | Назначение |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | URL согласованного Supabase-проекта |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Публичный ключ того же проекта |
| `EXPO_PUBLIC_API_URL` | Разрешённый web API, доступный устройству/эмулятору |
| `EXPO_PUBLIC_APP_ENV` | Учитывается resolver при определении non-production режима |

Код допускает значения из `expo.extra`; они также попадают в приложение и не подходят для серверных секретов. Non-production resolver требует API URL. В некоторых других ветках, включая `NODE_ENV=test`, код имеет fallback на production URL — поэтому для изолированной проверки следует явно задать URL и контролировать/mock network. Это описание текущего кода, а не рекомендация выполнять тесты против production.

На телефоне `localhost` означает сам телефон. Адрес или tunnel выбирается для согласованного стенда. При диагностике загрузки env проверять путь, имя и наличие настройки; не публиковать сессию или значения ключей. Перезапуск bundler и очистка кэша применяются к конкретной разрешённой dev-сессии, а не как автоматический шаг по старому руководству.

## CI и хостинг

Фактические имена CI secrets задаёт [.github/workflows/ci.yml](.github/workflows/ci.yml); требования E2E fixtures — [Playwright reference](apps/web/e2e/README.md). Наличие имени в workflow не доказывает, что secret установлен. Нельзя делать одинаковыми production и test credentials ради успешного job.

При добавлении переменной обновляют потребителя, шаблон и тематический документ, указывая публичность, обязательность, default/fallback и эффект отсутствия. Перечень в этом файле не следует выдавать за автоматически сгенерированный контракт.

## Тематические ссылки

- [WhatsApp setup](WHATSAPP_SETUP.md), [mobile provider setup](docs/MOBILE_WHATSAPP_PROVIDER_SETUP.md).
- [Telegram implementation](TELEGRAM_AUTH_IMPLEMENTATION.md), [web login](docs/TELEGRAM_WEB_LOGIN.md).
- [Mobile Google ADR](docs/MOBILE_GOOGLE_AUTH_ADR.md).
- [Текущее состояние](docs/PROJECT_STATUS.md), [индекс документации](docs/README.md).
