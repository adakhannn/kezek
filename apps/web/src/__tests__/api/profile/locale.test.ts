/**
 * POST /api/profile/locale (FE-10): the signed-in user's notification language, from the web cookie
 * session or the mobile Bearer token.
 */
import { createClient } from '@supabase/supabase-js';

import { POST } from '@/app/api/profile/locale/route';
import { createMockRequest, createMockSupabase, expectErrorResponse, expectSuccessResponse } from '../testHelpers';

import { createSupabaseAdminClient, createSupabaseServerClient } from '@/lib/supabaseHelpers';

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseServerClient: jest.fn(),
    createSupabaseAdminClient: jest.fn(),
}));

function adminMock(result: { error: unknown } = { error: null }) {
    const eq = jest.fn().mockResolvedValue(result);
    const update = jest.fn(() => ({ eq }));
    const from = jest.fn(() => ({ update }));
    return { client: { from }, from, update, eq };
}

const request = (body: unknown, headers?: Record<string, string>) =>
    createMockRequest('http://localhost/api/profile/locale', { method: 'POST', body, headers });

describe('/api/profile/locale', () => {
    const session = createMockSupabase();
    let admin: ReturnType<typeof adminMock>;

    beforeEach(() => {
        jest.clearAllMocks();
        admin = adminMock();
        (createSupabaseServerClient as jest.Mock).mockResolvedValue(session);
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(admin.client);
        session.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-a' } }, error: null });
    });

    test('401 without a session, and nothing is written', async () => {
        session.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });

        await expectErrorResponse(await POST(request({ locale: 'ky' })), 401, 'auth');
        expect(admin.from).not.toHaveBeenCalled();
    });

    test.each([[{ locale: 'de' }], [{ locale: null }], [{}], [['ky']], ['not json']])('400 for %j', async (body) => {
        await expectErrorResponse(await POST(request(body)), 400, 'validation');
        expect(admin.from).not.toHaveBeenCalled();
    });

    test('200 updates only the caller\'s own profile, whatever the body says', async () => {
        const res = await POST(request({ locale: 'en', id: 'user-b', user_id: 'user-b', full_name: 'X' }));

        const data = await expectSuccessResponse(res);
        expect(data.locale).toBe('en');
        expect(admin.from).toHaveBeenCalledTimes(1);
        expect(admin.from).toHaveBeenCalledWith('profiles');
        expect(admin.update).toHaveBeenCalledWith({ preferred_locale: 'en' });
        expect(admin.eq).toHaveBeenCalledWith('id', 'user-a');
    });

    test('a failed update is a 500, not a silent success', async () => {
        admin = adminMock({ error: { message: 'synthetic failure' } });
        (createSupabaseAdminClient as jest.Mock).mockReturnValue(admin.client);

        await expectErrorResponse(await POST(request({ locale: 'ru' })), 500, 'internal');
    });
    test('a mobile Bearer token names the profile; the cookie session is not read', async () => {
        const bearer = createMockSupabase();
        bearer.auth.getUser.mockResolvedValue({ data: { user: { id: 'mobile-user' } }, error: null });
        jest.mocked(createClient).mockReturnValue(bearer as never);

        const res = await POST(request({ locale: 'ky', id: 'user-a' }, { Authorization: 'Bearer token-1' }));

        expect((await expectSuccessResponse(res)).locale).toBe('ky');
        expect(jest.mocked(createClient).mock.calls[0][2]).toMatchObject({ global: { headers: { Authorization: 'Bearer token-1' } } });
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
        expect(admin.update).toHaveBeenCalledWith({ preferred_locale: 'ky' });
        expect(admin.eq).toHaveBeenCalledWith('id', 'mobile-user');
    });

    test('an invalid Bearer token is a 401, without a fallback to the cookie session, and nothing is written', async () => {
        const bearer = createMockSupabase();
        bearer.auth.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'invalid JWT' } });
        jest.mocked(createClient).mockReturnValue(bearer as never);

        await expectErrorResponse(await POST(request({ locale: 'en' }, { Authorization: 'Bearer forged' })), 401, 'auth');
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
        expect(admin.from).not.toHaveBeenCalled();
    });
});
