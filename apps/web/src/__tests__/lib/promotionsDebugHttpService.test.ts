jest.mock('@/lib/promotionsDebugRouteService', () => ({
    runPromotionsDebugRoute: jest.fn(),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
}));

jest.mock('@/lib/supabaseService', () => ({
    getServiceClient: jest.fn(),
}));

import { runPromotionsDebugRoute } from '@/lib/promotionsDebugRouteService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
import { getServiceClient } from '@/lib/supabaseService';

describe('promotionsDebugHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: jest.fn() } });
        (getServiceClient as jest.Mock).mockReturnValue({ from: jest.fn() });
    });

    test('maps failure from route service', async () => {
        (runPromotionsDebugRoute as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'auth',
            message: 'Не авторизован',
            status: 401,
        });
        const { runPromotionsDebugHttp } = await import('@/lib/promotionsDebugHttpService');

        const response = await runPromotionsDebugHttp(
            new Request('http://localhost/api/admin/promotions/debug'),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });

    test('maps success from route service', async () => {
        (runPromotionsDebugRoute as jest.Mock).mockResolvedValue({
            ok: true,
            data: { ok: true },
        });
        const { runPromotionsDebugHttp } = await import('@/lib/promotionsDebugHttpService');

        const response = await runPromotionsDebugHttp(
            new Request('http://localhost/api/admin/promotions/debug'),
        );
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.data.ok).toBe(true);
    });
});
