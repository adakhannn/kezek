import type { BookingEventType } from './types';

// A new channel needs a member here, a branch in outboxTransport and the channel check of
// booking_notification_deliveries widened by a migration (push: 20261125170000).
export type DeliveryChannel = 'email' | 'telegram' | 'whatsapp' | 'push';
export type PreparedDelivery = { key: string; channel: DeliveryChannel; payload: Record<string, unknown> };
export type StoredDelivery = {
    delivery_key: string; channel: DeliveryChannel; payload: Record<string, unknown>;
    status: 'pending' | 'sending' | 'sent' | 'failed' | 'ambiguous';
    sent_at: string | null; first_attempt_at: string | null; last_error_code: string | null;
};
export type OutboxEvent = {
    id: string; booking_id: string; booking_revision: number; event_type: BookingEventType;
    lease_token: string; lease_until: string; prepared_at: string | null; attempts: number;
};
export type DeliveryOutcome = 'retry' | 'failed' | 'ambiguous';
/**
 * Failed deliveries whose recipient address no longer exists (Expo DeviceNotRegistered: the app was
 * removed or the token rotated). The delivery stays failed with its code for review, but the event
 * does not: one stale install must not turn the event, and the queue health, red. Like WhatsApp
 * status failures (R25-07), they are visible per delivery.
 */
export const RECIPIENT_GONE_CODES: ReadonlySet<string> = new Set(['push_device_not_registered']);
export class ProviderDeliveryError extends Error {
    constructor(readonly code: string, readonly outcome: DeliveryOutcome, readonly retryAfterSeconds = 0) {
        super(code);
        this.name = 'ProviderDeliveryError';
    }
}
