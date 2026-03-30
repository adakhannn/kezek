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

    test('deletes past bookings and service when no future bookings remain', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: 'service-1', biz_id: 'biz-1' },
            error: null,
        });

        const futureBookingsQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: [],
                count: 0,
                error: null,
            }),
        };
        const deletePastBookingsQuery = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            lt: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };
        const deleteServiceQuery = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        deleteServiceQuery.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2
                ? Promise.resolve({ data: null, error: null })
                : deleteServiceQuery;
        });

        admin.from
            .mockReturnValueOnce(futureBookingsQuery)
            .mockReturnValueOnce(deletePastBookingsQuery)
            .mockReturnValueOnce(deleteServiceQuery);

        const result = await runServiceDeleteRoute({
            admin,
            bizId: 'biz-1',
            serviceId: 'service-1',
            now: '2026-03-27T10:00:00.000Z',
        });

        expect(result).toEqual({ ok: true });
    });
});
