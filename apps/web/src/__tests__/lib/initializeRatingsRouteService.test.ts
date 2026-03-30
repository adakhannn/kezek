import { runInitializeRatingsRoute } from '@/lib/initializeRatingsRouteService';

jest.mock('@/lib/initializeRatingsService', () => ({
    initializeRatings: jest.fn(),
}));

import { initializeRatings } from '@/lib/initializeRatingsService';

describe('initializeRatingsRouteService', () => {
    const supabase = {
        auth: {
            getUser: jest.fn(),
        },
        from: jest.fn(),
    };

    const admin = {
        rpc: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('returns auth error when user is missing', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: null },
            error: null,
        });

        const result = await runInitializeRatingsRoute({
            supabase,
            admin,
            body: {},
        });

        expect(result).toEqual({
            ok: false,
            status: 401,
            error: 'auth',
            message: 'Не авторизован',
        });
    });

    test('returns forbidden when user is not super admin', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: null,
                error: null,
            }),
        });

        const result = await runInitializeRatingsRoute({
            supabase,
            admin,
            body: {},
        });

        expect(result).toEqual({
            ok: false,
            status: 403,
            error: 'forbidden',
            message: 'Доступ запрещен',
        });
    });

    test('delegates to initializeRatings for super admins', async () => {
        supabase.auth.getUser.mockResolvedValue({
            data: { user: { id: 'user-1' } },
            error: null,
        });
        supabase.from.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            is: jest.fn().mockReturnThis(),
            limit: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: { role_key: 'super_admin', biz_id: null },
                error: null,
            }),
        });
        (initializeRatings as jest.Mock).mockResolvedValue({
            ok: true,
            data: { message: 'Ratings initialized' },
        });

        const result = await runInitializeRatingsRoute({
            supabase,
            admin,
            body: { days_back: 30 },
        });

        expect(initializeRatings).toHaveBeenCalledWith(admin, { days_back: 30 });
        expect(result).toEqual({
            ok: true,
            payload: { message: 'Ratings initialized' },
        });
    });
});
