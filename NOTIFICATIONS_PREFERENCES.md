# Предпочтения и доставка уведомлений

Статус: текущая модель по исходникам, сверка 2026-11-01. Runtime и доставка провайдерами: `NOT_RUN`. Владелец: backend / notifications. Этот документ описывает существующие различия по каналам и ролям; наличие preference в профиле не означает, что каждый отправщик его применяет.

Контракты: [notify и интеграции](docs/api/AUTH_AND_INTEGRATIONS.md), [профиль и auth flows](docs/api/CLIENT_AND_AUTH_FLOWS.md). Конфигурация: [WhatsApp](WHATSAPP_SETUP.md), [Telegram](TELEGRAM_AUTH_IMPLEMENTATION.md). Эксплуатация и риски: [Operations](docs/OPERATIONS.md), [Engineering findings](docs/ENGINEERING_FINDINGS.md).

## Данные предпочтений

| Данные | Что читает текущая реализация |
| --- | --- |
| `profiles.notify_email` | Разрешение email для клиента, мастера и владельца в booking orchestrator; `null`/отсутствие profile дают runtime fallback `true` |
| `user_notification_emails` | Участники используют строки с `verified=true` и `enabled=true`. Адреса нормализуются и дедуплицируются; если список пуст или чтение завершилось ошибкой, остаётся fallback email роли |
| `profiles.whatsapp_phone`, `whatsapp_verified`, `notify_whatsapp` | Подтверждённый адрес канала отдельно от контактного `phone`. В booking отправке проверки применяются полностью только к клиенту |
| `profiles.telegram_id`, `telegram_verified`, `notify_telegram` | Идентификатор Telegram пользователя и состояние привязки. Sender использует ID как private-chat destination, не как произвольный group chat |
| `businesses.email_notify_to` | Дополнительные email-получатели брони. Это не primary email владельца и не настройка его личного согласия |
| `profiles.notify_sms` | Сохраняется profile update service, но booking orchestrator ниже не выполняет SMS-отправку. Аналогично наличие типа/экрана push не доказывает push-доставку этим orchestrator |

Источник загрузки — [ParticipantDataService](apps/web/src/lib/notifications/ParticipantDataService.ts). Здесь описаны fallback в коде, а не предположения о defaults фактической базы.

[User notification email service](apps/web/src/lib/userNotificationEmailService.ts) синхронизирует источники подтверждённого account email, Google identity email и Yandex metadata через RPC. `/api/profile/notification-emails` и изменения предпочтений описаны в [CLIENT_AND_AUTH_FLOWS](docs/api/CLIENT_AND_AUTH_FLOWS.md). Пустой список enabled email **не является общим запретом отправки**: для этого в booking flow используется также `notify_email=false`.

## Кто получает уведомления о брони

[NotificationOrchestrator](apps/web/src/lib/notifications/NotificationOrchestrator.ts) обрабатывает `hold`, `confirm`, `cancel` и загружает клиента, владельца и мастера. Правила подтверждены непосредственно [WhatsApp sender service](apps/web/src/lib/notifications/WhatsAppNotificationService.ts) и [Telegram sender service](apps/web/src/lib/notifications/TelegramNotificationService.ts).

| Получатель | Email | WhatsApp | Telegram |
| --- | --- | --- | --- |
| Клиент | Enabled verified notification emails; fallback Auth view, затем `booking.client_email`. Нужен `notifyEmail`; клиентская копия содержит `.ics` | Нужны `whatsapp_phone`, `notify_whatsapp=true`, `whatsapp_verified=true` | Нужны Telegram ID, `notify_telegram=true`, `telegram_verified=true` |
| Мастер | Enabled verified emails по `staff.user_id`; fallback `staff.email`. Profile `notify_email` учитывается | Profile WhatsApp phone либо fallback `staff.phone`. **Sender не проверяет `notify_whatsapp` или `whatsapp_verified`**, хотя loader их читает | Profile по `staff.user_id`; ID и `notify_telegram` обязательны, `telegram_verified` не обязателен |
| Владелец | Enabled verified emails по `business.owner_id`; fallback Auth admin / Auth view. Profile `notify_email` учитывается | `profiles.whatsapp_phone`. **Sender не проверяет `notify_whatsapp` или `whatsapp_verified`**; loader владельца эти два поля не загружает | Profile по owner ID; ID и `notify_telegram` обязательны, `telegram_verified` не обязателен |
| Дополнительные адреса бизнеса | Нормализованные `email_notify_to`; общего profile opt-out для этих адресов в этой ветке нет | Не используются этой веткой | Не используются этой веткой |

