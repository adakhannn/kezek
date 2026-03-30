import {
    deleteBranchPromotion,
    updateBranchPromotion,
} from '@/lib/branchPromotionService';

describe('branchPromotionService', () => {
    const admin = {
        from: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('updates promotion when payload is valid', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'promo-1',
                        branch_id: 'branch-1',
                        biz_id: 'biz-1',
                        promotion_type: 'free_after_n_visits',
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                update: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'promo-1', title_ru: 'Updated' },
                    error: null,
                }),
            });

        const result = await updateBranchPromotion({
            admin,
            branchId: 'branch-1',
            promotionId: 'promo-1',
            bizId: 'biz-1',
            body: { title_ru: 'Updated' },
        });

        expect(result).toEqual({
            ok: true,
            payload: {
                promotion: { id: 'promo-1', title_ru: 'Updated' },
            },
        });
    });

    test('deletes promotion after ownership check', async () => {
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: {
                        id: 'promo-1',
                        branch_id: 'branch-1',
                        biz_id: 'biz-1',
                    },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                delete: jest.fn().mockReturnThis(),
                eq: jest.fn().mockResolvedValue({
                    data: null,
                    error: null,
                }),
            });

        const result = await deleteBranchPromotion({
            admin,
            branchId: 'branch-1',
            promotionId: 'promo-1',
            bizId: 'biz-1',
        });

        expect(result).toEqual({ ok: true });
    });
});
