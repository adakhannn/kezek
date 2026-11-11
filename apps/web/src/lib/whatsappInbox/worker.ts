import type { InboxLease, WhatsAppInboxStore } from './types';

import { ProviderDeliveryError, type StoredDelivery } from '@/lib/notifications/outboxTypes';

type WorkerDeps = {
    store: WhatsAppInboxStore;
    receiver: string;
    send: (id: string, delivery: StoredDelivery) => Promise<string>;
    now?: () => number;
};
/** No automatic retry after an uncertain non-idempotent send. SQL fences every stage. */
export async function runWhatsAppInboxWorker({ store, receiver, send, now = Date.now }: WorkerDeps) {
    const started = now();
    const result = { claimed: 0, sent: 0, failed: 0, deferred: 0, errors: 0 };
    const process = async (event: InboxLease) => {
        try {
            // Allow 5s command, 5s begin, 8s provider, 5s receipt + margin within the 45s budget.
            if (now() - started > 20_000) { await store.release(event); result.deferred++; return; }
            let reply;
            try { reply = await store.process(event, receiver); }
            catch { await store.fail(event, 'retry', 'command_database_failed'); result.deferred++; result.errors++; return; }
            await store.begin(event);
            let providerId: string;
            try {
                providerId = await send(event.id, { delivery_key: 'reply', channel: 'whatsapp', payload: reply.payload,
                    status: 'sending', sent_at: null, first_attempt_at: null, last_error_code: null });
            } catch (error) {
                const failure = error instanceof ProviderDeliveryError ? error : new ProviderDeliveryError('provider_outcome_unknown', 'ambiguous');
                await store.fail(event, failure.outcome, failure.code, failure.retryAfterSeconds);
                if (failure.outcome === 'retry') result.deferred++; else result.failed++;
                return;
            }
            // Keep receipt persistence outside the provider catch: a failed receipt is never a safe resend.
            await store.receipt(event, providerId);
            result.sent++;
        } catch { result.errors++; }
    };
    while (result.claimed < 20 && now() - started < 20_000) {
        const events = await store.claim(receiver, Math.min(4, 20 - result.claimed));
        if (!events.length) break;
        result.claimed += events.length;
        await Promise.all(events.map(process));
    }
    if (now() - started < 39_000) await store.prune();
    return result;
}