Для гостевой брони `client_phone` — контакт, он сам не становится проверенным WhatsApp-адресом. Email гостя может использоваться как fallback. При отсутствии связанного `staff.user_id` личные preferences мастера загрузить нельзя, остаются runtime defaults и данные staff.

Email owner исключается из дополнительных адресов бизнеса независимо от того, включён ли его `notify_email`. Финальный email dedup оставляет первого получателя по строке адреса; для fallback адресов не гарантирована единая нормализация регистра. [Telegram dedup](apps/web/src/lib/notifications/telegramRecipients.ts) сначала фильтрует разрешённых получателей, затем оставляет один chat ID в порядке client → staff → owner. WhatsApp отправляется тремя отдельными вызовами без аналогичного dedup: совпавшие номера ролей могут получить несколько сообщений.

Обход WhatsApp preferences для staff/owner — **текущее ограничение, требующее исправления**, а не рекомендуемое правило «служебные сообщения можно отправлять всегда». То же различие verification для Telegram необходимо учитывать при изменении политики. Изменение только loader или UI не меняет проверки sender.

## Сохранение профиля

[Profile update service](apps/web/src/lib/profileUpdateService.ts) получает текущего пользователя и:

- Сохраняет `notify_email` и `notify_sms`, по умолчанию `true` при отсутствии поля.
- Разрешает `notify_whatsapp=true` только если текущий profile содержит WhatsApp phone и verified; `notify_telegram=true` — только если есть Telegram ID и verified.
- Если передан `notification_emails`, вызывает `set_my_notification_email_preferences` после profile upsert. Ошибка RPC может вернуться после уже сохранённого profile; общей транзакции этих действий нет.

HTTP handler делает type cast body, а не полную Zod-валидацию. Это не универсальный PATCH с сохранением отсутствующих preferences: не следует отправлять неполное тело, предполагая, что пропущенные поля останутся прежними. Подробные входы и errors — [API flow handbook](docs/api/CLIENT_AND_AUTH_FLOWS.md).

## Что означает результат отправки

`POST /api/notify` принимает booking ID и тип события, проверяет пользователя и право на бронь, затем собирает получателей из сохранённых данных. До auth в [notifyBookingService](apps/web/src/lib/notifyBookingService.ts) проверяется `RESEND_API_KEY`; при его отсутствии весь путь прекращается, даже если WhatsApp/Telegram настроены. Email sender использует `EMAIL_FROM`; конфигурация остальных каналов описана в связанных руководствах.

Пример **формы** успешного ответа, не результат проведённой отправки:

```json
{
  "ok": true,
  "data": {
    "sent": 1,
    "whatsappSent": 0,
    "telegramSent": 1
  }
}
```

Счётчики отражают успешные ответы отправщиков внутри запроса. Нули могут означать отсутствие подходящих адресатов, выключенный/ненастроенный канал или ошибку провайдера; HTTP 200 не доказывает доставку каждому участнику.

[EmailNotificationService](apps/web/src/lib/notifications/EmailNotificationService.ts) отправляет письма последовательно, с паузой 600 ms между адресатами; при HTTP 429 делает один повтор после `Retry-After` либо 2 секунд. WhatsApp и Telegram используют `Promise.allSettled` по получателям, каналы запускаются параллельно. Это inline-отправка: в данной цепочке нет durable outbox, общего worker retry или атомарности с записью брони. Повторный notify может повторить доставку; provider fetch не имеет заданного здесь deadline. Нагрузка увеличивает время HTTP-запросов — [Operations](docs/OPERATIONS.md) не объявляет измеренную пропускную способность.

`POST /api/notify/ping` — **OPEN risk**, не health check: [HTTP](apps/web/src/lib/notifyPingHttpService.ts) и [service](apps/web/src/lib/notifyPingService.ts) отправляют настоящее Resend email по переданному адресу, без проверки пользователя в этой цепочке. Внешний `ok:true` возможен даже при отказе провайдера (`data.ok=false`). Использовать его как обычную production-проверку или доказательство готовности каналов нельзя.

## Другие события

Заявки бизнеса/мастера/владельца используют отдельный [businessRoleApplicationNotificationService](apps/web/src/lib/businessRoleApplicationNotificationService.ts). Он проверяет profile preferences и verification для Telegram/WhatsApp и имеет собственные шаблоны и правила получателей. Эти проверки не исправляют booking senders и не позволяют переносить таблицу выше на все сообщения проекта.

Новые каналы и события должны явно определить источник согласия, подтверждение адресата, dedup/idempotency и результат частичной ошибки. До изменения реализации действующим фактом остаётся поведение связанных consumers, а не единая декларация в UI или типах.
