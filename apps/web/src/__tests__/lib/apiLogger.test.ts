import { clearApiLogs, getApiStats, logApiCall } from '@/lib/apiLogger';
import { trackFunnelEvent } from '@/lib/funnelEvents';

beforeEach(() => {
    clearApiLogs();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    jest.replaceProperty(process.env, 'NODE_ENV', 'development');
});
afterEach(() => jest.restoreAllMocks());

test('API diagnostics retain duplicate/status data while hiding credentials in logs and monitor keys', () => {
    jest.spyOn(Date, 'now').mockReturnValue(1000);
    const url = 'https://example.invalid/api/auth?code=synthetic-exchange-secret';
    const options = { duration: 42, body: { password: 'synthetic-password' } };
    logApiCall(url, 'POST', { ...options, status: 200 });
    logApiCall(url, 'POST', { ...options, status: 503 });
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith('[ApiLogger] Duplicate API call detected', expect.objectContaining({ previousCalls: 1, timeSinceLastMs: 0 }));
    expect(console.error).toHaveBeenCalledWith('[ApiLogger] API request completed', expect.objectContaining({ method: 'POST', duration: '42ms', status: 503 }));
    const stats = getApiStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.duplicateCalls).toBe(1);
    const output = JSON.stringify([stats, jest.mocked(console.log).mock.calls, jest.mocked(console.warn).mock.calls, jest.mocked(console.error).mock.calls]);
    expect(output).not.toContain('synthetic-exchange-secret');
    expect(output).not.toContain('synthetic-password');
});

test('API render diagnostics remain disabled in production', () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    logApiCall('https://example.invalid/api', 'GET', { status: 500 });
    expect(getApiStats().totalCalls).toBe(0);
    expect(console.log).not.toHaveBeenCalled();
    expect(console.warn).not.toHaveBeenCalled();
    expect(console.error).not.toHaveBeenCalled();
});

test('funnel network failures keep production warning severity and useful sanitized error details', async () => {
    jest.replaceProperty(process.env, 'NODE_ENV', 'production');
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error access_token=synthetic-credential'));
    await expect(trackFunnelEvent({ event_type: 'booking_success', source: 'public', biz_id: 'synthetic-business', session_id: 'synthetic-session' })).resolves.toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith('[FunnelEvents] Error tracking funnel event', {
        eventType: 'booking_success', error: { name: 'Error', message: 'Network error access_token=[REDACTED]' },
    });
    expect(console.error).not.toHaveBeenCalled();
});
