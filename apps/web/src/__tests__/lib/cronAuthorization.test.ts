jest.mock('@/lib/cronExecutionHealth', () => ({ readCronExecutionHealth: jest.fn().mockResolvedValue([]) }));
jest.mock('@/lib/cronExecutionTracking', () => ({ trackCronExecution: jest.fn((_job: string, action: () => Promise<Response>) => action()) }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));
jest.mock('@/lib/analyticsDailyCronService', () => ({ runAnalyticsDailyCron: jest.fn() }));
jest.mock('@/lib/analyticsHourlyLoadCronService', () => ({ recalcHourlyForDate: jest.fn() }));
jest.mock('@/lib/dataRetentionCronService', () => ({ runDataRetention: jest.fn() }));
jest.mock('@/lib/recalculateRatingsCronService', () => ({ runRecalculateRatingsCron: jest.fn() }));
jest.mock('@/lib/healthCheckAlertsCronService', () => ({ runHealthCheckAlerts: jest.fn() }));
jest.mock('@/lib/closeShiftsCronService', () => ({ runCloseShiftsCron: jest.fn() }));
jest.mock('@/lib/alerts', () => ({ sendAlertEmail: jest.fn() }));

import { isAuthorizedCronRequest } from '@/lib/cronAuthorization';
import { trackCronExecution } from '@/lib/cronExecutionTracking';
import { getServiceClient } from '@/lib/supabaseService';
import { runAnalyticsDailyCron } from '@/lib/analyticsDailyCronService';
import { recalcHourlyForDate } from '@/lib/analyticsHourlyLoadCronService';
import { runDataRetention } from '@/lib/dataRetentionCronService';
import { runRecalculateRatingsCron } from '@/lib/recalculateRatingsCronService';
import { runHealthCheckAlerts } from '@/lib/healthCheckAlertsCronService';
import { runCloseShiftsCron } from '@/lib/closeShiftsCronService';
import { sendAlertEmail } from '@/lib/alerts';
import { runAnalyticsDailyCronHttp } from '@/lib/analyticsDailyCronHttpService';
import { runAnalyticsHourlyLoadCronHttp } from '@/lib/analyticsHourlyLoadCronHttpService';
import { runDataRetentionCronHttp } from '@/lib/dataRetentionCronHttpService';
import { runRecalculateRatingsCronHttp } from '@/lib/recalculateRatingsCronHttpService';
import { runHealthCheckAlertsCronHttp } from '@/lib/healthCheckAlertsCronHttpService';
import { runCloseShiftsCronHttp } from '@/lib/closeShiftsCronHttpService';

const request = (header?: string) => new Request('http://localhost/api/cron/test', {
    headers: header === undefined ? {} : { authorization: header },
});
const originalSecret = process.env.CRON_SECRET;
const originalFallback = process.env.VERCEL_CRON_SECRET;
afterAll(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
    if (originalFallback === undefined) delete process.env.VERCEL_CRON_SECRET;
    else process.env.VERCEL_CRON_SECRET = originalFallback;
});
beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.CRON_SECRET;
    delete process.env.VERCEL_CRON_SECRET;
});

const handlers = [
    ['analytics daily', runAnalyticsDailyCronHttp],
    ['analytics hourly', runAnalyticsHourlyLoadCronHttp],
    ['data retention', runDataRetentionCronHttp],
    ['ratings', runRecalculateRatingsCronHttp],
    ['health alerts', runHealthCheckAlertsCronHttp],
    ['close shifts', runCloseShiftsCronHttp],
] as const;

describe.each(handlers)('%s rejects before dependencies', (_name, handler) => {
    test.each([
        [undefined, 'Bearer undefined'],
        ['', 'Bearer '],
        ['   ', 'Bearer    '],
        [' secret ', 'Bearer  secret '],
        ['test-secret', undefined],
        ['test-secret', 'Bearer wrong-value'],
        ['test-secret', 'Basic test-secret'],
    ])('denies secret=%j and header=%j', async (secret, header) => {
        if (secret !== undefined) process.env.CRON_SECRET = secret;
        const result = await handler(request(header), secret);
        expect(result.status).toBe(401);
        expect((await result.json()).error).toBe('auth');
        for (const dependency of [trackCronExecution, getServiceClient, runAnalyticsDailyCron, recalcHourlyForDate,
            runDataRetention, runRecalculateRatingsCron, runHealthCheckAlerts, runCloseShiftsCron, sendAlertEmail]) {
            expect(dependency).not.toHaveBeenCalled();
        }
    });
});

test('accepts only the complete configured bearer and does not trim the caller credential', () => {
    expect(isAuthorizedCronRequest(request('Bearer test-secret'), 'test-secret')).toBe(true);
    expect(isAuthorizedCronRequest(request('Bearer test-secreu'), 'test-secret')).toBe(false);
    expect(isAuthorizedCronRequest(request('Bearer  test-secret'), 'test-secret')).toBe(false);
});

test('environment-backed handlers read current configuration, including fallback, at request time', async () => {
    (runRecalculateRatingsCron as jest.Mock).mockResolvedValue({ ok: true, data: {} });
    (runHealthCheckAlerts as jest.Mock).mockResolvedValue({ ok: true, data: {} });
    process.env.VERCEL_CRON_SECRET = 'fallback-secret';
    expect((await runRecalculateRatingsCronHttp(request('Bearer fallback-secret'))).status).toBe(200);
    expect((await runHealthCheckAlertsCronHttp(request('Bearer fallback-secret'))).status).toBe(200);
    delete process.env.VERCEL_CRON_SECRET;
    jest.clearAllMocks();
    expect((await runRecalculateRatingsCronHttp(request('Bearer fallback-secret'))).status).toBe(401);
    expect((await runHealthCheckAlertsCronHttp(request('Bearer fallback-secret'))).status).toBe(401);
    expect(getServiceClient).not.toHaveBeenCalled();
});
