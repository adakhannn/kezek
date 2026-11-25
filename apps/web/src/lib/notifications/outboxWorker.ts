import { OutboxStoreError, type EventOutcome, type OutboxStore } from './outboxStore';
import { PROVIDER_DEADLINE_MS } from './outboxTransport';
import type { OutboxEvent, PreparedDelivery, StoredDelivery } from './outboxTypes';
import { ProviderDeliveryError, RECIPIENT_GONE_CODES } from './outboxTypes';
import { isReminderType, type BookingEventType, type BookingRow, type ReminderType } from './types';

import { logError } from '@/lib/log';

type WorkerDeps = {
    store: OutboxStore;
    plan: (booking: BookingRow, type: BookingEventType) => Promise<PreparedDelivery[]>;
    send: (eventId: string, delivery: StoredDelivery) => Promise<string>;
    now?: () => number;
};

/** Bounded waves of two jobs, with no same-run retries, before the DB lease. */
export async function runBookingNotificationWorker({ store, plan, send, now = Date.now }: WorkerDeps) {
    const deadline = now() + 45_000;
    const seen = new Set<string>();
    const outcomes: string[] = [];
    let errors = 0;
    // Reminders due now become ordinary events of this and later runs (enqueue_booking_reminders).
    // A failure here must not hold back confirmations, so it is logged and counted, not thrown.
    let reminders = 0;
    try { reminders = await store.enqueueReminders(); }
    catch (error) {
        errors++;
        logError('BookingNotificationWorker', 'Booking reminders could not be enqueued', { error });
    }
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
            // After a backlog or the first activation, a "confirmed"/"cancelled" message about a
            // visit that has already started is noise (R25-15): close the event without sending.
            if (hasStarted(booking, now())) return await finish('obsolete', 'booking_in_past');
            // A reminder delayed past its window (queue downtime) is noise: the 2-hour one or the
            // visit itself comes next. Same bounds as enqueue_booking_reminders().
            if (isReminderType(event.event_type) && reminderWindowPassed(booking, event.event_type, now())) {
                return await finish('obsolete', 'reminder_window_passed');
            }
            if (!event.prepared_at) await store.prepare(event, await plan(booking, event.event_type));
            const deliveries = await store.deliveries(event);
            let failed = false;
            let retry = false;
            let retryAfter = 0;
            for (const delivery of deliveries) {
                if (delivery.status === 'sent') continue;
                if (delivery.status === 'failed' || delivery.status === 'ambiguous') {
                    // A removed app install (push DeviceNotRegistered) stays visible per delivery only.
                    failed ||= !(delivery.status === 'failed' && RECIPIENT_GONE_CODES.has(delivery.last_error_code ?? ''));
                    continue;
                }
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
                    if (!(error instanceof ProviderDeliveryError)) {
                        logError('BookingNotificationWorker', 'Delivery send failed with an unexpected error',
                            { eventId: event.id, channel: delivery.channel, error });
                    }
                    const failure = error instanceof ProviderDeliveryError ? error : new ProviderDeliveryError('provider_outcome_unknown', delivery.channel === 'email' ? 'retry' : 'ambiguous');
                    await store.fail(event, delivery.delivery_key, failure.outcome, failure.code);
                    retry ||= failure.outcome === 'retry';
                    failed ||= failure.outcome !== 'retry' && !RECIPIENT_GONE_CODES.has(failure.code);
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
            // R25-13: the cause must reach logs/Sentry, not only the generic worker_incomplete code.
            // The logger masks phones/e-mails in messages and details; no payload is passed here.
            const obsolete = error instanceof OutboxStoreError && error.code === 'OUTBOX_EVENT_OBSOLETE';
            if (!obsolete) {
                errors++;
                logError('BookingNotificationWorker', 'Outbox event processing failed',
                    { eventId: event.id, eventType: event.event_type, attempt: event.attempts, error });
            }
            try {
                return await finish(obsolete ? 'obsolete' : 'retry', 'worker_incomplete');
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
    return { claimed: seen.size, outcomes, errors, pruned, reminders };
}

function hasStarted(booking: BookingRow, nowMs: number) {
    const start = Date.parse(booking.start_at);
    return Number.isFinite(start) && start <= nowMs;
}

/** Minimum time before the visit at which a reminder is still sent (migration 20261125160000). */
export const REMINDER_MIN_LEAD_MS: Record<ReminderType, number> = { reminder_24h: 2 * 3_600_000, reminder_2h: 15 * 60_000 };

function reminderWindowPassed(booking: BookingRow, type: ReminderType, nowMs: number) {
    const start = Date.parse(booking.start_at);
    return Number.isFinite(start) && start - nowMs <= REMINDER_MIN_LEAD_MS[type];
}

function matchesEvent(booking: BookingRow, event: OutboxEvent) {
    if (booking.notification_revision !== event.booking_revision) return false;
    if (event.event_type === 'hold') return ['hold', 'pending_hold'].includes(booking.status);
    if (event.event_type === 'cancel') return booking.status === 'cancelled';
    // confirm and both reminders: only a booking still confirmed at send time. A reschedule or a
    // cancellation changed the revision and failed above.
    return booking.status === 'confirmed';
}
