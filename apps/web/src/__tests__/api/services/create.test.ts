import { POST } from '@/app/api/services/create/route';
import {
    createMockRequest,
    createMockSupabase,
    createTableMock,
    expectBusinessScoped,
    expectErrorResponse,
    expectSuccessResponse,
} from '../testHelpers';

import { getBizContextForManagers } from '@/lib/authBiz';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

describe('/api/services/create', () => {
    const mockServiceClient = createMockSupabase();

    // CI-04: a recording client, so the tests can check that both queries are limited to the business.
    function useTables(branchIds: string[], inserted: Array<{ id: string; branch_id: string }>) {
        const client = createTableMock({
            branches: { data: branchIds.map((id) => ({ id })) },
            services: { data: inserted },
        });
        (getServiceClient as jest.Mock).mockReturnValue(client);
        return client;
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({
            bizId: 'biz-id',
        });

        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    test('returns 400 when name_ru is missing', async () => {
        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: { duration_min: 60, price_from: 1000 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'VALIDATION');
    });

    test('returns 400 when duration_min <= 0', async () => {
        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: { name_ru: 'Test Service', duration_min: 0, price_from: 1000 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'VALIDATION');
    });

    test('returns 400 when price_to < price_from', async () => {
        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: { name_ru: 'Test Service', duration_min: 60, price_from: 2000, price_to: 1000 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'VALIDATION');
    });

    test('returns 400 when branch_id and branch_ids are missing', async () => {
        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: { name_ru: 'Test Service', duration_min: 60, price_from: 1000 },
        });

        const res = await POST(req);
        await expectErrorResponse(res, 400, 'VALIDATION');
    });

    test('creates service for a single branch via branch_id', async () => {
        const client = useTables(['branch-id'], [{ id: 'service-id', branch_id: 'branch-id' }]);

        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: {
                name_ru: 'Test Service',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
                branch_id: 'branch-id',
            },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
        expect(data.count).toBe(1);
        expect(data.ids).toEqual(['service-id']);
        expectBusinessScoped(client, 'branches', 'biz-id');
        expectBusinessScoped(client, 'services', 'biz-id');
    });

    test('creates service for multiple branches via branch_ids', async () => {
        const client = useTables(['branch-id-1', 'branch-id-2'], [
            { id: 'service-id-1', branch_id: 'branch-id-1' },
            { id: 'service-id-2', branch_id: 'branch-id-2' },
        ]);

        const req = createMockRequest('http://localhost/api/services/create', {
            method: 'POST',
            body: {
                name_ru: 'Test Service',
                name_en: 'Test Service EN',
                name_ky: 'Test Service KY',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
                branch_ids: ['branch-id-1', 'branch-id-2'],
            },
        });

        const res = await POST(req);
        const data = await expectSuccessResponse(res);

        expect(data.ok).toBe(true);
        expect(data.count).toBe(2);
        expect(data.ids).toEqual(['service-id-1', 'service-id-2']);
        expectBusinessScoped(client, 'branches', 'biz-id');
        expectBusinessScoped(client, 'services', 'biz-id');
    });
});
