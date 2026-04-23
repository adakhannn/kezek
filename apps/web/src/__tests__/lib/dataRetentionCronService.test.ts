import { runDataRetention } from '@/lib/dataRetentionCronService';

describe('dataRetentionCronService', () => {
    test('returns aggregated counters for successful cleanup run', async () => {
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({ data: 10, error: null })
            .mockResolvedValueOnce({ data: 20, error: null })
            .mockResolvedValueOnce({ data: 30, error: null })
            .mockResolvedValueOnce({ data: 40, error: null })
            .mockResolvedValueOnce({ data: 50, error: null })
            .mockResolvedValueOnce({ data: 60, error: null });

        const result = await runDataRetention({
            supabase: { rpc } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                message: 'Data retention run completed',
                api_metrics_deleted: 10,
                finance_logs_deleted: 20,
                funnel_events_deleted: 30,
                bookings_pii_anonymized: 40,
                profiles_pii_anonymized: 50,
                telegram_mobile_attempts_deleted: 60,
            },
        });
    });

    test('keeps per-step errors in payload when rpc returns error objects', async () => {
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({ data: null, error: { message: 'api fail' } })
            .mockResolvedValueOnce({ data: 20, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'funnel fail' } })
            .mockResolvedValueOnce({ data: 40, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'profiles fail' } })
            .mockResolvedValueOnce({ data: null, error: { message: 'telegram attempts fail' } });

        const result = await runDataRetention({
            supabase: { rpc } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: {
                message: 'Data retention run completed',
                api_metrics_error: 'api fail',
                finance_logs_deleted: 20,
                funnel_events_error: 'funnel fail',
                bookings_pii_anonymized: 40,
                profiles_pii_error: 'profiles fail',
                telegram_mobile_attempts_error: 'telegram attempts fail',
            },
        });
    });

    test('returns internal error when unexpected exception is thrown', async () => {
        const result = await runDataRetention({
            supabase: {
                rpc: jest.fn().mockRejectedValue(new Error('boom')),
            } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'boom',
            status: 500,
        });
    });
});
