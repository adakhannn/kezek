/**
 * Tests for /api/branches/[id]/schedule
 */

import { GET, POST } from '@/app/api/branches/[id]/schedule/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { withRateLimit } from '@/lib/rateLimit';
import { getRouteParamUuid } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamUuid: jest.fn(),
}));

jest.mock('@/lib/rateLimit', () => ({
    withRateLimit: jest.fn((req, _config, handler) => handler()),
    RateLimitConfigs: {
        normal: {},
    },
}));

describe('/api/branches/[id]/schedule', () => {
    const mockAdmin = createMockSupabase();
    const branchId = 'branch-uuid';
    const bizId = 'biz-uuid';

    function createBranchLookupQuery(result: { data: unknown; error: unknown }) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue(result),
        };
    }

    function createDeleteQuery(result: { data: unknown; error: unknown }) {
        const query = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2 ? Promise.resolve(result) : query;
        });

        return query;
    }

    function createInsertQuery(result: { data: unknown; error: unknown }) {
        return {
            insert: jest.fn().mockResolvedValue(result),
        };
    }

    function createScheduleSelectQuery(result: { data: unknown; error: unknown }) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            order: jest.fn().mockResolvedValue(result),
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamUuid as jest.Mock).mockResolvedValue(branchId);
        (withRateLimit as jest.Mock).mockImplementation((req, _config, handler) => handler());
    });

    describe('POST /api/branches/[id]/schedule', () => {
        test('returns 400 when schedule is not an array', async () => {
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return createBranchLookupQuery({
                        data: { id: branchId, biz_id: bizId },
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                method: 'POST',
                body: { schedule: 'not-an-array' },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 400);
        });

        test('returns 404 when branch is missing', async () => {
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return createBranchLookupQuery({
                        data: null,
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                method: 'POST',
                body: { schedule: [] },
            });

            const res = await POST(req, { params: { id: branchId } });
            await expectErrorResponse(res, 404);
        });

        test('saves schedule successfully', async () => {
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return createBranchLookupQuery({
                        data: { id: branchId, biz_id: bizId },
                        error: null,
                    });
                }

                if (table === 'branch_working_hours') {
                    if (mockAdmin.from.mock.calls.filter(([name]) => name === 'branch_working_hours').length === 1) {
                        return createDeleteQuery({
                            data: null,
                            error: null,
                        });
                    }

                    return createInsertQuery({
                        data: null,
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                method: 'POST',
                body: {
                    schedule: [
                        {
                            day_of_week: 1,
                            intervals: [{ start: '09:00', end: '18:00' }],
                            breaks: [],
                        },
                    ],
                },
            });

            const res = await POST(req, { params: { id: branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
        });
    });

    describe('GET /api/branches/[id]/schedule', () => {
        test('returns 404 when branch is missing', async () => {
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return createBranchLookupQuery({
                        data: null,
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: branchId } });
            await expectErrorResponse(res, 404);
        });

        test('returns schedule successfully', async () => {
            mockAdmin.from.mockImplementation((table: string) => {
                if (table === 'branches') {
                    return createBranchLookupQuery({
                        data: { id: branchId, biz_id: bizId },
                        error: null,
                    });
                }

                if (table === 'branch_working_hours') {
                    return createScheduleSelectQuery({
                        data: [
                            {
                                day_of_week: 1,
                                intervals: [{ start: '09:00', end: '18:00' }],
                                breaks: [],
                            },
                        ],
                        error: null,
                    });
                }

                throw new Error(`Unexpected table: ${table}`);
            });

            const req = createMockRequest(`http://localhost/api/branches/${branchId}/schedule`, {
                method: 'GET',
            });

            const res = await GET(req, { params: { id: branchId } });
            const data = await expectSuccessResponse(res, 200);

            expect(data).toHaveProperty('ok', true);
            expect(data).toHaveProperty('schedule');
        });
    });
});
