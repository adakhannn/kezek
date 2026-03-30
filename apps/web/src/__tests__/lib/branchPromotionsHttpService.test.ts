import { runCreateBranchPromotionHttp, runListBranchPromotionsHttp } from '@/lib/branchPromotionsHttpService';

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

jest.mock('@/lib/branchPromotionsService', () => ({
    listBranchPromotions: jest.fn(),
    createBranchPromotion: jest.fn(),
}));

import { createBranchPromotion, listBranchPromotions } from '@/lib/branchPromotionsService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

describe('branchPromotionsHttpService', () => {
    const req = new Request('http://localhost/api/dashboard/branches/branch-1/promotions');
    const context = { params: { branchId: 'branch-1' } };
    const admin = { from: jest.fn() };
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamUuid as jest.Mock).mockResolvedValue('branch-1');
        (withManagerContext as jest.Mock).mockImplementation(async (_req, _action, callback) =>
            callback({ admin, bizId }),
        );
    });

    test('lists branch promotions through manager context', async () => {
        (listBranchPromotions as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { promotions: [{ id: 'promo-1' }] },
        });

        const response = await runListBranchPromotionsHttp(req, context);
        const body = await response.json();

        expect(getRouteParamUuid).toHaveBeenCalledWith(context, 'branchId');
        expect(listBranchPromotions).toHaveBeenCalledWith({ admin, branchId: 'branch-1', bizId });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ promotions: [{ id: 'promo-1' }] });
    });

    test('creates branch promotion through manager context', async () => {
        const postReq = new Request('http://localhost/api/dashboard/branches/branch-1/promotions', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title_ru: 'Promo', promotion_type: 'referral_free' }),
        });
        (createBranchPromotion as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { promotion: { id: 'promo-1' } },
        });

        const response = await runCreateBranchPromotionHttp(postReq, context);
        const body = await response.json();

        expect(createBranchPromotion).toHaveBeenCalledWith({
            admin,
            branchId: 'branch-1',
            bizId,
            body: { title_ru: 'Promo', promotion_type: 'referral_free' },
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ promotion: { id: 'promo-1' } });
    });
});
