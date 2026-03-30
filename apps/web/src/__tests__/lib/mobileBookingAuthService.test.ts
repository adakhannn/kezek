jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';

import { resolveMobileBookingAuth } from '@/lib/mobileBookingAuthService';

describe('mobileBookingAuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('uses bearer token client when authorization header is present', async () => {
        const bearerClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'user-1' } },
                    error: null,
                }),
            },
        };
        (createClient as jest.Mock).mockReturnValue(bearerClient);

        const result = await resolveMobileBookingAuth({
            authorizationHeader: 'Bearer token-123',
            supabaseUrl: 'https://db.test',
            anonKey: 'anon',
            createServerClient: jest.fn(),
        });

        expect(createClient).toHaveBeenCalled();
        expect(result).toEqual({
            ok: true,
            client: bearerClient,
            user: { id: 'user-1' },
        });
    });

    test('falls back to server client when bearer token is absent', async () => {
        const serverClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: { id: 'user-2' } },
                    error: null,
                }),
            },
        };

        const result = await resolveMobileBookingAuth({
            authorizationHeader: null,
            supabaseUrl: 'https://db.test',
            anonKey: 'anon',
            createServerClient: jest.fn().mockResolvedValue(serverClient),
        });

        expect(result).toEqual({
            ok: true,
            client: serverClient,
            user: { id: 'user-2' },
        });
    });

    test('returns auth error when client user lookup fails', async () => {
        const bearerClient = {
            auth: {
                getUser: jest.fn().mockResolvedValue({
                    data: { user: null },
                    error: { message: 'bad token' },
                }),
            },
        };
        (createClient as jest.Mock).mockReturnValue(bearerClient);

        const result = await resolveMobileBookingAuth({
            authorizationHeader: 'Bearer token-123',
            supabaseUrl: 'https://db.test',
            anonKey: 'anon',
            createServerClient: jest.fn(),
        });

        expect(result).toEqual({
            ok: false,
            error: 'auth',
            message: 'Not signed in',
            status: 401,
        });
    });
});
