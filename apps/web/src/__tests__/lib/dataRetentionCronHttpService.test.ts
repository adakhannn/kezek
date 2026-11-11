jest.mock('@/lib/cronExecutionTracking', () => ({ trackCronExecution: jest.fn((_job: string, action: () => Promise<Response>) => action()) }));
jest.mock('@/lib/dataRetentionCronService', () => ({
    runDataRetention: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { runDataRetention } from '@/lib/dataRetentionCronService';
import { getServiceClient } from '@/lib/supabaseService';

describe('dataRetentionCronHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue({ rpc: jest.fn() });
    });

    test('returns auth error for invalid secret', async () => {
        const { runDataRetentionCronHttp } = await import('@/lib/dataRetentionCronHttpService');

        const response = await runDataRetentionCronHttp(
            new Request('http://localhost/api/cron/data-retention'),
            'test-secret',
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });

    test('delegates to data retention service for authorized request', async () => {
        (runDataRetention as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'done', api_metrics_deleted: 2 },
        });
        const { runDataRetentionCronHttp } = await import('@/lib/dataRetentionCronHttpService');

        const response = await runDataRetentionCronHttp(
            new Request('http://localhost/api/cron/data-retention', {
                headers: { authorization: 'Bearer test-secret' },
            }),
            'test-secret',
        );
        const body = await response.json();

        expect(runDataRetention).toHaveBeenCalledWith({
            supabase: expect.any(Object),
        });
        expect(response.status).toBe(200);
        expect(body.data.api_metrics_deleted).toBe(2);
    });

    test('partial cleanup is an HTTP failure with committed counters preserved', async () => {
        (runDataRetention as jest.Mock).mockResolvedValue({ ok: false, error: 'internal', status: 500,
            message: 'Some data retention steps failed', details: { api_metrics_deleted: 2, finance_logs_error: 'failed' } });
        const { runDataRetentionCronHttp } = await import('@/lib/dataRetentionCronHttpService');
        const response = await runDataRetentionCronHttp(new Request('http://localhost/api/cron/data-retention', {
            headers: { authorization: 'Bearer test-secret' },
        }), 'test-secret');
        expect(response.status).toBe(500);
        expect(await response.json()).toMatchObject({ ok: false, details: { api_metrics_deleted: 2, finance_logs_error: 'failed' } });
    });
}
);
