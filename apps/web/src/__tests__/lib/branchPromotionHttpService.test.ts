import { runDeleteBranchPromotionHttp, runUpdateBranchPromotionHttp } from '@/lib/branchPromotionHttpService';

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/withManagerContext', () => ({
    withManagerContext: jest.fn(),
}));

jest.mock('@/lib/branchPromotionService', () => ({
    updateBranchPromotion: jest.fn(),
    deleteBranchPromotion: jest.fn(),
}));

import { deleteBranchPromotion, updateBranchPromotion } from '@/lib/branchPromotionService';
import { getRouteParamUuid } from '@/lib/routeParams';
import { withManagerContext } from '@/lib/withManagerContext';

describe('branchPromotionHttpService', () => {
    const context = { params: { branchId: 'branch-1', promotionId: 'promo-1' } };
    const admin = { from: jest.fn() };
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamUuid as jest.Mock).mockImplementation(async (_context, param: string) => {
            if (param === 'branchId') return 'branch-1';
            if (param === 'promotionId') return 'promo-1';
            throw new Error(`Unknown param ${param}`);
        });
        (withManagerContext as jest.Mock).mockImplementation(async (_req, _action, callback) =>
            callback({ admin, bizId }),
        );
    });

    test('updates branch promotion through manager context', async () => {
        const req = new Request('http://localhost/api/dashboard/branches/branch-1/promotions/promo-1', {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ title_ru: 'Updated' }),
        });
        (updateBranchPromotion as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { promotion: { id: 'promo-1' } },
        });

        const response = await runUpdateBranchPromotionHttp(req, context);
        const body = await response.json();

        expect(updateBranchPromotion).toHaveBeenCalledWith({
            admin,
            branchId: 'branch-1',
            promotionId: 'promo-1',
            bizId,
            body: { title_ru: 'Updated' },
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ promotion: { id: 'promo-1' } });
    });

    test('deletes branch promotion through manager context', async () => {
        const req = new Request('http://localhost/api/dashboard/branches/branch-1/promotions/promo-1', {
            method: 'DELETE',
        });
        (deleteBranchPromotion as jest.Mock).mockResolvedValue({
            ok: true,
        });

        const response = await runDeleteBranchPromotionHttp(req, context);
        const body = await response.json();

        expect(deleteBranchPromotion).toHaveBeenCalledWith({
            admin,
            branchId: 'branch-1',
            promotionId: 'promo-1',
            bizId,
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });
});
