jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn() }));
import { NextResponse } from 'next/server';
import { trackCronExecution, type CronExecutionStore } from '@/lib/cronExecutionTracking';

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
    const db = store(); db.start.mockRejectedValue(new Error('network'));
    const action = jest.fn();
    expect((await trackCronExecution('close-shifts', action, () => db)).status).toBe(503);
    expect(action).not.toHaveBeenCalled();
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
});
test('failure to persist an exception does not hide the original error', async () => {
    const db = store(); db.finish.mockRejectedValue(new Error('storage'));
    const original = new Error('original');
    await expect(trackCronExecution('close-shifts', async () => { throw original; }, () => db)).rejects.toBe(original);
});
