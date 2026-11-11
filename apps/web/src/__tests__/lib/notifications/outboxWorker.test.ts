import { runBookingNotificationWorker } from '@/lib/notifications/outboxWorker';
import { OutboxStoreError } from '@/lib/notifications/outboxStore';
import { ProviderDeliveryError, type OutboxEvent, type StoredDelivery } from '@/lib/notifications/outboxTypes';

const event: OutboxEvent = { id: 'event', booking_id: 'booking', booking_revision: 4, event_type: 'confirm',
    lease_token: 'lease', lease_until: '2035-01-01T00:00:00Z', prepared_at: '2034-01-01T00:00:00Z', attempts: 1 };
const delivery = (channel: StoredDelivery['channel'], status: StoredDelivery['status'] = 'pending'): StoredDelivery => ({
    delivery_key: `${channel}:recipient-hash`, channel, payload: { text: 'immutable' }, status,
    sent_at: status === 'sent' ? '2034-01-01' : null, first_attempt_at: null, last_error_code: null,
});

function setup(deliveries = [delivery('email')]) {
    const store = {
        claim: jest.fn().mockImplementation(async (exclude: string[]) => exclude.includes(event.id) ? [] : [event]),
        booking: jest.fn().mockResolvedValue({ id: 'booking', status: 'confirmed', notification_revision: 4 }),
        prepare: jest.fn().mockResolvedValue(undefined), deliveries: jest.fn().mockResolvedValue(deliveries),
        begin: jest.fn().mockImplementation(async (_event, key) => {
            const item = deliveries.find(value => value.delivery_key === key)!;
            if (item.status === 'sent') return 'sent';
            item.status = 'sending'; return 'send';
        }),
        receipt: jest.fn().mockImplementation(async (_event, key) => { deliveries.find(value => value.delivery_key === key)!.status = 'sent'; }),
        fail: jest.fn().mockImplementation(async (_event, key, outcome) => { deliveries.find(value => value.delivery_key === key)!.status = outcome === 'retry' ? 'pending' : outcome; }),
        finish: jest.fn().mockResolvedValue(undefined), prune: jest.fn().mockResolvedValue(0),
    };
    const plan = jest.fn().mockResolvedValue([]);
    const send = jest.fn().mockResolvedValue('provider-receipt');
    return { store, plan, send, now: () => 0 };
}

test('partial success is retained; retry only sends unsent recipients and reuses persisted payloads', async () => {
    const deps = setup([delivery('email', 'sent'), delivery('telegram'), delivery('whatsapp')]);
    deps.send.mockRejectedValueOnce(new ProviderDeliveryError('provider_rate_limited', 'retry', 120));
    await runBookingNotificationWorker(deps);
    expect(deps.plan).not.toHaveBeenCalled();
    expect(deps.send).toHaveBeenCalledTimes(2);
    expect(deps.store.receipt).toHaveBeenCalledWith(event, 'whatsapp:recipient-hash', 'provider-receipt');
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'retry', 'provider_retry', 120);
    deps.send.mockClear();
    await runBookingNotificationWorker(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.send.mock.calls[0][1].channel).toBe('telegram');
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'sent', '', 0);
});

test('provider success followed by receipt-write loss never becomes a known safe resend', async () => {
    const deps = setup([delivery('telegram')]);
    deps.store.receipt.mockRejectedValueOnce(new Error('DB unavailable'));
    await runBookingNotificationWorker(deps);
    expect(deps.store.fail).not.toHaveBeenCalled();
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'retry', 'worker_incomplete', 0);
    deps.store.begin.mockResolvedValueOnce('ambiguous');
    await runBookingNotificationWorker(deps);
    expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'failed', 'delivery_requires_review', 0);
});

test('non-idempotent uncertainty becomes a visible dead letter while other recipients still succeed', async () => {
    const deps = setup([delivery('telegram'), delivery('email')]);
    deps.send.mockRejectedValueOnce(new ProviderDeliveryError('provider_outcome_unknown', 'ambiguous'));
    await runBookingNotificationWorker(deps);
    expect(deps.store.fail).toHaveBeenCalledWith(event, 'telegram:recipient-hash', 'ambiguous', 'provider_outcome_unknown');
    expect(deps.store.receipt).toHaveBeenCalledWith(event, 'email:recipient-hash', 'provider-receipt');
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'failed', 'delivery_requires_review', 0);
});

