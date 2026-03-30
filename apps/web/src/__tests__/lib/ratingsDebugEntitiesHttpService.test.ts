import { runRatingsDebugEntitiesHttp } from '@/lib/ratingsDebugEntitiesHttpService';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/ratingsDebugEntitiesService', () => ({
    ensureSuperAdminAccess: jest.fn(),
    getRatingsDebugEntities: jest.fn(),
}));

jest.mock('@/lib/time', () => ({
    addDaysToDateString: jest.fn(() => '2026-03-20'),
    getTimezone: jest.fn(() => 'Asia/Almaty'),
    todayDateString: jest.fn(() => '2026-03-27'),
}));

const { createSupabaseServerClient } = require('@/lib/supabaseHelpers');
const { getServiceClient } = require('@/lib/supabaseService');
const { ensureSuperAdminAccess, getRatingsDebugEntities } = require('@/lib/ratingsDebugEntitiesService');

describe('ratingsDebugEntitiesHttpService', () => {
    const supabase = {
        auth: {
            getUser: jest.fn(),
        },
    };

    beforeEach(() => {
        jest.clearAllMocks();
        createSupabaseServerClient.mockResolvedValue(supabase);
        getServiceClient.mockReturnValue({ mocked: true });
    });

    test('returns auth error for unauthenticated user', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
        });

        const res = await runRatingsDebugEntitiesHttp(
            new Request('http://localhost/api/admin/ratings/debug-entities'),
        );
        const data = await res.json();

        expect(res.status).toBe(401);
        expect(data.error).toBe('auth');
    });

    test('returns forbidden when super admin access is missing', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
        });
        ensureSuperAdminAccess.mockResolvedValue({
            ok: false,
            error: 'forbidden',
            message: 'Доступ запрещен',
            status: 403,
        });

        const res = await runRatingsDebugEntitiesHttp(
            new Request('http://localhost/api/admin/ratings/debug-entities'),
        );
        const data = await res.json();

        expect(res.status).toBe(403);
        expect(data.error).toBe('forbidden');
    });

    test('loads debug entities with clamped days window', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
        });
        ensureSuperAdminAccess.mockResolvedValue({ ok: true });
        getRatingsDebugEntities.mockResolvedValue({
            ok: true,
            data: {
                days: 90,
                window_since: '2026-03-20',
                with_null_rating: { staff: [], branches: [], businesses: [] },
                without_metrics_since: {
                    staff: [],
                    branches: [],
                    businesses: [],
                    total_count: { staff: 0, branches: 0, businesses: 0 },
                },
                recent_errors: [],
            },
        });

        const res = await runRatingsDebugEntitiesHttp(
            new Request('http://localhost/api/admin/ratings/debug-entities?days=999'),
        );
        const data = await res.json();

        expect(res.status).toBe(200);
        expect(getRatingsDebugEntities).toHaveBeenCalledWith({
            admin: { mocked: true },
            days: 90,
            windowStartStr: '2026-03-20',
        });
        expect(data.data.days).toBe(90);
    });
});
