import { releaseBlockedAccountDeletions } from '@/lib/accountDeletionService';
import { runDataRetention } from '@/lib/dataRetentionCronService';

jest.mock('@/lib/accountDeletionService', () => ({ releaseBlockedAccountDeletions: jest.fn() }));

type Call = { method: string; args: unknown[] };
type Result = { data?: unknown; count?: number | null; error?: unknown };

/** Table access of the code steps: each from() records its chain and resolves to resolve(table, calls). */
function tables(resolve: (table: string, calls: Call[]) => Result = () => ({ data: [], count: 0, error: null })) {
    const log: Array<{ table: string; calls: Call[] }> = [];
    const from = jest.fn((table: string) => {
        const calls: Call[] = [];
        log.push({ table, calls });
        const chain: Record<string, unknown> = {};
        for (const method of ['select', 'update', 'delete', 'eq', 'gte', 'lt', 'in']) {
            chain[method] = (...args: unknown[]) => { calls.push({ method, args }); return chain; };
        }
        chain.then = (done: (value: unknown) => unknown) => Promise.resolve(done({ data: null, count: null, error: null, ...resolve(table, calls) }));
        return chain;
    });
    return { from, log };
}

const NEW_COUNTERS = { blocked_deletions_released: 0, deleted_accounts_analytics_anonymized: 0 };

beforeEach(() => {
    jest.mocked(releaseBlockedAccountDeletions).mockReset().mockResolvedValue(0);
});

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
            supabase: { rpc, from: tables().from } as never,
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
                ...NEW_COUNTERS,
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
            supabase: { rpc, from: tables().from } as never,
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
                ...NEW_COUNTERS,
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
        const result = await runDataRetention({ supabase: { rpc, from: tables().from } as never });
        expect(result).toMatchObject({ ok: false, status: 500, details: { api_metrics_error: 'Cleanup count is unconfirmed', accounts_deleted: 0 } });
    });

    test('retains committed counters and stops after an uncertain transport failure without replay', async () => {
        const rpc = jest.fn().mockResolvedValueOnce({ data: 4, error: null }).mockRejectedValueOnce(new Error('lost response'));
        const result = await runDataRetention({ supabase: { rpc, from: tables().from } as never });
        expect(result).toMatchObject({ ok: false, details: { api_metrics_deleted: 4, finance_logs_error: 'Cleanup outcome is unconfirmed' } });
        expect(rpc).toHaveBeenCalledTimes(2);
    });

    test('clears client_id of analytics events of recently deleted accounts and removes rows an update cannot touch', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: 0, error: null });
        const ids = Array.from({ length: 150 }, (_, i) => ({ user_id: `deleted-${i}` }));
        let updates = 0;
        const { from, log } = tables((table, calls) => {
            if (table === 'account_deletion_requests') return { data: ids };
            if (calls[0]?.method === 'update') {
                updates += 1;
                return updates === 2 ? { error: { code: '23514', message: 'analytics_events_bounded' } } : { count: 5 };
            }
            if (calls[0]?.method === 'delete' && calls.some(c => c.method === 'in')) return { count: 2 };
            return { count: 0 };
        });
        const result = await runDataRetention({ supabase: { rpc, from } as never });
        expect(result).toMatchObject({ ok: true, data: { deleted_accounts_analytics_anonymized: 7 } });
        const lookup = log.find(entry => entry.table === 'account_deletion_requests')!;
        expect(lookup.calls).toContainEqual({ method: 'eq', args: ['status', 'completed'] });
        const writes = log.filter(entry => entry.table === 'analytics_events' && entry.calls.some(c => c.method === 'in'));
        expect(writes.map(entry => entry.calls[0])).toEqual([
            { method: 'update', args: [{ client_id: null }, { count: 'exact' }] },
            { method: 'update', args: [{ client_id: null }, { count: 'exact' }] },
            { method: 'delete', args: [{ count: 'exact' }] },
        ]);
        expect((writes[0].calls[1].args[1] as string[]).length).toBe(100);
        expect(writes[2].calls[1].args[1]).toEqual(ids.slice(100).map(row => row.user_id));
    });

    test('a failed analytics write is reported and the other steps keep their results', async () => {
        const rpc = jest.fn().mockResolvedValue({ data: 1, error: null });
        const { from } = tables((table, calls) => table === 'account_deletion_requests' ? { data: [{ user_id: 'gone' }] }
            : calls[0]?.method === 'update' ? { error: { code: '57014', message: 'statement timeout' } } : { count: 3 });
        jest.mocked(releaseBlockedAccountDeletions).mockResolvedValue(2);
        const result = await runDataRetention({ supabase: { rpc, from } as never });
        expect(result).toMatchObject({ ok: false, status: 500, details: {
            accounts_deleted: 1, blocked_deletions_released: 2,
            deleted_accounts_analytics_error: 'statement timeout',
        } });
    });

    test('blocked deletion requests are released after finalize, and a release failure does not stop the run', async () => {
        const order: string[] = [];
        const rpc = jest.fn(async (name: string) => { order.push(name); return { data: 0, error: null }; });
        jest.mocked(releaseBlockedAccountDeletions).mockImplementation(async () => { order.push('release'); throw new Error('auth down'); });
        const supabase = { rpc, from: tables().from };
        const result = await runDataRetention({ supabase: supabase as never });
        expect(order.indexOf('release')).toBeGreaterThan(order.indexOf('finalize_due_account_deletions'));
        expect(releaseBlockedAccountDeletions).toHaveBeenCalledWith(supabase);
        expect(result).toMatchObject({ ok: false, details: {
            blocked_deletions_error: 'Blocked account deletions were not released', deleted_accounts_analytics_anonymized: 0,
        } });
    });
});
