/**
 * Базовые контракты для уведомлений на уровне домена.
 *
 * Эти типы не зависят от конкретных провайдеров (Resend, WhatsApp API, Telegram Bot и т.п.)
 * и могут использоваться как в web, так и в mobile/интеграциях.
 */

/**
 * Каналы уведомлений, поддерживаемые системой.
 */
export type NotificationChannel = 'email' | 'whatsapp' | 'telegram' | 'push';

/**
 * Тип уведомления по бизнес-смыслу (create/hold/confirm/cancel и т.п.).
 * Конкретные значения задаются на уровне приложения (например, 'hold' | 'confirm' | 'cancel').
 */
export type NotificationEventType = string;

/**
 * Минимальный контракт сообщения для отправки уведомления.
 *
 * На уровне инфраструктуры (web) это может быть преобразовано:
 * - в письмо (subject/html/text/ics)
 * - в WhatsApp/Telegram сообщение
 * - в push-уведомление
 */
export interface NotificationMessage {
    channel: NotificationChannel;
    type: NotificationEventType;
    /**
     * Идентификатор получателя (email, телефон, chat id и т.п.).
     * Конкретная семантика определяется адаптером канала.
     */
    recipient: string;
    /**
     * Идентификатор шаблона (если используется шаблонная система).
     */
    templateKey?: string;
    /**
     * Переменные для подстановки в шаблон.
     */
    variables?: Record<string, unknown>;
    /**
     * Произвольные метаданные (например, booking_id, biz_id и т.п.).
     */
    meta?: Record<string, unknown>;
}

/**
 * Результат отправки уведомления через произвольный канал.
 */
export interface NotificationDispatchResult {
    channel: NotificationChannel;
    success: boolean;
    errorMessage?: string;
}

