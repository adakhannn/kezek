// apps/web/src/lib/notifications/index.ts

// Экспортируем все типы
export type * from './types';

// Экспортируем сервисы
export { BookingDataService } from './BookingDataService';
export { ParticipantDataService } from './ParticipantDataService';
export { EmailNotificationService } from './EmailNotificationService';
export { WhatsAppNotificationService } from './WhatsAppNotificationService';
export { TelegramNotificationService } from './TelegramNotificationService';

// Экспортируем утилиты
export * from './utils';
export * from './messageBuilders';

