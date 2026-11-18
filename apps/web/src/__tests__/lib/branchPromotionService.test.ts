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

    test('rejects negative visit count with stable field metadata before any update', async () => {
        admin.from.mockReturnValueOnce({select:jest.fn().mockReturnThis(),eq:jest.fn().mockReturnThis(),
            maybeSingle:jest.fn().mockResolvedValue({data:{id:'promo-1',promotion_type:'free_after_n_visits'},error:null})});
        const result = await updateBranchPromotion({admin,branchId:'branch-1',promotionId:'promo-1',bizId:'biz-1',
            body:{params:{visit_count:-1}}});
        expect(result).toEqual({ok:false,status:400,error:'validation',
            message:'Количество визитов должно быть больше 0',details:{field:'params.visit_count'}});
        expect(admin.from).toHaveBeenCalledTimes(1);
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
            .mockReturnValueOnce(deleteChain({ error: null }));

        const result = await deleteBranchPromotion({
            admin,
            branchId: 'branch-1',
            promotionId: 'promo-1',
            bizId: 'biz-1',
        });

        expect(result).toEqual({ ok: true });
    });

    test('a promotion clients already used is switched off instead of deleted (DB-14)', async () => {
        const update = jest.fn().mockReturnThis();
        admin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'promo-1', branch_id: 'branch-1', biz_id: 'biz-1' }, error: null }),
            })
            .mockReturnValueOnce(deleteChain({ error: { code: '23503', message: 'client_promotion_usage_promotion_id_fkey' } }))
            .mockReturnValueOnce({ update, ...deleteChain({ error: null }) });

        const result = await deleteBranchPromotion({ admin, branchId: 'branch-1', promotionId: 'promo-1', bizId: 'biz-1' });

        expect(result).toEqual({ ok: true, payload: { archived: true } });
        expect(update).toHaveBeenCalledWith({ is_active: false });
    });
});

// delete()/update() then three .eq() filters (id, branch_id, biz_id); the last one resolves.
function deleteChain(result: { error: { code?: string; message: string } | null }) {
    let eqCalls = 0;
    const chain: Record<string, unknown> = {
        delete: jest.fn(() => chain),
        eq: jest.fn(() => {
            eqCalls += 1;
            return eqCalls % 3 === 0 ? Promise.resolve(result) : chain;
        }),
    };
    return chain;
}
