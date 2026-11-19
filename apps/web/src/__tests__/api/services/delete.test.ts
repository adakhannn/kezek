import { POST } from '@/app/api/services/[id]/delete/route';
import {
    createMockRequest,
    createMockSupabase,
    expectErrorResponse,
    expectSuccessResponse,
} from '../testHelpers';

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

    function createPlanCountQuery(count: number) {
        return {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockResolvedValue({ count, error: null }),
        };
    }

    // delete()/update() followed by .eq('id') and .eq('biz_id'); the second one resolves.
    function createServiceWriteQuery(result: { error: { code?: string; message: string } | null }) {
        const query = {
            delete: jest.fn().mockReturnThis(),
            update: jest.fn().mockReturnThis(),
            eq: jest.fn(),
        };

        let eqCalls = 0;
        query.eq.mockImplementation(() => {
            eqCalls += 1;
            return eqCalls >= 2 ? Promise.resolve({ data: null, ...result }) : query;
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

    async function deleteService() {
        (checkResourceBelongsToBiz as jest.Mock).mockResolvedValueOnce({
            data: { id: serviceId, biz_id: bizId },
            error: null,
        });
        const req = createMockRequest(`http://localhost/api/services/${serviceId}/delete`, {
            method: 'POST',
        });
        return POST(req, { params: { id: serviceId } });
    }

    test('deletes a service without history and never deletes bookings (DB-14)', async () => {
        const serviceDelete = createServiceWriteQuery({ error: null });
        mockAdmin.from
            .mockReturnValueOnce(createFutureBookingsQuery(0))
            .mockReturnValueOnce(createPlanCountQuery(0))
            .mockReturnValueOnce(serviceDelete);

        const data = await expectSuccessResponse(await deleteService(), 200);

        expect(data).toHaveProperty('ok', true);
        expect(data).not.toHaveProperty('archived');
        expect(serviceDelete.delete).toHaveBeenCalled();
        expect(mockAdmin.from.mock.calls.map(([table]) => table)).toEqual(['bookings', 'visit_package_plans', 'services']);
    });

    test('switches off a service with past bookings instead of deleting it', async () => {
        const archive = createServiceWriteQuery({ error: null });
        mockAdmin.from
            .mockReturnValueOnce(createFutureBookingsQuery(0))
            .mockReturnValueOnce(createPlanCountQuery(0))
            .mockReturnValueOnce(createServiceWriteQuery({ error: { code: '23503', message: 'violates foreign key constraint' } }))
            .mockReturnValueOnce(archive);

        const data = await expectSuccessResponse(await deleteService(), 200);

        expect(data).toHaveProperty('archived', true);
        expect(archive.update).toHaveBeenCalledWith({ active: false });
    });

    test('an unexpected delete error does not leak database text', async () => {
        mockAdmin.from
            .mockReturnValueOnce(createFutureBookingsQuery(0))
            .mockReturnValueOnce(createPlanCountQuery(0))
            .mockReturnValueOnce(createServiceWriteQuery({ error: { code: '42P01', message: 'relation services_secret does not exist' } }));

        const data = await expectErrorResponse(await deleteService(), 400, 'validation');
        expect(JSON.stringify(data)).not.toContain('services_secret');
    });
});
