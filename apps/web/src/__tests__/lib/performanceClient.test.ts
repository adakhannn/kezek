/** @jest-environment jsdom
 * @jest-environment-options {"url":"https://unit.invalid/booking/private-id?token=do-not-export"}
 */
import { sendFrontendMetric } from '@/lib/performanceClient';
import { measurePerformance } from '@/lib/performance';

const originalFetch = global.fetch;
const originalBeacon = navigator.sendBeacon;
let beacon: jest.Mock;
beforeEach(() => {
    beacon = jest.fn().mockReturnValue(true);
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: beacon });
    global.fetch = jest.fn().mockResolvedValue({ ok: true });
});
afterEach(() => {
    global.fetch = originalFetch;
    Object.defineProperty(navigator, 'sendBeacon', { configurable: true, value: originalBeacon });
    jest.useRealTimers();
});

test('sends only operation/value/success; the browser URL and metadata never enter the payload', async () => {
    const result = { data: [], error: null };
    expect(await measurePerformance('get_free_slots_page_v1', async () => result, { bookingId: 'private-id', token: 'do-not-export' })).toBe(result);
    expect(beacon).toHaveBeenCalledTimes(1);
    const [url, blob] = beacon.mock.calls[0];
    expect(url).toBe('/api/metrics/frontend');
    const content = await new Promise<string>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(blob);
    });
    expect(JSON.parse(content)).toEqual({ operation: 'get_free_slots_page_v1', value: expect.any(Number), success: true });
    expect(content).not.toMatch(/private-id|do-not-export|token|metadata|timestamp/);
    expect(global.fetch).not.toHaveBeenCalled();
});

test('resolved RPC error is sent as a client failure', async () => {
    await measurePerformance('get_free_slots_service_day_v2', async () => ({ data: null, error: new Error('unit') }));
    const content = await new Promise<string>(resolve => {
        const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.readAsText(beacon.mock.calls[0][1]);
    });
    expect(JSON.parse(content).success).toBe(false);
});

test('an unaccepted beacon falls back once to bounded fetch and cannot hang the operation', async () => {
    jest.useFakeTimers();
    beacon.mockReturnValue(false);
    global.fetch = jest.fn().mockReturnValue(new Promise(() => undefined));
    const pending = sendFrontendMetric({ operation: 'CLS', value: 0.1, success: true });
    await jest.advanceTimersByTimeAsync(500);
    await pending;
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect((global.fetch as jest.Mock).mock.calls[0][1].signal.aborted).toBe(true);
});

test('cannot submit a forged server operation even if a caller bypasses TypeScript', async () => {
    await sendFrontendMetric({ operation: 'shift_close', value: 10, success: true } as never);
    expect(beacon).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
});
