# Модель предпочтений уведомлений (NOTIFY-2)

Этот документ фиксирует, **где и как** хранятся настройки уведомлений и какие каналы реально используются.

---

## 1. Где хранятся предпочтения

### 1.1. Уровень клиента (`profiles`)

Таблица `profiles` содержит настройки уведомлений для конечного пользователя:

- `notify_email boolean` — получать ли email‑уведомления (по умолчанию `true`).
- `notify_whatsapp boolean` — получать ли уведомления в WhatsApp (по умолчанию `true`).
- `whatsapp_verified boolean` — верифицирован ли WhatsApp номер.
- `notify_telegram boolean` — получать ли уведомления в Telegram (по умолчанию `true`).
- `telegram_verified boolean` — верифицирован ли Telegram.
- `telegram_id bigint` — chat id в Telegram (если привязан).
- `phone`, `full_name` — контактные данные, используемые как fallback.

Эти поля считываются в `ParticipantDataService.getClientData` и попадают в `ParticipantData`:

- `notifyEmail`, `notifyWhatsApp`, `notifyTelegram`,
- `whatsappVerified`, `telegramVerified`,
- `telegramId`.

### 1.2. Уровень бизнеса (`businesses`)

- `email_notify_to text[]` — список email‑адресов, на которые уходят уведомления о бронях (администраторы/владелец).
- `owner_id uuid` — владелец бизнеса (его email и имя используются как fallback, если `email_notify_to` пустой).

`ParticipantDataService.getOwnerData`:

- предпочитает email из `email_notify_to` (первый валидный);
- в качестве резервного варианта использует email из `auth.users`.

### 1.3. Уровень сотрудника (`staff` + `profiles`)

- Email и телефон мастера берутся из строки `staff` (поля `email`, `phone`).
- Telegram настройки мастера (если у него есть `user_id`) берутся из `profiles`:
  - `telegram_id`, `notify_telegram`, `telegram_verified`.

`ParticipantDataService.getStaffData` возвращает `ParticipantData` для мастера.

---

## 2. Как используются предпочтения в `NotificationOrchestrator`

Файл: `apps/web/src/lib/notifications/NotificationOrchestrator.ts`.

1. Сначала собираются данные участников:

```ts
const [clientData, ownerData, staffData] = await Promise.all([
  participantService.getClientData(booking),
  participantService.getOwnerData(biz),
  participantService.getStaffData(staff),
]);
```

2. **Email‑уведомления**:

- Клиент:
  - отправляем письмо **только если** `clientData.email && clientData.notifyEmail` (учёт `notify_email` из `profiles`);
  - для клиента прикладывается `.ics`.
- Мастер:
  - письмо отправляется, если есть `staffData.email` (отдельных флагов для opt‑out пока нет).
- Владелец:
  - письмо уходит по адресу из `email_notify_to` или, если он не задан, по email из `auth.users`.
- Администраторы:
  - все адреса из `biz.email_notify_to` (кроме дубликата email владельца).

3. **WhatsApp и Telegram**:

- Вызовы:

```ts
this.whatsappService.sendToClient(clientData, bookingDetails, notifyType);
this.whatsappService.sendToStaff(staffData, bookingDetails, notifyType);
this.whatsappService.sendToOwner(ownerData, bookingDetails, notifyType);

this.telegramService.sendToClient(clientData, bookingDetails, notifyType);
this.telegramService.sendToStaff(staffData, bookingDetails, notifyType);
this.telegramService.sendToOwner(ownerData, bookingDetails, notifyType);
```

- Предпочтения/верификация учитываются внутри соответствующих сервисов:
  - `notifyWhatsApp` + `whatsappVerified` для WhatsApp;
  - `notifyTelegram` + `telegramVerified` + `telegramId` для Telegram.

---

## 3. Как это соотносится с доменным контрактом `NotificationChannel`

В `@core-domain/ports` определены:

- `NotificationChannel = 'email' | 'whatsapp' | 'telegram' | 'push'`;
- `NotificationMessage` — минимальный доменный контракт для сообщений (канал, тип события, получатель, шаблон, переменные).

Текущая реализация `NotificationOrchestrator` и `ParticipantDataService` фактически заполняет:

- **какие каналы** доступны для конкретного пользователя:
  - email: по наличию email и `notifyEmail`;
  - WhatsApp: по наличию телефона и `notifyWhatsApp`/`whatsappVerified`;
  - Telegram: по наличию `telegramId` и `notifyTelegram`/`telegramVerified`;
- **какие каналы включены для бизнеса**:
  - email для владельца/админов через `email_notify_to`.

При дальнейшем развитии можно:

- добавить явные флаги “включён канал для бизнеса” (например, `business_notify_whatsapp`, `business_notify_telegram`);
- строить список `NotificationMessage` по `NotificationChannel`/типу события и уже их передавать в инфраструктурные сервисы (email/WhatsApp/Telegram), опираясь на этот общий доменный контракт.

---

## 4. Краткий чек‑лист при работе с уведомлениями

- При добавлении нового типа уведомлений:
  - использовать `NotifyType`/`NotificationEventType` для именования события;
  - убедиться, что `ParticipantDataService` возвращает достаточно информации для всех каналов.
- При изменении предпочтений:
  - минимальные флаги и поля должны добавляться в `profiles` / `businesses`;
  - `ParticipantDataService` обязан их читать и приводить к `ParticipantData`.
- При добавлении нового канала:
  - расширить `NotificationChannel`;
  - добавить поддержку в `ParticipantData` (флаги/идентификаторы);
  - реализовать новый `<Channel>NotificationService` и интегрировать его в `NotificationOrchestrator`.

