import { POST } from '@/app/api/admin/ratings/recalculate/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

jest.mock('@/lib/ratingsDebugEntitiesService', () => ({
    ensureSuperAdminAccess: jest.fn(),
}));

jest.mock('@/lib/ratingsManualRecalculateService', () => ({
    runRatingsManualRecalculate: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { ensureSuperAdminAccess } from '@/lib/ratingsDebugEntitiesService';
import { runRatingsManualRecalculate } from '@/lib/ratingsManualRecalculateService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

describe('/api/admin/ratings/recalculate', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
            },
        });
        (ensureSuperAdminAccess as jest.Mock).mockResolvedValue({ ok: true });
        (getServiceClient as jest.Mock).mockReturnValue({ rpc: jest.fn(), from: jest.fn() });
    });

    test('returns recalculation payload', async () => {
        (runRatingsManualRecalculate as jest.Mock).mockResolvedValue({
            ok: true,
            data: { ok: true, entity_type: 'biz', entity_id: 'biz-1', action: 'recalculate_rating' },
        });

        const res = await POST(
            createMockRequest('http://localhost/api/admin/ratings/recalculate', {
                method: 'POST',
                body: { entity_type: 'biz', entity_id: 'biz-1' },
            }),
        );
        const body = await expectSuccessResponse(res, 200);

        expect(body.data).toEqual({
            ok: true,
            entity_type: 'biz',
            entity_id: 'biz-1',
            action: 'recalculate_rating',
        });
    });

    test('returns 401 when user is not authenticated', async () => {
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
            },
        });

        const res = await POST(
            createMockRequest('http://localhost/api/admin/ratings/recalculate', {
                method: 'POST',
                body: {},
            }),
        );

        await expectErrorResponse(res, 401, 'auth');
    });
});
