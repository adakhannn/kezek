import { runRatingsManualRecalculateHttp } from '@/lib/ratingsManualRecalculateHttpService';

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

describe('ratingsManualRecalculateHttpService', () => {
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

    test('returns auth error when user is missing', async () => {
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({
            auth: {
                getUser: jest.fn().mockResolvedValue({ data: { user: null } }),
            },
        });

        const response = await runRatingsManualRecalculateHttp(
            new Request('http://localhost/api/admin/ratings/recalculate', { method: 'POST' }),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });

    test('delegates recalculation to service', async () => {
        (runRatingsManualRecalculate as jest.Mock).mockResolvedValue({
            ok: true,
            data: { ok: true, entity_type: 'staff', entity_id: 'staff-1', action: 'recalculate_rating' },
        });

        const response = await runRatingsManualRecalculateHttp(
            new Request('http://localhost/api/admin/ratings/recalculate', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ entity_type: 'staff', entity_id: 'staff-1' }),
            }),
        );
        const body = await response.json();

        expect(runRatingsManualRecalculate).toHaveBeenCalledWith({
            admin: { rpc: expect.any(Function), from: expect.any(Function) },
            userId: 'user-1',
            body: { entity_type: 'staff', entity_id: 'staff-1' },
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({
            ok: true,
            entity_type: 'staff',
            entity_id: 'staff-1',
            action: 'recalculate_rating',
        });
    });
});
