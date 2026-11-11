import { createOutboxStore } from '@/lib/notifications/outboxStore';
import type { OutboxEvent } from '@/lib/notifications/outboxTypes';

const event = { id: 'event', lease_token: 'lease' } as OutboxEvent;
test('reads all 200 immutable recipients as a scalar RPC with lease identity', async () => {
    const rows = Array.from({ length: 200 }, (_, index) => ({ delivery_key: `email:${index}`, payload: { text: 'synthetic' } }));
    const rpc = jest.fn().mockResolvedValue({ data: rows, error: null });
    const from = jest.fn();
    const store = createOutboxStore({ rpc, from } as never);
    expect(await store.deliveries(event)).toBe(rows);
    expect(rpc).toHaveBeenCalledWith('read_booking_notification_deliveries', { p_event_id: 'event', p_lease_token: 'lease' });
    expect(from).not.toHaveBeenCalled();
});

test('claims a bounded wave with every already-seen event excluded', async () => {
    const rpc = jest.fn().mockResolvedValue({ data: [event], error: null });
    const store = createOutboxStore({ rpc } as never);
    expect(await store.claim(['previous'], 2)).toEqual([event]);
    expect(rpc).toHaveBeenCalledWith('claim_booking_notification_batch', { p_limit: 2, p_lease_seconds: 90, p_exclude_ids: ['previous'] });
});

test('lease loss and invalid delivery snapshots cannot report delivery success', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: null, error: { message: 'OUTBOX_LEASE_LOST' } })
        .mockResolvedValueOnce({ data: {}, error: null });
    const store = createOutboxStore({ rpc } as never);
    await expect(store.deliveries(event)).rejects.toThrow('OUTBOX_LEASE_LOST');
    await expect(store.deliveries(event)).rejects.toThrow('OUTBOX_DATABASE_FAILED');
});
