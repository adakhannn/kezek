jest.mock('@/lib/notifications/outboxStore', () => ({ createOutboxAdminClient: jest.fn(() => ({})) }));
jest.mock('@/lib/notifications/outboxTransport', () => ({ sendOutboxDelivery: jest.fn() }));
jest.mock('@/lib/whatsappInbox/store', () => ({ createWhatsAppInboxStore: jest.fn(() => ({})) }));
jest.mock('@/lib/whatsappInbox/worker', () => ({ runWhatsAppInboxWorker: jest.fn() }));
jest.mock('@/lib/cronExecutionTracking', () => ({ trackCronExecution: jest.fn((_name, action) => action()) }));
jest.mock('@/lib/env', () => ({ getWhatsAppPhoneNumberId: jest.fn(() => '123456789') }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn(), logDebug: jest.fn() }));
import { GET } from '@/app/api/cron/whatsapp-inbox/route';
import { createOutboxAdminClient } from '@/lib/notifications/outboxStore';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { logError } from '@/lib/log';
import { runWhatsAppInboxWorker } from '@/lib/whatsappInbox/worker';

const saved = { cron: process.env.CRON_SECRET, vercel: process.env.VERCEL_CRON_SECRET, enabled: process.env.WHATSAPP_INBOX_WORKER_ENABLED };
beforeEach(() => { jest.clearAllMocks(); process.env.CRON_SECRET = 'unit-test-secret'; delete process.env.VERCEL_CRON_SECRET; delete process.env.WHATSAPP_INBOX_WORKER_ENABLED; });
afterAll(() => {
    for (const [key, value] of Object.entries({ CRON_SECRET: saved.cron, VERCEL_CRON_SECRET: saved.vercel, WHATSAPP_INBOX_WORKER_ENABLED: saved.enabled })) {
        if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
});
const request = (value = 'unit-test-secret') => new Request('https://example.invalid/api/cron/whatsapp-inbox', { headers: { authorization: `Bearer ${value}` } });
test.each([undefined, '', ' '])('missing or blank secret rejects before any client/tracking %p', async secret => {
    if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret;
    expect((await GET(request(String(secret)))).status).toBe(401);
    expect(createOutboxAdminClient).not.toHaveBeenCalled(); expect(trackCronExecution).not.toHaveBeenCalled();
});
test('disabled worker does not touch storage or provider', async () => {
    expect(await (await GET(request())).json()).toEqual({ ok: true, enabled: false });
    expect(createOutboxAdminClient).not.toHaveBeenCalled(); expect(runWhatsAppInboxWorker).not.toHaveBeenCalled();
});
test('enabled worker records execution; uncertain DB receipt makes invocation non-success', async () => {
    process.env.WHATSAPP_INBOX_WORKER_ENABLED = 'true';
    const counts = { claimed: 1, sent: 0, deferred: 0, failed: 0, errors: 1 };
    jest.mocked(runWhatsAppInboxWorker).mockResolvedValue(counts);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, enabled: true, ...counts });
    expect(trackCronExecution).toHaveBeenCalledWith('whatsapp-inbox', expect.any(Function));
    // ARCH-04: the unsuccessful run is logged with its counts.
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('WhatsAppInboxCron', 'Inbox worker finished with failures', counts);
});
test('a successful run answers 200 without an error log', async () => {
    process.env.WHATSAPP_INBOX_WORKER_ENABLED = 'true';
    jest.mocked(runWhatsAppInboxWorker).mockResolvedValue({ claimed: 2, sent: 2, deferred: 0, failed: 0, errors: 0 });
    expect((await GET(request())).status).toBe(200);
    expect(logError).not.toHaveBeenCalled();
});
test('a thrown worker error keeps the 503 body and is logged (ARCH-04)', async () => {
    process.env.WHATSAPP_INBOX_WORKER_ENABLED = 'true';
    const failure = new Error('inbox claim failed');
    jest.mocked(runWhatsAppInboxWorker).mockRejectedValue(failure);
    const response = await GET(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'inbox_worker_failed' });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('WhatsAppInboxCron', 'Inbox worker failed', failure);
});
