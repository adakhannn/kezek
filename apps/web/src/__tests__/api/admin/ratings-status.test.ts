import { GET } from '@/app/api/admin/ratings/status/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { withRateLimit } from '@/lib/rateLimit';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        normal: {},
    },
}));

describe('/api/admin/ratings/status', () => {
    const mockSupabase = createMockSupabase();
    const mockAdmin = createMockSupabase();

    function createSuperAdminLookupQuery(row: unknown) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: row,
                error: null,
            }),
        };
    }

    function createMetricMaxQuery(metricDate: string | null) {
        return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: metricDate ? { metric_date: metricDate } : null,
                error: null,
            }),
        };
    }

    function createLastRatingQuery(value: string | null) {
        return {
            select: jest.fn().mockReturnThis(),
            order: jest.fn().mockReturnThis(),
            not: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: value ? { last_rating_recalculated_at: value } : null,
                error: null,
            }),
        };
    }

    function createNullRatingCountQuery(count: number) {
        return {
            select: jest.fn().mockReturnThis(),
            is: jest.fn().mockResolvedValue({
                count,
                error: null,
            }),
        };
    }

    function createRecentErrorsQuery() {
        return {
            select: jest.fn().mockReturnThis(),
            gte: jest.fn().mockResolvedValue({
                data: [],
                error: null,
            }),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (createSupabaseServerClient as jest.Mock).mockResolvedValue(mockSupabase);
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (withRateLimit as jest.Mock).mockImplementation((req, _config, handler) => handler());
    });

    test('returns 401 when user is not authenticated', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const req = createMockRequest('http://localhost/api/admin/ratings/status', {
            method: 'GET',
        });

        const res = await GET(req);
        await expectErrorResponse(res, 401, 'UNAUTHORIZED');
    });

    test('returns 403 when user is not super admin', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });

        mockSupabase.from.mockReturnValueOnce(createSuperAdminLookupQuery(null));

        const req = createMockRequest('http://localhost/api/admin/ratings/status', {
            method: 'GET',
        });

        const res = await GET(req);
        await expectErrorResponse(res, 403, 'FORBIDDEN');
    });

    test('returns ratings system status successfully', async () => {
        mockSupabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-id' } },
            error: null,
        });

        mockSupabase.from.mockReturnValueOnce(
            createSuperAdminLookupQuery({
                role_key: 'super_admin',
                biz_id: null,
            })
        );

        mockAdmin.from
            .mockReturnValueOnce(createMetricMaxQuery('2024-01-15'))
            .mockReturnValueOnce(createMetricMaxQuery('2024-01-15'))
            .mockReturnValueOnce(createMetricMaxQuery('2024-01-15'))
            .mockReturnValueOnce(createLastRatingQuery('2024-01-15T00:00:00.000Z'))
            .mockReturnValueOnce(createLastRatingQuery('2024-01-15T00:00:00.000Z'))
            .mockReturnValueOnce(createLastRatingQuery('2024-01-15T00:00:00.000Z'))
            .mockReturnValueOnce(createNullRatingCountQuery(5))
            .mockReturnValueOnce(createNullRatingCountQuery(3))
            .mockReturnValueOnce(createNullRatingCountQuery(2))
            .mockReturnValueOnce(createRecentErrorsQuery());

        const req = createMockRequest('http://localhost/api/admin/ratings/status', {
            method: 'GET',
        });

        const res = await GET(req);
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
        expect(data).toHaveProperty('staff_last_metric_date', '2024-01-15');
        expect(data).toHaveProperty('branch_last_metric_date', '2024-01-15');
        expect(data).toHaveProperty('biz_last_metric_date', '2024-01-15');
        expect(data).toHaveProperty('staff_without_rating', 5);
        expect(data).toHaveProperty('branches_without_rating', 3);
        expect(data).toHaveProperty('businesses_without_rating', 2);
        expect(data).toHaveProperty('recent_errors_total', 0);
        expect(data).toHaveProperty('has_recent_errors', false);
    });
});
