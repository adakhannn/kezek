import { listCurrentUserVisitPackages } from '@/lib/meVisitPackagesService';

describe('meVisitPackagesService', () => {
    test('returns empty list when user has no packages', async () => {
        const query = Promise.resolve({
            data: [],
            error: null,
        });

        const admin = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockReturnValue(query),
                    }),
                }),
            }),
        };

        const result = await listCurrentUserVisitPackages({
            admin: admin as never,
            user: { id: 'user-1' },
            includeAll: true,
            today: '2026-03-27',
        });

        expect(result).toEqual({
            ok: true,
            data: { packages: [] },
        });
    });

    test('returns mapped package data with plan details', async () => {
        const orderedQuery = Promise.resolve({
            data: [
                {
                    id: 'pkg-1',
                    client_id: 'user-1',
                    plan_id: 'plan-1',
                    remaining_visits: 3,
                    valid_until: '2026-04-10',
                    purchased_at: '2026-03-01',
                    created_at: '2026-03-01',
                },
            ],
            error: null,
        });

        const visitPackagesFrom = {
            select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                    order: jest.fn().mockReturnValue(orderedQuery),
                }),
            }),
        };

        const visitPackagePlansFrom = {
            select: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                    data: [
                        {
                            id: 'plan-1',
                            name_ru: 'Пакет 10',
                            name_ky: null,
                            name_en: 'Package 10',
                            visit_count: 10,
                        },
                    ],
                }),
            }),
        };

        const admin = {
            from: jest
                .fn()
                .mockReturnValueOnce(visitPackagesFrom)
                .mockReturnValueOnce(visitPackagePlansFrom),
        };

        const result = await listCurrentUserVisitPackages({
            admin: admin as never,
            user: { id: 'user-1' },
            includeAll: true,
            today: '2026-03-27',
        });

        expect(result).toEqual({
            ok: true,
            data: {
                packages: [
                    {
                        id: 'pkg-1',
                        plan_id: 'plan-1',
                        plan_name_ru: 'Пакет 10',
                        plan_name_ky: null,
                        plan_name_en: 'Package 10',
                        remaining_visits: 3,
                        plan_visit_count: 10,
                        valid_until: '2026-04-10',
                        purchased_at: '2026-03-01',
                        created_at: '2026-03-01',
                    },
                ],
            },
        });
    });

    test('returns server error when packages query fails', async () => {
        const admin = {
            from: jest.fn().mockReturnValue({
                select: jest.fn().mockReturnValue({
                    eq: jest.fn().mockReturnValue({
                        order: jest.fn().mockReturnValue(
                            Promise.resolve({
                                data: null,
                                error: { message: 'db failed' },
                            }),
                        ),
                    }),
                }),
            }),
        };

        const result = await listCurrentUserVisitPackages({
            admin: admin as never,
            user: { id: 'user-1' },
            includeAll: true,
            today: '2026-03-27',
        });

        expect(result).toEqual({
            ok: false,
            error: 'server',
            message: 'Не удалось загрузить пакеты',
            details: 'db failed',
            status: 500,
        });
    });
});
