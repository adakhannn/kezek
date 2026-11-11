import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { BookingDataService } from './BookingDataService';
import type { DeliveryOutcome, OutboxEvent, PreparedDelivery, StoredDelivery } from './outboxTypes';
import type { BookingRow } from './types';

import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/lib/env';

export class OutboxStoreError extends Error {
    constructor(readonly code: string) { super(code); this.name = 'OutboxStoreError'; }
}
export type EventOutcome = 'sent' | 'retry' | 'continue' | 'obsolete' | 'failed';
export interface OutboxStore {
    claim(excludeIds: string[], limit: number): Promise<OutboxEvent[]>;
    booking(id: string): Promise<BookingRow | null>;
    prepare(event: OutboxEvent, deliveries: PreparedDelivery[]): Promise<void>;
    deliveries(event: OutboxEvent): Promise<StoredDelivery[]>;
    begin(event: OutboxEvent, key: string): Promise<string>;
    receipt(event: OutboxEvent, key: string, providerId: string): Promise<void>;
    fail(event: OutboxEvent, key: string, outcome: DeliveryOutcome, code: string): Promise<void>;
    finish(event: OutboxEvent, outcome: EventOutcome, code?: string, retryAfter?: number): Promise<void>;
    prune(): Promise<number>;
}

/** Every DB HTTP request has its own deadline, including auth-admin lookups in preparation. */
export function createOutboxAdminClient() {
    return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: (input, init) => fetch(input, { ...init,
            signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(5000)]) : AbortSignal.timeout(5000),
        }) },
    });
}

export function createOutboxStore(admin: SupabaseClient): OutboxStore {
    const rpc = async (name: string, args: Record<string, unknown> = {}) => {
        const { data, error } = await admin.rpc(name, args);
        if (error) throw new OutboxStoreError(['OUTBOX_LEASE_LOST', 'OUTBOX_EVENT_OBSOLETE'].includes(error.message) ? error.message : 'OUTBOX_DATABASE_FAILED');
        return data;
    };
    const identity = (event: OutboxEvent) => ({ p_event_id: event.id, p_lease_token: event.lease_token });
    return {
        claim: async (excludeIds, limit) => (await rpc('claim_booking_notification_batch', { p_limit: limit, p_lease_seconds: 90, p_exclude_ids: excludeIds })) as OutboxEvent[],
        booking: id => new BookingDataService(admin).getBookingById(id),
        prepare: async (event, deliveries) => { await rpc('prepare_booking_notification_deliveries', { ...identity(event), p_deliveries: deliveries }); },
        deliveries: async event => {
            const data = await rpc('read_booking_notification_deliveries', identity(event));
            if (!Array.isArray(data) || data.length > 200) throw new OutboxStoreError('OUTBOX_DATABASE_FAILED');
            return data as StoredDelivery[];
        },
        begin: async (event, key) => rpc('begin_booking_notification_delivery', { ...identity(event), p_delivery_key: key }),
        receipt: async (event, key, providerId) => { await rpc('record_booking_notification_delivery', { ...identity(event), p_delivery_key: key, p_provider_id: providerId }); },
        fail: async (event, key, outcome, code) => { await rpc('fail_booking_notification_delivery', { ...identity(event), p_delivery_key: key, p_outcome: outcome, p_error_code: code }); },
        finish: async (event, outcome, code = '', retryAfter = 0) => { await rpc('finish_booking_notification', { ...identity(event), p_outcome: outcome, p_error_code: code, p_retry_after_seconds: retryAfter }); },
        prune: async () => rpc('prune_booking_notifications', { p_limit: 100 }),
    };
}