test('preparation is persisted before delivery starts', async () => {
    const deps = setup(); deps.store.claim.mockImplementation(async (exclude: string[]) => exclude.includes(event.id) ? [] : [{ ...event, prepared_at: null }]);
    const prepared = [{ key: 'email:hash', channel: 'email', payload: { text: 'stable' } }];
    deps.plan.mockResolvedValue(prepared);
    await runBookingNotificationWorker(deps);
    expect(deps.store.prepare).toHaveBeenCalledWith(expect.objectContaining({ id: event.id }), prepared);
    expect(deps.store.prepare.mock.invocationCallOrder[0]).toBeLessThan(deps.store.begin.mock.invocationCallOrder[0]);
});

test('participant lookup failure cannot persist an empty successful plan', async () => {
    const deps = setup(); deps.store.claim.mockImplementation(async (exclude: string[]) => exclude.includes(event.id) ? [] : [{ ...event, prepared_at: null }]);
    deps.plan.mockRejectedValue(new Error('Lookup unavailable'));
    await runBookingNotificationWorker(deps);
    expect(deps.store.prepare).not.toHaveBeenCalled(); expect(deps.send).not.toHaveBeenCalled();
    expect(deps.store.finish).toHaveBeenLastCalledWith(expect.anything(), 'retry', 'worker_incomplete', 0);
});

test.each(['before planning', 'immediately before provider call'])('revision change is fenced %s', async stage => {
    const deps = setup();
    if (stage === 'before planning') deps.store.booking.mockResolvedValue({ id: 'booking', status: 'cancelled', notification_revision: 5 });
    else deps.store.begin.mockResolvedValue('obsolete');
    await runBookingNotificationWorker(deps);
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'obsolete', 'booking_revision_changed', 0);
});

test('expired/stolen lease cannot send or acknowledge an event', async () => {
    const deps = setup(); deps.store.begin.mockRejectedValue(new OutboxStoreError('OUTBOX_LEASE_LOST'));
    const result = await runBookingNotificationWorker(deps);
    expect(result.outcomes).toEqual(['lease_lost']); expect(deps.send).not.toHaveBeenCalled(); expect(deps.store.finish).not.toHaveBeenCalled();
});

test('remaining budget defers untouched deliveries without spending a retry attempt', async () => {
    const deps = setup(); const now = jest.fn().mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(40_000);
    await runBookingNotificationWorker({ ...deps, now });
    expect(deps.send).not.toHaveBeenCalled();
    expect(deps.store.finish).toHaveBeenLastCalledWith(event, 'continue', 'work_budget_reached', 0);
});

test('sustained fast backlog processes 100 events in bounded waves of two, never 101', async () => {
    const deps = setup();
    const events = Array.from({ length: 120 }, (_, index) => ({ ...event, id: `event-${index}` }));
    deps.store.claim.mockImplementation(async (exclude: string[], limit: number) => events.filter(item => !exclude.includes(item.id)).slice(0, limit));
    deps.store.deliveries.mockImplementation(async () => [delivery('email')]);
    deps.store.begin.mockResolvedValue('send'); deps.store.receipt.mockResolvedValue(undefined);
    let active = 0; let maximum = 0;
    deps.send.mockImplementation(async () => { active++; maximum = Math.max(maximum, active); await Promise.resolve(); active--; return 'receipt'; });
    const result = await runBookingNotificationWorker(deps);
    expect(result.claimed).toBe(100); expect(result.outcomes).toHaveLength(100);
    expect(deps.store.claim).toHaveBeenCalledTimes(50); expect(deps.send).toHaveBeenCalledTimes(100);
    expect(maximum).toBe(2); expect(new Set(deps.send.mock.calls.map(call => call[0])).size).toBe(100);
});

test('time budget stops new waves and preserves claim exclusions for retryable work', async () => {
    const deps = setup(); let clock = 0;
    deps.store.claim.mockImplementation(async (exclude: string[]) => exclude.length ? [] : [event]);
    deps.send.mockImplementation(async () => { clock = 30_000; throw new ProviderDeliveryError('rate_limited', 'retry'); });
    const result = await runBookingNotificationWorker({ ...deps, now: () => clock });
    expect(result.claimed).toBe(1); expect(deps.store.claim).toHaveBeenCalledTimes(1);
    expect(deps.store.prune).toHaveBeenCalledTimes(1);
});

test('a retry or immediate continuation is excluded for the entire invocation', async () => {
    const deps = setup(); deps.send.mockRejectedValue(new ProviderDeliveryError('provider_config_missing', 'retry'));
    const result = await runBookingNotificationWorker(deps);
    expect(result.outcomes).toEqual(['retry']); expect(deps.send).toHaveBeenCalledTimes(1);
    expect(deps.store.claim).toHaveBeenLastCalledWith([event.id], 2);
});
