jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/staffDismissService', () => ({
    runStaffDismiss: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { runStaffDismissHttp } from '@/lib/staffDismissHttpService';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runStaffDismiss } from '@/lib/staffDismissService';
import { getServiceClient } from '@/lib/supabaseService';

describe('staffDismissHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamRequired as jest.Mock).mockResolvedValue('staff-id');
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-id' });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('delegates dismiss request to service', async () => {
        (runStaffDismiss as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runStaffDismissHttp({ params: { id: 'staff-id' } });
        const body = await response.json();

        expect(runStaffDismiss).toHaveBeenCalledWith({
            admin: expect.any(Object),
            bizId: 'biz-id',
            staffId: 'staff-id',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });
});
