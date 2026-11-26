jest.mock('@supabase/supabase-js', () => ({
    createClient: jest.fn(() => ({ kind: 'bearer' })),
}));

jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(async () => ({ kind: 'cookie' })),
}));

import { createClient } from '@supabase/supabase-js';

import { createRequestSupabaseClient } from '@/lib/requestAuthContext';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';

// C9, C10, C13, B5: routes the app calls accept its Bearer token as well as the web session cookie.
describe('createRequestSupabaseClient', () => {
    beforeEach(() => jest.clearAllMocks());

    test('a Bearer token makes a client acting as the token user, without a session of its own', async () => {
        const client = await createRequestSupabaseClient(
            new Request('http://localhost/api/x', { headers: { Authorization: 'Bearer abc.def.ghi' } }),
        );

        expect(client).toEqual({ kind: 'bearer' });
        expect(createClient).toHaveBeenCalledWith(expect.any(String), expect.any(String), {
            global: { headers: { Authorization: 'Bearer abc.def.ghi' } },
            auth: { persistSession: false, autoRefreshToken: false },
        });
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
    });

    test('without a Bearer token the cookie session client is used', async () => {
        const client = await createRequestSupabaseClient(new Request('http://localhost/api/x'));
        expect(client).toEqual({ kind: 'cookie' });
        expect(createClient).not.toHaveBeenCalled();
    });

    test('an empty or non-Bearer Authorization header falls back to the cookie session', async () => {
        await createRequestSupabaseClient(new Request('http://localhost/api/x', { headers: { Authorization: 'Basic xyz' } }));
        await createRequestSupabaseClient(new Request('http://localhost/api/x', { headers: { Authorization: 'Bearer ' } }));
        expect(createClient).not.toHaveBeenCalled();
        expect(createSupabaseServerClient).toHaveBeenCalledTimes(2);
    });
});
