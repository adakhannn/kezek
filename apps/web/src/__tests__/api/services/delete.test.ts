import { POST } from '@/app/api/services/[id]/delete/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
import { checkResourceBelongsToBiz } from '@/lib/dbHelpers';
import { getRouteParamRequired } from '@/lib/routeParams';
import { getServiceClient } from '@/lib/supabaseService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/dbHelpers', () => ({
    checkResourceBelongsToBiz: jest.fn(),
}));

describe('/api/services/[id]/delete', () => {
    const mockAdmin = createMockSupabase();
    const serviceId = 'service-uuid';
    const bizId = 'biz-uuid';

    function createFutureBookingsQuery(count: number) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            gte: jest.fn().mockReturnThis(),
            neq: jest.fn().mockReturnThis(),
            limit: jest.fn().mockResolvedValue({
                data: count > 0 ? [{ id: 'booking-1' }] : [],
                count,
                error: null,
            }),
        };
    }

    function createPastBookingsDeleteQuery() {
        return {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            lt: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        };
    }

    function createServiceDeleteQuery() {
        const query = {
            delete: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2
                ? Promise.resolve({ data: null, error: null })
                : query;
        });

        return query;
    }

    beforeEach(() => {
        jest.clearAllMocks();

        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getServiceClient as jest.Mock).mockReturnValue(mockAdmin);
        (getRouteParamRequired as jest.Mock).mockResolvedValue(serviceId);
    });

    test('returns 404 when service is missing', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource not found',
        });

        const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: serviceId } });
        await expectErrorResponse(res, 404);
    });

    test('returns 403 when service belongs to another business', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: null,
            error: 'Resource belongs to different business',
        });

        const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: serviceId } });
        await expectErrorResponse(res, 403);
    });

    test('returns 409 when future bookings exist', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: { id: serviceId, biz_id: bizId },
            error: null,
        });

        mockAdmin.from.mockReturnValueOnce(createFutureBookingsQuery(5));

        const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: serviceId } });
        await expectErrorResponse(res, 409, 'conflict');
    });

    test('deletes service when there are no future bookings', async () => {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: { id: serviceId, biz_id: bizId },
            error: null,
        });

        mockAdmin.from
            .mockReturnValueOnce(createFutureBookingsQuery(0))
            .mockReturnValueOnce(createPastBookingsDeleteQuery())
            .mockReturnValueOnce(createServiceDeleteQuery());

        const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
            method: 'POST',
        });

        const res = await POST(req, { params: { id: serviceId } });
        const data = await expectSuccessResponse(res, 200);

        expect(data).toHaveProperty('ok', true);
    });
});
