# Notification System

Модульная система отправки уведомлений для бронирований.

## Структура

```
notifications/
├── types.ts                      # Типы и интерфейсы
├── utils.ts                      # Утилиты (first, normalizeEmails, greet, roleRu, statusRu, buildHtmlPersonal)
├── messageBuilders.ts            # Построение сообщений (HTML, текст, WhatsApp, Telegram)
├── BookingDataService.ts         # Получение данных бронирования из БД
├── ParticipantDataService.ts     # Получение данных участников (клиент, владелец, мастер)
├── EmailNotificationService.ts   # Отправка email уведомлений
├── WhatsAppNotificationService.ts # Отправка WhatsApp уведомлений
├── TelegramNotificationService.ts # Отправка Telegram уведомлений
├── NotificationOrchestrator.ts   # Координация всех сервисов
└── index.ts                      # Экспорты
```

## Использование

### Базовое использование

```typescript
import { NotificationOrchestrator } from '@/lib/notifications';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';

// Создаем клиенты Supabase
const supabase = createServerClient(url, anon, { cookies });
const admin = createClient(url, serviceKey);

// Создаем оркестратор
const orchestrator = new NotificationOrchestrator(
    supabase,
    admin,
    {
        apiKey: getResendApiKey(),
        from: getEmailFrom(),
        replyTo: ownerEmail,
    }
);

// Отправляем уведомления
const result = await orchestrator.sendNotifications(booking, 'confirm');
// result: { emailsSent: 3, whatsappSent: 2, telegramSent: 1 }
```

### BookingDataService

Сервис для получения данных бронирования из базы данных:

```typescript
import { BookingDataService } from '@/lib/notifications';
import { createClient } from '@supabase/supabase-js';

const admin = createClient(url, serviceKey);
const bookingService = new BookingDataService(admin);

// Получить данные бронирования
const booking = await bookingService.getBookingById('booking-123');

// Получить email владельца
const ownerEmail = await bookingService.getOwnerEmail('owner-123');
// или из бизнеса
const ownerEmail = await bookingService.getOwnerEmailFromBusiness(booking.biz);
```

### Использование отдельных сервисов

```typescript
import { 
    EmailNotificationService,
    WhatsAppNotificationService,
    TelegramNotificationService,
    ParticipantDataService 
} from '@/lib/notifications';

// Получаем данные участников
const participantService = new ParticipantDataService(supabase, admin);
const clientData = await participantService.getClientData(booking);
const ownerData = await participantService.getOwnerData(biz);
const staffData = await participantService.getStaffData(staff);

// Отправляем email
const emailService = new EmailNotificationService({
    apiKey: getResendApiKey(),
    from: getEmailFrom(),
});
await emailService.sendNotifications(recipients, bookingDetails, 'confirm');

// Отправляем WhatsApp
const whatsappService = new WhatsAppNotificationService();
await whatsappService.sendToClient(clientData, bookingDetails, 'confirm');

// Отправляем Telegram
const telegramService = new TelegramNotificationService();
await telegramService.sendToOwner(ownerData, bookingDetails, 'confirm');
```

## Архитектура

### ParticipantDataService
- Получает данные клиента, владельца и мастера из БД
- Обрабатывает настройки уведомлений
- Поддерживает гостевые бронирования

### EmailNotificationService
- Отправляет email через Resend API
- Поддерживает персонализацию (приветствие по роли)
- Обрабатывает rate limiting
- Добавляет .ics вложения для клиентов

### WhatsAppNotificationService
- Отправляет уведомления через WhatsApp Cloud API
- Проверяет настройки уведомлений и верификацию номера
- Нормализует номера телефонов

### TelegramNotificationService
- Отправляет уведомления через Telegram Bot API
- Проверяет настройки уведомлений
- Для мастера и владельца отправляет даже без верификации (служебные уведомления)

### NotificationOrchestrator
- Координирует все сервисы
- Формирует список получателей
- Отправляет уведомления параллельно
- Возвращает сводку результатов

## Преимущества новой архитектуры

1. **Модульность** - каждый сервис отвечает за свою область
2. **Тестируемость** - легко тестировать отдельные компоненты
3. **Переиспользуемость** - сервисы можно использовать независимо
4. **Поддерживаемость** - проще добавлять новые каналы уведомлений
5. **Безопасность** - используется безопасное логирование вместо console.log

## Миграция

Старый код (1017 строк в route.ts) был разбит на:
- **types.ts** - 80 строк
- **utils.ts** - 60 строк
- **messageBuilders.ts** - 200 строк
- **ParticipantDataService.ts** - 250 строк
- **EmailNotificationService.ts** - 150 строк
- **WhatsAppNotificationService.ts** - 120 строк
- **TelegramNotificationService.ts** - 120 строк
- **NotificationOrchestrator.ts** - 200 строк
- **route.ts** - 120 строк (было 1017)

**Итого:** ~1300 строк вместо 1017, но с лучшей структурой и переиспользуемостью.

