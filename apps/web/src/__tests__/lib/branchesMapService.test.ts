import { listBranchesMap } from '@/lib/branchesMapService';

jest.mock('@/lib/branches/buildApprovedBusinessesQuery', () => ({
    buildApprovedBusinessesQuery: jest.fn(),
}));

import { buildApprovedBusinessesQuery } from '@/lib/branches/buildApprovedBusinessesQuery';

describe('branchesMapService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns empty list when approved businesses query returns nothing', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        });

        const result = await listBranchesMap({
            supabase: { from: jest.fn() } as never,
        });

        expect(result).toEqual({
            ok: true,
            data: [],
        });
    });

    test('maps branch items with business metadata', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'biz-1',
                        name: 'Spa',
                        slug: 'spa',
                        categories: ['massage'],
                    },
                ],
                error: null,
            }),
        });

        const limit = jest.fn().mockResolvedValue({
            data: [
                {
                    id: 'branch-1',
                    name: 'Main branch',
                    address: 'Main st',
                    biz_id: 'biz-1',
                    lat: 42.8,
                    lon: 74.6,
                },
            ],
            error: null,
        });
        const eq = jest.fn().mockReturnValue({ limit });
        const not = jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue({ eq, limit }) });
        const select = jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
                not,
            }),
        });

        const result = await listBranchesMap({
            supabase: {
                from: jest.fn().mockReturnValue({ select }),
            } as never,
            categoryId: 'wellness',
        });

        expect(result).toEqual({
            ok: true,
            data: [
                {
                    id: 'branch-1',
                    businessId: 'biz-1',
                    businessName: 'Spa',
                    businessSlug: 'spa',
                    branchName: 'Main branch',
                    address: 'Main st',
                    lat: 42.8,
                    lon: 74.6,
                    categoryId: 'wellness',
                    categoryName: null,
                },
            ],
        });
    });

    test('returns internal error when branches query fails', async () => {
        (buildApprovedBusinessesQuery as jest.Mock).mockReturnValue({
            limit: jest.fn().mockResolvedValue({
                data: [
                    {
                        id: 'biz-1',
                        name: 'Spa',
                        slug: 'spa',
                        categories: ['massage'],
                    },
                ],
                error: null,
            }),
        });

        const limit = jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'branches failed' },
        });
        const eq = jest.fn().mockReturnValue({ limit });
        const not = jest.fn().mockReturnValue({ not: jest.fn().mockReturnValue({ eq, limit }) });
        const select = jest.fn().mockReturnValue({
            in: jest.fn().mockReturnValue({
                not,
            }),
        });

        const result = await listBranchesMap({
            supabase: {
                from: jest.fn().mockReturnValue({ select }),
            } as never,
        });

        expect(result).toEqual({
            ok: false,
            error: 'internal',
            message: 'Не удалось загрузить филиалы для карты',
            details: 'branches failed',
            status: 500,
        });
    });
});
