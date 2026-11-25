jest.mock('@/lib/cronExecutionTracking', () => ({ trackCronExecution: jest.fn((_job: string, action: () => Promise<Response>) => action()) }));
import { GET } from '@/app/api/cron/booking-notifications/route';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
import { runBookingNotificationWorker } from '@/lib/notifications/outboxWorker';

jest.mock('@/lib/notifications/outboxStore', () => ({ createOutboxAdminClient: jest.fn(), createOutboxStore: jest.fn() }));
jest.mock('@/lib/notifications/outboxWorker', () => ({ runBookingNotificationWorker: jest.fn() }));
jest.mock('@/lib/notifications/BookingNotificationPlanner', () => ({ planBookingNotifications: jest.fn() }));
jest.mock('@/lib/notifications/outboxTransport', () => ({ sendOutboxDelivery: jest.fn() }));
jest.mock('@/lib/pushTokens', () => ({ removeInvalidPushToken: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
import { logError } from '@/lib/log';
import { planBookingNotifications } from '@/lib/notifications/BookingNotificationPlanner';
import { sendOutboxDelivery } from '@/lib/notifications/outboxTransport';
import { removeInvalidPushToken } from '@/lib/pushTokens';

beforeEach(() => { jest.clearAllMocks(); process.env.CRON_SECRET = 'synthetic-cron'; delete process.env.VERCEL_CRON_SECRET; delete process.env.BOOKING_NOTIFICATION_WORKER_ENABLED; });
test.each(['', ' ', ' padded '])('invalid configured secret %j cannot claim work', async secret => {
    process.env.CRON_SECRET = secret;
    expect((await GET(new Request('http://localhost', { headers: { authorization: `Bearer ${secret}` } }))).status).toBe(401);
    expect(createOutboxAdminClient).not.toHaveBeenCalled();
});
test('missing bearer cannot claim even when enabled', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    expect((await GET(new Request('http://localhost'))).status).toBe(401);
    expect(runBookingNotificationWorker).not.toHaveBeenCalled();
});
test('deployment defaults to disabled and never constructs a service client', async () => {
    const result = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    expect(await result.json()).toEqual({ ok: true, enabled: false });
    expect(createOutboxAdminClient).not.toHaveBeenCalled();
});
test('authorized enabled invocation returns bounded worker outcomes', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    jest.mocked(runBookingNotificationWorker).mockResolvedValue({ claimed: 2, outcomes: ['sent', 'failed'], errors: 0, pruned: 1 });
    const result = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    expect(await result.json()).toEqual({ ok: true, enabled: true, claimed: 2, outcomes: ['sent', 'failed'], errors: 0, pruned: 1 });
    expect(runBookingNotificationWorker).toHaveBeenCalledTimes(1);
    expect(logError).not.toHaveBeenCalled();
});
test('a worker failure keeps the 503 body and logs the thrown error (ARCH-04)', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    const failure = new Error('outbox claim timed out');
    jest.mocked(runBookingNotificationWorker).mockRejectedValue(failure);
    const result = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ ok: false, error: 'outbox_worker_failed' });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('BookingNotificationsCron', 'Outbox worker failed', failure);
});
test('a run with worker errors is reported as failed to cron tracking (R25-13)', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    jest.mocked(runBookingNotificationWorker).mockResolvedValue({ claimed: 2, outcomes: ['sent', 'retry'], errors: 1, pruned: 0 });
    const result = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    expect(result.status).toBe(503);
    expect(await result.json()).toEqual({ ok: false, enabled: true, claimed: 2, outcomes: ['sent', 'retry'], errors: 1, pruned: 0 });
    expect(logError).toHaveBeenCalledWith('BookingNotificationsCron', 'Outbox worker finished with errors', { claimed: 2, errors: 1 });
});

test('the run receipt carries how many reminders were enqueued; the worker gets the real planner', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    jest.mocked(runBookingNotificationWorker).mockResolvedValue({ claimed: 1, outcomes: ['sent'], errors: 0, pruned: 0, reminders: 5 });
    const result = await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual({ ok: true, enabled: true, claimed: 1, outcomes: ['sent'], errors: 0, pruned: 0, reminders: 5 });
    const deps = jest.mocked(runBookingNotificationWorker).mock.calls[0][0];
    await deps.plan({ id: 'booking' } as never, 'reminder_24h');
    expect(planBookingNotifications).toHaveBeenCalledWith(undefined, { id: 'booking' }, 'reminder_24h');
});
test('sends through the transport with a remover for tokens Expo no longer knows', async () => {
    process.env.BOOKING_NOTIFICATION_WORKER_ENABLED = 'true';
    const admin = { synthetic: 'admin' };
    jest.mocked(createOutboxAdminClient).mockReturnValue(admin as never);
    jest.mocked(runBookingNotificationWorker).mockResolvedValue({ claimed: 0, outcomes: [], errors: 0, pruned: 0, reminders: 0 });
    await GET(new Request('http://localhost', { headers: { authorization: 'Bearer synthetic-cron' } }));
    const { send } = jest.mocked(runBookingNotificationWorker).mock.calls[0][0];
    const delivery = { delivery_key: 'push:x', channel: 'push' } as never;
    await send('event', delivery);
    const [eventId, sent, fetchImpl, options] = jest.mocked(sendOutboxDelivery).mock.calls[0];
    expect([eventId, sent, fetchImpl]).toEqual(['event', delivery, fetch]);
    await options!.removePushToken!('ExponentPushToken[synthetic]');
    expect(removeInvalidPushToken).toHaveBeenCalledWith(admin, 'ExponentPushToken[synthetic]');
});
