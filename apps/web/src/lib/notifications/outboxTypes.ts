import type { NotifyType } from './types';

export type DeliveryChannel = 'email' | 'telegram' | 'whatsapp';
export type PreparedDelivery = { key: string; channel: DeliveryChannel; payload: Record<string, unknown> };
export type StoredDelivery = {
    delivery_key: string; channel: DeliveryChannel; payload: Record<string, unknown>;
    status: 'pending' | 'sending' | 'sent' | 'failed' | 'ambiguous';
    sent_at: string | null; first_attempt_at: string | null; last_error_code: string | null;
};
export type OutboxEvent = {
    id: string; booking_id: string; booking_revision: number; event_type: NotifyType;
    lease_token: string; lease_until: string; prepared_at: string | null; attempts: number;
};
export type DeliveryOutcome = 'retry' | 'failed' | 'ambiguous';
export class ProviderDeliveryError extends Error {
    constructor(readonly code: string, readonly outcome: DeliveryOutcome, readonly retryAfterSeconds = 0) {
        super(code);
        this.name = 'ProviderDeliveryError';
    }
}
