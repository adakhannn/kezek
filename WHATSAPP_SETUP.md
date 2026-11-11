# WhatsApp: конфигурация текущих интеграций

## Durable inbox: изменение 2026-11-10

[HTTP контракт и worker](docs/api/AUTH_AND_INTEGRATIONS.md#post-apiwebhookswhatsapp--подписанный-входящий-запрос), [миграция](supabase/migrations/20261110124000_whatsapp_inbox.sql). Сначала требуется защищённая граница booking commands из миграции 123000, затем inbox schema. Без схемы новый webhook возвращает 503; миграции сами не включают отправку. Receiver в подписанном callback должен совпадать с `WHATSAPP_PHONE_NUMBER_ID`. Только точное `WHATSAPP_INBOX_WORKER_ENABLED=true` включает обработку; activation — отдельное эксплуатационное действие.

До включения worker необходимо завершить старые webhook requests и убрать все старые handlers из serving deployment: смешанный rollout старого синхронного обработчика и нового worker не является безопасным режимом. Новый claim/process повторно обнаруживает legacy IDs, однако он не может координировать будущую запись старого бинарника. Reply list сохраняет service/staff/branch/address и использует business timezone; отсутствие tz даёт Asia/Bishkek, некорректная непустая или пустая настройка требует исправления, а не замены часового пояса.

Выключенный worker сохраняет новые сообщения, но не отвечает и не меняет bookings. При возобновлении сообщения старше 24 часов становятся `expired` и не выполняются задним числом. Legacy строки `whatsapp_messages`, включая `processed=false`, получают `legacy_manual`: этот флаг не доказывает отсутствие уже выполненной команды или отправленного ответа.

Оператор проверяет возраст pending/processing, attempts и last_error_code, отдельно `failed`, `ambiguous`, `expired`, `legacy_manual`. Command receipt показывает зафиксированный исход операции; `sent` означает принятый provider response и сохранённый provider ID, не доставку адресату. `ambiguous` означает, что отправка могла состояться. Нельзя просто вернуть строку в pending: сначала сверяются команда, booking/outbox и provider history. Административного replay API нет. Ответ на команду и booking notification имеют разные receipts и могут создать два разных сообщения.

Service-only `whatsapp_inbox_backlog_health()` возвращает точные `pending,due,processing,failed,ambiguous,oldest_due_age_seconds`. Due учитывает availability/истёкший lease, attempts, отсутствие начатой отправки, 24-часовой срок и legacy quarantine. Возраст due считается с момента eligibility (availability либо expiry lease), а не всегда с создания сообщения. Failed включает manual/expired и уже неисполнимые незавершённые строки; ambiguous может пересекаться с failed. Нулевой due не доказывает отсутствие ошибок.

После 30 дней sender/text/command/reply/provider ID становятся eligible для bounded pruning; компактный tombstone receiver/message ID/hash/timestamp сохраняется против повторов. Ежедневный retention вызывает cleanup независимо от enabled flag worker, максимум 100 строк за вызов; backlog требует контроля. Старая `whatsapp_messages` этим не очищается. Новый worker не пишет raw текст/телефон в application logs. Локальные synthetic tests не подтверждают Meta callback, provider delivery или deployment.

Статус: текущий справочник потребителей конфигурации в репозитории. Статическая сверка: 2026-11-01; runtime/provider checks: `NOT_RUN`. Владелец: backend / operations. Наличие кода не подтверждает настройку Meta, одобрение шаблонов или доставку.

Контракты запросов: [auth flows](docs/api/CLIENT_AND_AUTH_FLOWS.md), [привязка и webhook](docs/api/AUTH_AND_INTEGRATIONS.md). Развёртывание и неизвестные параметры среды: [Operations](docs/OPERATIONS.md). Открытые дефекты: [Engineering findings](docs/ENGINEERING_FINDINGS.md).

## Выбрать сценарий до настройки

| Сценарий | Реализация и состояние |
| --- | --- |
| Привязка номера вошедшему пользователю | `/api/whatsapp/send-otp` и `/api/whatsapp/verify-otp`; cookie session обязательна. Шестизначный код хранится в metadata, срок 10 минут. Отправка требует настроенного OTP-шаблона; подтверждение меняет профиль, сессию не создаёт |
| Снятый с поддержки web-протокол | `/api/auth/whatsapp/send-otp`, `/verify-otp`, `/create-session` возвращают 410 `auth_protocol_retired`; не вызывают Auth, БД или провайдера. Старые внешние клиенты требуют обновления |
| Web/mobile OTP | `/api/auth/whatsapp/mobile/start` принимает S256 challenge; `/verify` проверяет и атомарно погашает OTP. Срок попытки 5 минут. Выдаётся одноразовый exchange-code, привязанный к verifier инициатора; сессия выпускается сервером только после обмена. Новые SQL миграции обязательны |
| Брони | [WhatsAppNotificationService](apps/web/src/lib/notifications/WhatsAppNotificationService.ts) отправляет текст. Это не OTP-шаблон. Правила выбора получателей различаются по ролям — см. [предпочтения](NOTIFICATIONS_PREFERENCES.md) |
| Заявки и согласования | Отдельные шаблоны из `getWhatsAppTemplateName`; это другая политика отправки, не booking orchestrator |
| Входящие сообщения | `/api/webhooks/whatsapp`: GET проверяет verification token; POST проверяет HMAC/receiver и сохраняет inbox. Отдельный cron worker исполняет команды. Проверка GET не защищает POST |

Сроки действующих протоколов подтверждены [profile OTP](apps/web/src/lib/whatsAppSendOtpService.ts) и [mobile start](apps/web/src/lib/whatsAppMobileStartRouteService.ts). Legacy auth больше не создаёт OTP: [ответ retirement](apps/web/src/lib/retiredWhatsAppAuth.ts).

## Переменные сервера

Имена и fallback сверены по [env.ts](apps/web/src/lib/env.ts), [sender](apps/web/src/lib/senders/whatsapp.ts) и [Graph API resolver](apps/web/src/lib/whatsAppGraphApi.ts). Значения хранятся в конфигурации выбранной среды, не в документации.

| Имя | Потребитель и смысл |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Bearer credential исходящих запросов к Graph API; нужен вместе с phone number ID |
| `WHATSAPP_PHONE_NUMBER_ID` | Идентификатор отправляющего номера в пути `/{id}/messages`; не номер телефона получателя и не WABA ID |
| `WHATSAPP_GRAPH_API_VERSION` | Строка вида `vNN.N`; пустое или неподходящее значение даёт **кодовый fallback `v21.0`**. Это не заявление о текущей поддерживаемой версии Meta |
| `WHATSAPP_VERIFY_TOKEN` | Сопоставляется с `hub.verify_token` только при GET handshake. В коде есть фиксированный fallback; для среды требуется собственное значение. Это не access token и не проверка подписи POST |
| `WHATSAPP_APP_SECRET` | Meta app secret для HMAC-SHA256 исходных bytes POST webhook; без значения handler закрыт с 503. Не подменять verify/access token |
| `WHATSAPP_OTP_TEMPLATE_NAME` | Приоритетное имя OTP-шаблона; fallback `WHATSAPP_AUTH_TEMPLATE_NAME` |
| `WHATSAPP_OTP_TEMPLATE_LANG` | Приоритетный language code; fallback `WHATSAPP_AUTH_TEMPLATE_LANGUAGE`, затем `ru`. Должен совпадать с выбранным шаблоном |
| `WHATSAPP_OTP_HASH_SECRET` | Секрет хеширования mobile OTP и телефона. В коде есть фиксированный dev fallback: production-конфигурация должна задавать отдельный секрет |
| `WHATSAPP_OTP_TEMPLATE_COMPONENTS_JSON` | Только mobile start: JSON-массив компонентов, строки `{{OTP_CODE}}` заменяются кодом. Невалидный JSON приводит к fallback body с одним text-параметром, а не к отказу настройки |
| `WHATSAPP_OTP_TEMPLATE_TYPE` | `utility` по умолчанию либо `authentication`; в текущем mobile start записывается в metadata метрики. Сам по себе не меняет структуру компонентов или категорию шаблона у провайдера |
| `MOBILE_WHATSAPP_AUTH` | Server flag, затем fallback `NEXT_PUBLIC_MOBILE_WHATSAPP_AUTH`; по коду default `true` |
| `MOBILE_WHATSAPP_AUTH_ROLLOUT_PERCENT` | Доля запросов start, 0–100; отсутствие корректного значения означает полный rollout. Verify учитывает общий flag, без этого процента |

Flag и rollout реализованы в [featureFlags.ts](apps/web/src/lib/featureFlags.ts). Они не отключают старые auth routes, profile OTP или общий mobile-exchange.

Минимальная форма custom components, **только если именно такой body принят для выбранного шаблона**:

```json
[
  {
    "type": "body",
    "parameters": [
      { "type": "text", "text": "{{OTP_CODE}}" }
    ]
  }
]
```

Репозиторий не доказывает, что шаблон с любым указанным именем существует или одобрен. Настройку аккаунта, действующую версию Graph API, категорию, язык и состав параметров нужно сверять в выбранной среде с контрактом провайдера; здесь описан только потребитель этих значений в коде. `WHATSAPP_WABA_ID` не используется перечисленными sender/OTP consumers и не заменяет `WHATSAPP_PHONE_NUMBER_ID`.

## Шаблоны заявок

[env.ts](apps/web/src/lib/env.ts) читает следующие отдельные имена:

| Ключ события | Переменная имени шаблона |
| --- | --- |
| `staff_owner` | `WHATSAPP_STAFF_APPLICATION_OWNER_TEMPLATE_NAME` |
| `staff_applicant` | `WHATSAPP_STAFF_APPLICATION_APPLICANT_TEMPLATE_NAME` |
| `staff_approved` | `WHATSAPP_STAFF_APPLICATION_APPROVED_TEMPLATE_NAME` |
| `business_applicant` | `WHATSAPP_BUSINESS_APPLICATION_APPLICANT_TEMPLATE_NAME` |
| `business_admin` | `WHATSAPP_BUSINESS_APPLICATION_ADMIN_TEMPLATE_NAME` |
| `business_approved` | `WHATSAPP_BUSINESS_APPLICATION_APPROVED_TEMPLATE_NAME` |
| `owner_applicant` | `WHATSAPP_OWNER_APPLICATION_APPLICANT_TEMPLATE_NAME` |
| `owner_admin` | `WHATSAPP_OWNER_APPLICATION_ADMIN_TEMPLATE_NAME` |
| `owner_approved` | `WHATSAPP_OWNER_APPLICATION_APPROVED_TEMPLATE_NAME` |

Общий язык — `WHATSAPP_APPLICATION_TEMPLATE_LANGUAGE` с fallback `ru`. Пустое имя означает отсутствие настроенного шаблона этой ветки, а не готовность канала. [applicationNotificationConfig.ts](apps/web/src/lib/applicationNotificationConfig.ts) читает `WHATSAPP_APPLICATION_NAMED_PARAMETERS`: JSON object с ключами событий и массивами имён параметров. Без массива используются позиционные параметры. Для именованных число, порядок и семантика имён должны совпасть с переданными значениями; имена уникальны и соответствуют `[a-z][a-z0-9_]*`. Их нельзя угадывать по названию события.

## Ограничения перед подключением среды

- **Локальное исправление 9–10 ноября:** legacy auth endpoints сняты с поддержки и отвечают 410; негативные [route tests](apps/web/src/__tests__/api/auth/whatsapp/retiredAuth.test.ts) проверяют отсутствие Auth/DB effects. Старые внешние клиенты не инвентаризированы; нужны согласованные rollout и обновление клиентов.
- **Локальное исправление 9–10 ноября:** mobile-exchange больше не имеет latest-pending GET или публичной загрузки токенов; POST принимает code+verifier. Требуются новая grant migration и совместимый клиент. Полный provider/device сценарий пока не проверен: [API integrations](docs/api/AUTH_AND_INTEGRATIONS.md).
- **Исправление 2026-11-09:** WhatsApp POST webhook проверяет `X-Hub-Signature-256` до parsing и side effects; отсутствующая/неверная подпись даёт 403. Изолированные tests прошли, реальная конфигурация Meta и deployment не проверялись. С 10 ноября durable inbox разделяет приём, транзакцию команды и receipt ответа; старые ID автоматически не переигрываются — [контракт webhook](docs/api/AUTH_AND_INTEGRATIONS.md).
- Успешный HTTP ответ отправщика не является подтверждением прочтения или доставки адресату. Booking sender не имеет durable outbox; повтор запроса может повторить сообщения. Перед публичной эксплуатацией нужны исправления и отдельная проверка выбранной среды, а не только заполненные переменные.

Для будущего разрешённого smoke используют отдельные тестовые credentials и согласованных получателей. `/api/notify/ping` требует global super_admin и отправляет настоящее письмо только на подтвержденный email caller; это не read-only проверка конфигурации. Реальные отправки этой итерацией не выполнялись.
