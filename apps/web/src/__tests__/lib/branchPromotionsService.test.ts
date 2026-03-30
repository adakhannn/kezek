import {
    createBranchPromotion,
    listBranchPromotions,
} from '@/lib/branchPromotionsService';

describe('branchPromotionsService', () => {
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns promotions list with usage stats', async () => {
        let usageCount = 0;
        admin.from.mockImplementation((table: string) => {
            if (table === 'branches') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    maybeSingle: jest.fn().mockResolvedValue({
                        data: { id: 'branch-1', biz_id: 'biz-1' },
                        error: null,
                    }),
                };
            }

            if (table === 'branch_promotions') {
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnThis(),
                    order: jest.fn().mockResolvedValue({
                        data: [{ id: 'promo-1', title_ru: 'Promo' }],
                        error: null,
                    }),
                };
            }

            if (table === 'client_promotion_usage') {
                usageCount += 1;
                return {
                    select: jest.fn().mockReturnThis(),
                    eq: jest.fn().mockReturnValue({
                        count: usageCount,
                    }),
                };
            }

            return admin;
        });

        const result = await listBranchPromotions({
            admin,
            branchId: 'branch-1',
            bizId: 'biz-1',
        });

        expect(result).toEqual({
            ok: true,
            payload: {
                promotions: [{ id: 'promo-1', title_ru: 'Promo', usage_count: 1 }],
            },
        });
    });

    test('returns validation error for invalid free_after_n_visits payload', async () => {
        admin.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: 'branch-1', biz_id: 'biz-1' },
                error: null,
            }),
        });

        const result = await createBranchPromotion({
            admin,
            branchId: 'branch-1',
            bizId: 'biz-1',
            body: {
                promotion_type: 'free_after_n_visits',
                params: { visit_count: 0 },
                title_ru: 'Promo',
            },
        });

        expect(result).toEqual({
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Количество визитов должно быть больше 0',
        });
    });
});
