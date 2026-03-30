import { runServiceUpdateFlow } from '@/lib/serviceUpdateRouteService';

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { createMockSupabase } from '../api/testHelpers';

describe('serviceUpdateRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('updates, inserts and removes branch copies successfully', async () => {
        const admin = createMockSupabase();
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: 'service-id', biz_id: 'biz-id', name_ru: 'Massage' },
        });

        admin.from.mockImplementation((table: string) => {
            if (table === 'branches') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [{ id: 'branch-1' }, { id: 'branch-2' }],
                        error: null,
                    }),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { name: 'Branch 3' },
                        error: null,
                    }),
                };
            }

            if (table === 'services') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [
                            { id: 'service-1', branch_id: 'branch-1' },
                            { id: 'service-3', branch_id: 'branch-3' },
                        ],
                        error: null,
                    }),
                    update: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockResolvedValue({ error: null }),
                    delete: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'service-3' },
                        error: null,
                    }),
                };
            }

            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    neq: jest.fn().mockResolvedValue({
                        count: 0,
                        error: null,
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await runServiceUpdateFlow({
            admin: admin as never,
            bizId: 'biz-id',
            serviceId: 'service-id',
            body: {
                name_ru: 'Massage',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
                active: true,
                branch_ids: ['branch-1', 'branch-2'],
            },
        });

        expect(result).toEqual({ ok: true });
    });

    test('returns conflict when removed branch still has future bookings', async () => {
        const admin = createMockSupabase();
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValue({
            data: { id: 'service-id', biz_id: 'biz-id', name_ru: 'Massage' },
        });

        let servicesCall = 0;
        admin.from.mockImplementation((table: string) => {
            if (table === 'branches') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    in: jest.fn().mockResolvedValue({
                        data: [{ id: 'branch-1' }],
                        error: null,
                    }),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { name: 'Branch 2' },
                        error: null,
                    }),
                };
            }

            if (table === 'services') {
                servicesCall += 1;
                if (servicesCall === 1) {
                    let eqCalls = 0;
                    return {
                        select: jest.fn().mockReturnThis(),
                        eq: jest.fn().mockImplementation(function () {
                            eqCalls += 1;
                            if (eqCalls >= 2) {
                                return Promise.resolve({
                                    data: [
                                        { id: 'service-1', branch_id: 'branch-1' },
                                        { id: 'service-2', branch_id: 'branch-2' },
                                    ],
                                });
                            }
                            return this;
                        }),
                        insert: jest.fn().mockResolvedValue({ error: null }),
                    };
                }

                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    update: jest.fn().mockReturnThis(),
                    insert: jest.fn().mockResolvedValue({ error: null }),
                    in: jest.fn().mockResolvedValue({ error: null }),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'service-2' },
                        error: null,
                    }),
                };
            }

            if (table === 'bookings') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    gte: jest.fn().mockReturnThis(),
                    neq: jest.fn().mockResolvedValue({
                        count: 2,
                        error: null,
                    }),
                };
            }

            throw new Error(`Unexpected table ${table}`);
        });

        const result = await runServiceUpdateFlow({
            admin: admin as never,
            bizId: 'biz-id',
            serviceId: 'service-id',
            body: {
                name_ru: 'Massage',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
                active: true,
                branch_ids: ['branch-1'],
            },
        });

        expect(result).toEqual({
            ok: false,
            error: 'conflict',
            message:
                'Невозможно отвязать услугу от филиала "Branch 2": к нему привязаны будущие брони. Сначала отмените или удалите все будущие брони.',
            details: { branches: ['Branch 2'] },
            status: 409,
        });
    });
});
