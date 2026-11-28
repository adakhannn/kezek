jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logWarn: jest.fn() }));
import { NextResponse } from 'next/server';
import { createCronExecutionStore, trackCronExecution, type CronExecutionStore } from '@/lib/cronExecutionTracking';
import { logError, logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

beforeEach(() => jest.clearAllMocks());

function store(): jest.Mocked<CronExecutionStore> {
    return { start: jest.fn().mockResolvedValue(undefined), finish: jest.fn().mockResolvedValue(undefined) };
}
test('records execution before work and awaits a durable success receipt', async () => {
    const events: string[] = [];
    const db = store();
    db.start.mockImplementation(async () => { events.push('started'); });
    db.finish.mockImplementation(async () => { events.push('recorded'); });
    const response = await trackCronExecution('close-shifts', async () => {
        events.push('worked'); return NextResponse.json({ ok: true, data: { closed: 2 } });
    }, () => db);
    expect(events).toEqual(['started', 'worked', 'recorded']);
    expect(db.finish).toHaveBeenCalledWith(db.start.mock.calls[0][0], 'succeeded', 200, '');
    expect(await response.json()).toEqual({ ok: true, data: { closed: 2 } });
});
test('missing tracking prevents unrecorded execution', async () => {
    const cause = new Error('network');
    const db = store(); db.start.mockRejectedValue(cause);
    const action = jest.fn();
    expect((await trackCronExecution('close-shifts', action, () => db)).status).toBe(503);
    expect(action).not.toHaveBeenCalled();
    // ARCH-04: the cause of the 503 is logged with the job name, flat (Sentry shows nested objects as [Object]).
    // A single blip is a warning: the job runs on the next tick and the health check flags an overdue job.
    expect(logWarn).toHaveBeenCalledWith('CronExecution', 'Execution tracking is unavailable; job not started',
        expect.objectContaining({ job: 'close-shifts', errorName: 'Error', errorMessage: 'network' }));
    // Reported once, not again as an ApiErrorResponse server error (KEZEK-WEB-8).
    expect(logError).not.toHaveBeenCalled();
});
test('the Supabase cause of a tracking failure is kept and logged at depth 1 (KEZEK-WEB-B/C)', async () => {
    const rpc = jest.fn(() => ({ abortSignal: () => Promise.resolve({ error: { code: '57014', message: 'canceling statement' } }) }));
    (getServiceClient as jest.Mock).mockReturnValue({ rpc });
    const thrown = await createCronExecutionStore().start('id', 'close-shifts').catch((error: Error) => error);
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe('CRON_TRACKING_UNAVAILABLE');
    expect((thrown as Error).cause).toEqual({ code: '57014', message: 'canceling statement' });

    const action = jest.fn();
    const response = await trackCronExecution('close-shifts', action);
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual(expect.objectContaining({ ok: false, error: 'service_unavailable' }));
    expect(action).not.toHaveBeenCalled();
    const [, , context] = (logWarn as jest.Mock).mock.calls[0];
    expect(context).toEqual(expect.objectContaining({
        job: 'close-shifts', code: '57014', causeMessage: 'canceling statement', errorMessage: 'CRON_TRACKING_UNAVAILABLE',
    }));
    expect(Object.values(context).every(value => value === undefined || typeof value !== 'object')).toBe(true);
    expect(logError).not.toHaveBeenCalled();
});
test('a thrown domain error is preserved and recorded as failed', async () => {
    const db = store(); const original = new Error('domain failed');
    await expect(trackCronExecution('close-shifts', async () => { throw original; }, () => db)).rejects.toBe(original);
    expect(db.finish).toHaveBeenCalledWith(expect.any(String), 'failed', 500, 'handler_failed');
});
test.each([
    [500, { ok: false }], [200, { ok: false }], [200, { unconfirmed: true }],
])('HTTP %s and unsuccessful body never become a success receipt', async (status, body) => {
    const db = store();
    const result = await trackCronExecution('close-shifts', async () => NextResponse.json(body, { status }), () => db);
    expect(result.status).toBe(500);
    expect(db.finish).toHaveBeenCalledWith(expect.any(String), 'failed', 500, 'handler_unsuccessful');
});
test('failure to persist a completed result exposes uncertainty and never replays work', async () => {
    const db = store(); db.finish.mockRejectedValue(new Error('network'));
    const action = jest.fn(async () => NextResponse.json({ ok: true }));
    expect((await trackCronExecution('close-shifts', action, () => db)).status).toBe(503);
    expect(action).toHaveBeenCalledTimes(1);
    // Uncertain outcome stays an error, reported once with the flat cause.
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith('CronExecution', 'Job finished but receipt is unavailable',
        expect.objectContaining({ job: 'close-shifts', errorMessage: 'network' }));
});
test('failure to persist an exception does not hide the original error', async () => {
    const db = store(); db.finish.mockRejectedValue(new Error('storage'));
    const original = new Error('original');
    await expect(trackCronExecution('close-shifts', async () => { throw original; }, () => db)).rejects.toBe(original);
});
