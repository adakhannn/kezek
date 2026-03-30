import { runServiceUpdateHttp } from '@/lib/serviceUpdateHttpService';

jest.mock('@/lib/authBiz', () => ({
    getBizContextForManagers: jest.fn(),
}));

jest.mock('@/lib/routeParams', () => ({
    getRouteParamRequired: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/serviceUpdateRouteService', () => ({
    runServiceUpdateFlow: jest.fn(),
}));

import { getBizContextForManagers } from '@/lib/authBiz';
import { getRouteParamRequired } from '@/lib/routeParams';
import { runServiceUpdateFlow } from '@/lib/serviceUpdateRouteService';
import { getServiceClient } from '@/lib/supabaseService';

describe('serviceUpdateHttpService', () => {
    const mockServiceClient = { from: jest.fn() };

    beforeEach(() => {
        jest.clearAllMocks();
        (getRouteParamRequired as jest.Mock).mockResolvedValue('service-id');
        (getBizContextForManagers as jest.Mock).mockResolvedValue({ bizId: 'biz-id' });
        (getServiceClient as jest.Mock).mockReturnValue(mockServiceClient);
    });

    test('delegates valid request to route service', async () => {
        (runServiceUpdateFlow as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runServiceUpdateHttp(
            new Request('http://localhost/api/services/service-id/update', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    name_ru: 'Massage',
                    duration_min: 60,
                    price_from: 1000,
                    price_to: 1500,
                    active: true,
                    branch_ids: ['branch-1'],
                }),
            }),
            { params: { id: 'service-id' } },
        );
        const body = await response.json();

        expect(runServiceUpdateFlow).toHaveBeenCalledWith({
            admin: mockServiceClient,
            bizId: 'biz-id',
            serviceId: 'service-id',
            body: {
                name_ru: 'Massage',
                duration_min: 60,
                price_from: 1000,
                price_to: 1500,
                active: true,
                branch_ids: ['branch-1'],
            },
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });

    test('maps service errors to api error response', async () => {
        (runServiceUpdateFlow as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'validation',
            message: 'bad payload',
            details: { field: 'name_ru' },
            status: 400,
        });

        const response = await runServiceUpdateHttp(
            new Request('http://localhost/api/services/service-id/update', {
                method: 'POST',
                body: JSON.stringify({}),
            }),
            { params: { id: 'service-id' } },
        );
        const body = await response.json();

        expect(response.status).toBe(400);
        expect(body.error).toBe('validation');
        expect(body.details).toEqual({ field: 'name_ru' });
    });
});
