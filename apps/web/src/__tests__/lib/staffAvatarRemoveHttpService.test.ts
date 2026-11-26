jest.mock('@/lib/authBiz', () => ({
    getStaffContextForRequest: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffAvatarRemoveService', () => ({
    runStaffAvatarRemove: jest.fn(),
}));

import { getStaffContextForRequest } from '@/lib/authBiz';
import { runStaffAvatarRemoveHttp } from '@/lib/staffAvatarRemoveHttpService';
import { runStaffAvatarRemove } from '@/lib/staffAvatarRemoveService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffAvatarRemoveHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getStaffContextForRequest as jest.Mock).mockResolvedValue({ staffId: 'staff-id', bizId: 'biz-id' });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn(), storage: {} });
    });

    test('delegates remove request to avatar remove service', async () => {
        (runStaffAvatarRemove as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'removed' },
        });

        // The app sends a Bearer token: the staff card comes from the request (getStaffContextForRequest).
        const response = await runStaffAvatarRemoveHttp(new Request('http://localhost/api/staff/avatar/remove', { method: 'POST' }));
        const body = await response.json();

        expect(runStaffAvatarRemove).toHaveBeenCalledWith({
            admin: expect.any(Object),
            staffId: 'staff-id',
            bizId: 'biz-id',
        });
        expect(response.status).toBe(200);
        expect(body.data.message).toBe('removed');
    });
});
