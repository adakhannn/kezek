import { GET, POST } from '@/app/api/dashboard/branches/[branchId]/promotions/route';
import {
    createMockRequest,
    createMockSupabase,
    expectBusinessScoped,
    expectErrorResponse,
    expectSuccessResponse,
    recordQueries,
} from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';
import { getRouteParamUuid } from '@/lib/routeParams';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

describe('/api/dashboard/branches/[branchId]/promotions', () => {
    const mockAdmin = createMockSupabase();
    const db = recordQueries(mockAdmin);
    const branchId = 'branch-uuid';
    const bizId = 'biz-uuid';

    beforeEach(() => {
        jest.clearAllMocks();
        db.queries.length = 0;
        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            supabase: db.client,
            userId: 'manager-user-id',
            bizId,
        });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(db.client);
        (getRouteParamUuid as jest.Mock).mockResolvedValue(branchId);
    });

    test('GET returns branch promotions list', async () => {
        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: branchId, biz_id: bizId },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                order: jest.fn().mockResolvedValue({
                    data: [{ id: 'promo-1', title_ru: 'Promo' }],
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnValue({ count: 1 }),
            });

        const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
            method: 'GET',
        });

        const res = await GET(req, { params: { branchId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data.promotions).toHaveLength(1);
        expect(data.data.promotions[0]).toHaveProperty('usage_count', 1);
        expectBusinessScoped(db, 'branches', bizId);
        expectBusinessScoped(db, 'branch_promotions', bizId);
    });

    test('POST creates branch promotion', async () => {
        mockAdmin.from
            .mockReturnValueOnce({
                select: jest.fn().mockReturnThis(),
                eq: jest.fn().mockReturnThis(),
                maybeSingle: jest.fn().mockResolvedValue({
                    data: { id: branchId, biz_id: bizId },
                    error: null,
                }),
            })
            .mockReturnValueOnce({
                insert: jest.fn().mockReturnThis(),
                select: jest.fn().mockReturnThis(),
                single: jest.fn().mockResolvedValue({
                    data: { id: 'promo-1', title_ru: 'Promo' },
                    error: null,
                }),
            });

        const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
            method: 'POST',
            body: {
                promotion_type: 'referral_free',
                title_ru: 'Promo',
            },
        });

        const res = await POST(req, { params: { branchId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data.data.promotion).toHaveProperty('id', 'promo-1');
        expectBusinessScoped(db, 'branches', bizId);
        expectBusinessScoped(db, 'branch_promotions', bizId);
    });

    test('POST returns validation error for invalid free_after_n_visits payload', async () => {
        mockAdmin.from.mockReturnValueOnce({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { id: branchId, biz_id: bizId },
                error: null,
            }),
        });

        const req = createMockRequest(`http://localhost/api/dashboard/branches/${branchId}/promotions`, {
            method: 'POST',
            body: {
                promotion_type: 'free_after_n_visits',
                title_ru: 'Promo',
                params: { visit_count: 0 },
            },
        });

        const res = await POST(req, { params: { branchId } });
        await expectErrorResponse(res, 400, 'validation');
    });
});
