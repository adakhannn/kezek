import { readBackgroundQueueHealth } from '@/lib/backgroundQueueHealth';

const empty = { pending: 0, due: 0, processing: 0, failed: 0, ambiguous: 0, oldest_due_age_seconds: 0 };
function dependency(data: unknown = empty, error: unknown = null) {
    const abortSignal = jest.fn().mockResolvedValue({ data, error });
    const rpc = jest.fn().mockReturnValue({ abortSignal });
    return { client: { rpc } as unknown as Parameters<typeof readBackgroundQueueHealth>[0], rpc, abortSignal };
}
const enabled = { BOOKING_NOTIFICATION_WORKER_ENABLED: 'true', WHATSAPP_INBOX_WORKER_ENABLED: 'true' };

test('disabled workers expose unknown counts without querying the database', async () => {
    const dep = dependency();
    expect(await readBackgroundQueueHealth(dep.client, {})).toEqual([
        { job: 'booking-notifications', status: 'disabled', counts: null },
        { job: 'whatsapp-inbox', status: 'disabled', counts: null },
    ]);
    expect(dep.rpc).not.toHaveBeenCalled();
});
test('enabled workers read both authoritative aggregates with a cancellation signal', async () => {
    const dep = dependency();
    const result = await readBackgroundQueueHealth(dep.client, enabled);
    expect(dep.rpc.mock.calls).toEqual([['booking_notification_backlog_health'], ['whatsapp_inbox_backlog_health']]);
    expect(dep.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
    expect(result.map(q => q.status)).toEqual(['healthy', 'healthy']);
});
test.each([
    [{ due: 1, oldest_due_age_seconds: 300 }, 'healthy'],
    [{ due: 1, oldest_due_age_seconds: 301 }, 'backlog'],
    [{ failed: 1 }, 'failed'],
    [{ ambiguous: 1 }, 'failed'],
])('distinguishes delayed work and unresolved delivery: %j', async (counts, status) => {
    const dep = dependency({ ...empty, ...counts });
    const [result] = await readBackgroundQueueHealth(dep.client, enabled);
    expect(result.status).toBe(status);
    expect(result.counts).toEqual({ ...empty, ...counts });
});
test.each([null, [], {}, { ...empty, due: -1 }, { ...empty, pending: 1.5 },
    { ...empty, failed: '0' }, { ...empty, oldest_due_age_seconds: Infinity }])('invalid aggregate cannot look healthy: %j', async data => {
    const dep = dependency(data);
    await expect(readBackgroundQueueHealth(dep.client, enabled)).rejects.toThrow('QUEUE_HEALTH_UNAVAILABLE');
});
test('database error cannot turn into a healthy empty queue', async () => {
    const dep = dependency(empty, { message: 'unavailable' });
    await expect(readBackgroundQueueHealth(dep.client, enabled)).rejects.toThrow('QUEUE_HEALTH_UNAVAILABLE');
});
