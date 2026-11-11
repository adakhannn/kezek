import { OutboxStoreError, type EventOutcome, type OutboxStore } from './outboxStore';
import { PROVIDER_DEADLINE_MS } from './outboxTransport';
import type { OutboxEvent, PreparedDelivery, StoredDelivery } from './outboxTypes';
import { ProviderDeliveryError } from './outboxTypes';
import type { BookingRow, NotifyType } from './types';

type WorkerDeps = {
    store: OutboxStore;
    plan: (booking: BookingRow, type: NotifyType) => Promise<PreparedDelivery[]>;
    send: (eventId: string, delivery: StoredDelivery) => Promise<string>;
    now?: () => number;
};

/** Bounded waves of two jobs, with no same-run retries, before the DB lease. */
export async function runBookingNotificationWorker({ store, plan, send, now = Date.now }: WorkerDeps) {
    const deadline = now() + 45_000;
    const seen = new Set<string>();
    const outcomes: string[] = [];
    const process = async (event: OutboxEvent) => {
        const finish = async (outcome: EventOutcome, code?: string, retryAfter = 0) => {
            await store.finish(event, outcome, code, retryAfter);
            return outcome;
        };
        try {
            const booking = await store.booking(event.booking_id);
            if (!booking) return await finish('obsolete', 'booking_removed');
            if (booking.notification_revision === undefined) throw new Error('Notification schema missing');
            if (!matchesEvent(booking, event)) return await finish('obsolete', 'booking_revision_changed');
            if (!event.prepared_at) await store.prepare(event, await plan(booking, event.event_type));
            const deliveries = await store.deliveries(event);
            let failed = false;
            let retry = false;
            let retryAfter = 0;
            for (const delivery of deliveries) {
                if (delivery.status === 'sent') continue;
                if (delivery.status === 'failed' || delivery.status === 'ambiguous') { failed = true; continue; }
                // Reserve time for provider deadline plus both DB acknowledgements.
                if (now() + PROVIDER_DEADLINE_MS + 12_000 >= deadline) {
                    return await finish(retry ? 'retry' : 'continue', retry ? 'provider_retry' : 'work_budget_reached', retryAfter);
                }
                const disposition = await store.begin(event, delivery.delivery_key);
                if (disposition === 'obsolete') return await finish('obsolete', 'booking_revision_changed');
                if (disposition === 'sent') continue;
                if (disposition === 'failed' || disposition === 'ambiguous') { failed = true; continue; }
                if (disposition !== 'send') throw new Error('Unknown delivery disposition');
                let providerId: string;
                try {
                    providerId = await send(event.id, delivery);
                } catch (error) {
                    const failure = error instanceof ProviderDeliveryError ? error : new ProviderDeliveryError('provider_outcome_unknown', delivery.channel === 'email' ? 'retry' : 'ambiguous');
                    await store.fail(event, delivery.delivery_key, failure.outcome, failure.code);
                    retry ||= failure.outcome === 'retry';
                    failed ||= failure.outcome !== 'retry';
                    retryAfter = Math.max(retryAfter, failure.retryAfterSeconds);
                    continue;
                }
                // Receipt persistence is outside provider catch: losing this write
                // must retain 'sending', not turn an accepted message into a safe retry.
                await store.receipt(event, delivery.delivery_key, providerId);
            }
            return await finish(retry ? 'retry' : failed ? 'failed' : 'sent', retry ? 'provider_retry' : failed ? 'delivery_requires_review' : '', retryAfter);
        } catch (error) {
            if (error instanceof OutboxStoreError && error.code === 'OUTBOX_LEASE_LOST') return 'lease_lost';
            try {
                return await finish(error instanceof OutboxStoreError && error.code === 'OUTBOX_EVENT_OBSOLETE' ? 'obsolete' : 'retry', 'worker_incomplete');
            } catch { return 'lease_lost'; }
        }
    };
    // Admission leaves time for one provider deadline plus acknowledgements.
    // SQL excludes every already-seen event, including immediate continuations.
    while (seen.size < 100 && now() + PROVIDER_DEADLINE_MS + 12_000 < deadline) {
        const events = await store.claim([...seen], Math.min(2, 100 - seen.size));
        if (events.length === 0) break;
        if (events.length > 2 || events.some(event => seen.has(event.id)) || new Set(events.map(event => event.id)).size !== events.length) {
            throw new OutboxStoreError('OUTBOX_INVALID_CLAIM');
        }
        events.forEach(event => seen.add(event.id));
        outcomes.push(...await Promise.all(events.map(process)));
    }
    const pruned = await store.prune();
    return { claimed: seen.size, outcomes, pruned };
}

function matchesEvent(booking: BookingRow, event: OutboxEvent) {
    return booking.notification_revision === event.booking_revision &&
        (event.event_type === 'hold' ? ['hold', 'pending_hold'].includes(booking.status) :
            event.event_type === 'confirm' ? booking.status === 'confirmed' : booking.status === 'cancelled');
}
