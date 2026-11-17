import { POST } from '@/app/api/staff/[id]/delete/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

import { getBizContextForManagers } from '@/lib/authBiz';
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

describe('/api/staff/[id]/delete', () => {
    const staffId = 'staff-uuid';
    const bizId = 'biz-uuid';
    const request = () => createMockRequest(`http://localhost/api/staff/${staffId}/delete`, { method: 'POST' });
    const context = { params: Promise.resolve({ id: staffId }) };
    let admin: { rpc: jest.Mock; from: jest.Mock };

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.SCHEDULE_V2_ENABLED;
        admin = { rpc: jest.fn(), from: jest.fn() };
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId });
        (getRouteParamUuid as jest.Mock).mockResolvedValue(staffId);
        (getServiceClient as jest.Mock).mockReturnValue(admin);
    });

    test('returns 404 when the business has no such staff member', async () => {
        admin.rpc.mockResolvedValue({ error: { message: 'STAFF_NOT_FOUND', code: 'P0002' } });

        await expectErrorResponse(await POST(request(), context), 404);
    });

    test('returns 409 with the dismissal advice when the staff member has history', async () => {
        admin.rpc.mockResolvedValue({ error: { message: 'STAFF_HAS_HISTORY', code: 'P0001' } });

        const response = await POST(request(), context);
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.message).toContain('увольте');
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('deletes a staff member without history through one database command', async () => {
        admin.rpc.mockResolvedValue({ error: null });

        await expectSuccessResponse(await POST(request(), context), 200);
        expect(admin.rpc).toHaveBeenCalledWith('delete_staff_without_history', { p_biz_id: bizId, p_staff_id: staffId });
        expect(admin.from).not.toHaveBeenCalled();
    });
});
