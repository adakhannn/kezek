jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

jest.mock('@/lib/initializeRatingsRouteService', () => ({
    runInitializeRatingsRoute: jest.fn(),
}));

jest.mock('@supabase/ssr', () => ({
    createServerClient: jest.fn(),
}));

jest.mock('next/headers', () => ({
    cookies: jest.fn().mockResolvedValue({
        get: jest.fn(),
        set: jest.fn(),
        remove: jest.fn(),
    }),
}));

import { runInitializeRatingsHttp } from '@/lib/initializeRatingsHttpService';
import { runInitializeRatingsRoute } from '@/lib/initializeRatingsRouteService';
import { getServiceClient } from '@/lib/supabaseService';

describe('initializeRatingsHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (getServiceClient as jest.Mock).mockReturnValue({ rpc: jest.fn() });
    });

    test('delegates request body and clients to route service', async () => {
        const { createServerClient } = require('@supabase/ssr');
        createServerClient.mockReturnValue({
            auth: {
                getUser: jest.fn(),
            },
            from: jest.fn(),
        });
        (runInitializeRatingsRoute as jest.Mock).mockResolvedValue({
            ok: true,
            payload: { message: 'ok' },
        });

        const response = await runInitializeRatingsHttp(
            new Request('http://localhost/api/admin/initialize-ratings', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ days_back: 30 }),
            }),
        );
        const body = await response.json();

        expect(runInitializeRatingsRoute).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            admin: { rpc: expect.any(Function) },
            body: { days_back: 30 },
        });
        expect(response.status).toBe(200);
        expect(body.data).toEqual({ message: 'ok' });
    });
});
