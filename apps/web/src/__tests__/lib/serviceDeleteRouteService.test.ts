import { runServiceDeleteRoute } from '@/lib/serviceDeleteRouteService';

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';

describe('serviceDeleteRouteService', () => {
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns not_found when service is missing', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: null,
            error: 'Resource not found',
        });

        const result = await runServiceDeleteRoute({
            admin,
            bizId: 'biz-1',
            serviceId: 'service-1',
        });

        expect(result).toEqual({
            ok: false,
            status: 404,
            error: 'not_found',
            message: 'Услуга не найдена',
        });
    });

    test('returns conflict when future bookings exist', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: 'service-1', biz_id: 'biz-1' },
            error: null,
        });
        admin.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [{ id: 'booking-1' }],
                count: 1,
                error: null,
            }),
        });

        const result = await runServiceDeleteRoute({
            admin,
            bizId: 'biz-1',
            serviceId: 'service-1',
        });

        expect(result).toMatchObject({
            ok: false,
            status: 409,
            error: 'conflict',
        });
    });

    // DB-14: past bookings are never deleted; a service with history or a sold plan is switched off.
    function setupDelete({ plans = 0, deleteError = null }: { plans?: number; deleteError?: { code: string; message: string } | null }) {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({ data: { id: 'service-1', biz_id: 'biz-1' }, error: null });
        const calls: Array<[string, string, unknown?]> = [];
        admin.from.mockImplementation((table: string) => {
            const chain: Record<string, unknown> = {};
            for (const method of ['select', 'eq', 'gte', 'neq', 'lt', 'limit', 'maybeSingle']) chain[method] = jest.fn(() => chain);
            chain.maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'service-1', biz_id: 'biz-1' }, error: null });
            chain.delete = jest.fn(() => { calls.push([table, 'delete']); return chain; });
            chain.update = jest.fn((values: unknown) => { calls.push([table, 'update', values]); return chain; });
            chain.then = (resolve: (value: unknown) => unknown) => {
                const last = calls[calls.length - 1];
                if (table === 'bookings') return Promise.resolve({ data: [], count: 0, error: null }).then(resolve);
                if (table === 'visit_package_plans') return Promise.resolve({ count: plans, error: null }).then(resolve);
                if (last?.[0] === 'services' && last[1] === 'delete') return Promise.resolve({ error: deleteError }).then(resolve);
                return Promise.resolve({ error: null }).then(resolve);
            };
            return chain;
        });
        return calls;
    }

    test('a service without history is deleted and no booking is touched', async () => {
        const calls = setupDelete({});
        await expect(runServiceDeleteRoute({ admin, bizId: 'biz-1', serviceId: 'service-1', now: '2026-03-27T10:00:00.000Z' })).resolves.toEqual({ ok: true });
        expect(calls).toEqual([['services', 'delete']]);
    });

    test('a service with past bookings is switched off instead (foreign key)', async () => {
        const calls = setupDelete({ deleteError: { code: '23503', message: 'violates foreign key constraint "bookings_service_id_fkey"' } });
        await expect(runServiceDeleteRoute({ admin, bizId: 'biz-1', serviceId: 'service-1', now: '2026-03-27T10:00:00.000Z' })).resolves.toEqual({ ok: true, archived: true });
        expect(calls).toEqual([['services', 'delete'], ['services', 'update', { active: false }]]);
    });

    test('a service sold in a visit package plan is switched off without a delete attempt', async () => {
        const calls = setupDelete({ plans: 1 });
        await expect(runServiceDeleteRoute({ admin, bizId: 'biz-1', serviceId: 'service-1', now: '2026-03-27T10:00:00.000Z' })).resolves.toEqual({ ok: true, archived: true });
        expect(calls).toEqual([['services', 'update', { active: false }]]);
    });
});
