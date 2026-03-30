import { runServiceDeleteHttp } from '@/lib/serviceDeleteHttpService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/serviceDeleteRouteService', () => ({
    runServiceDeleteRoute: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runServiceDeleteRoute } from '@/lib/serviceDeleteRouteService';
import { getServiceClient } from '@/lib/supabaseService';

describe('serviceDeleteHttpService', () => {
    const mockServiceClient = { from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamRequired as jest.Mock).mockResolvedValue('service-id');
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-id' });
        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    test('delegates valid delete request to route service', async () => {
        (runServiceDeleteRoute as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runServiceDeleteHttp({ params: { id: 'service-id' } });
        const body = await response.json();

        expect(runServiceDeleteRoute).toHaveBeenCalledWith({
            admin: mockServiceClient,
            bizId: 'biz-id',
            serviceId: 'service-id',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });

    test('maps delete conflicts to api error response', async () => {
        (runServiceDeleteRoute as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'conflict',
            message: 'future bookings exist',
            details: { total: 1 },
            status: 409,
        });

        const response = await runServiceDeleteHttp({ params: { id: 'service-id' } });
        const body = await response.json();

        expect(response.status).toBe(409);
        expect(body.error).toBe('conflict');
        expect(body.details).toEqual({ total: 1 });
    });
});
