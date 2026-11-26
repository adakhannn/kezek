/**
 * The mobile app calls the web routes with `Authorization: Bearer <token>` instead of the session
 * cookie: createSupabaseServerClient must then act as that token's user everywhere.
 */
const headerValues = new Map<string, string>();
const cookieStore = { get: jest.fn() };

jest.mock('next/headers', () => ({
    headers: jest.fn(async () => ({ get: (name: string) => headerValues.get(name.toLowerCase()) ?? null })),
    cookies: jest.fn(async () => cookieStore),
}));

jest.mock('@/lib/env', () => ({
    getSupabaseUrl: () => 'https://example.supabase.co',
    getSupabaseAnonKey: () => 'anon-key',
}));

jest.mock('@/lib/supabaseService', () => ({ getServiceClient: jest.fn() }));

const bearerGetUser = jest.fn();
const createClient = jest.fn((_url: string, _key: string, _options: unknown) => ({ auth: { getUser: bearerGetUser } }));
jest.mock('@supabase/supabase-js', () => ({ createClient: (url: string, key: string, options: unknown) => createClient(url, key, options) }));

const cookieClient = { auth: { getUser: jest.fn() } };
jest.mock('@supabase/ssr', () => ({ createServerClient: jest.fn(() => cookieClient) }));

import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

describe('createSupabaseServerClient with a mobile Bearer token', () => {
    beforeEach(() => {
        headerValues.clear();
        jest.clearAllMocks();
    });

    test('getUser() validates the token the app sent', async () => {
        headerValues.set('authorization', 'Bearer mobile-token');
        const client = await createSupabaseServerClient();
        await client.auth.getUser();
        expect(bearerGetUser).toHaveBeenCalledWith('mobile-token');
        expect(createClient).toHaveBeenCalledWith('https://example.supabase.co', 'anon-key', expect.objectContaining({
            global: { headers: { Authorization: 'Bearer mobile-token' } },
        }));
    });

    test('without a Bearer header the web session cookie is used', async () => {
        const client = await createSupabaseServerClient();
        expect(client).toBe(cookieClient);
        expect(createClient).not.toHaveBeenCalled();
    });

    test('an empty Bearer value is not a token', async () => {
        headerValues.set('authorization', 'Bearer   ');
        expect(await createSupabaseServerClient()).toBe(cookieClient);
    });
});
