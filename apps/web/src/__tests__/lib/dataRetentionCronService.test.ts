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
            .mockResolvedValueOnce({ data: 60, error: null })
            .mockResolvedValueOnce({ data: 2, error: null })
            .mockResolvedValueOnce({ data: 3, error: null })
            .mockResolvedValueOnce({ data: 4, error: null });

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
                accounts_deleted: 2,
                booking_notification_payloads_pruned: 3,
                whatsapp_inbox_payloads_pruned: 4,
            },
        });
        expect(rpc).toHaveBeenCalledWith('prune_booking_notifications', { p_limit: 100 });
        expect(rpc).toHaveBeenCalledWith('prune_whatsapp_inbox', { p_limit: 100 });
    });

    test('preserves partial counters and fails when RPC returns error objects', async () => {
        const rpc = jest
            .fn()
            .mockResolvedValueOnce({ data: null, error: { message: 'api fail' } })
            .mockResolvedValueOnce({ data: 20, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'funnel fail' } })
            .mockResolvedValueOnce({ data: 40, error: null })
            .mockResolvedValueOnce({ data: null, error: { message: 'profiles fail' } })
            .mockResolvedValueOnce({ data: null, error: { message: 'telegram attempts fail' } })
            .mockResolvedValueOnce({ data: null, error: { message: 'account deletion fail' } })
            .mockResolvedValueOnce({ data: null, error: { message: 'outbox prune fail' } })
            .mockResolvedValueOnce({ data: null, error: { message: 'inbox prune fail' } });

        const result = await runDataRetention({
            supabase: { rpc } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'Some data retention steps failed',
            status: 500,
            details: {
                api_metrics_error: 'api fail',
                finance_logs_deleted: 20,
                funnel_events_error: 'funnel fail',
                bookings_pii_anonymized: 40,
                profiles_pii_error: 'profiles fail',
                telegram_mobile_attempts_error: 'telegram attempts fail',
                account_deletions_error: 'account deletion fail',
                booking_notification_retention_error: 'outbox prune fail',
                whatsapp_inbox_retention_error: 'inbox prune fail',
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
            message: 'Data retention outcome is unconfirmed',
            status: 500,
            details: { api_metrics_error: 'Cleanup outcome is unconfirmed' },
        });
    });

    test.each([null, undefined, -1, 1.2, '10', Number.NaN])('does not invent a zero count for %s', async value => {
        const rpc = jest.fn().mockResolvedValue({ data: 0, error: null })
            .mockResolvedValueOnce({ data: value, error: null });
        const result = await runDataRetention({ supabase: { rpc } });
        expect(result).toMatchObject({ ok: false, status: 500, details: { api_metrics_error: 'Cleanup count is unconfirmed', accounts_deleted: 0 } });
    });

    test('retains committed counters and stops after an uncertain transport failure without replay', async () => {
        const rpc = jest.fn().mockResolvedValueOnce({ data: 4, error: null }).mockRejectedValueOnce(new Error('lost response'));
        const result = await runDataRetention({ supabase: { rpc } });
        expect(result).toMatchObject({ ok: false, details: { api_metrics_deleted: 4, finance_logs_error: 'Cleanup outcome is unconfirmed' } });
        expect(rpc).toHaveBeenCalledTimes(2);
    });
});
