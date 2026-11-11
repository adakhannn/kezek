import { createClient } from '@supabase/supabase-js';
import { checkCurrentUserIsSuperAdmin } from '@/lib/adminAccess';

describe('canonical caller-bound super-admin RPC', () => {
    test('uses the supplied session token, no actor parameter or role-table inference', async () => {
        const requests: Array<{ url: string; authorization: string | null; body: unknown }> = [];
        const fakeFetch: typeof fetch = async (input, init) => {
            const request = new Request(input, init);
            requests.push({ url: request.url, authorization: request.headers.get('authorization'), body: JSON.parse(await request.text()) });
            return Response.json(request.headers.get('authorization') === 'Bearer global-admin-session');
        };
        const client = (token: string) => createClient('https://synthetic.invalid', 'synthetic-anon-key', {
            auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: 'Bearer ' + token }, fetch: fakeFetch },
        });
        expect(await checkCurrentUserIsSuperAdmin(client('global-admin-session'), 'verified-global-admin')).toEqual({ isSuperAdmin: true, error: null });
        expect(await checkCurrentUserIsSuperAdmin(client('ordinary-session'), 'another-user-id')).toEqual({ isSuperAdmin: false, error: null });
        expect(requests).toEqual([
            { url: 'https://synthetic.invalid/rest/v1/rpc/is_super_admin', authorization: 'Bearer global-admin-session', body: {} },
            { url: 'https://synthetic.invalid/rest/v1/rpc/is_super_admin', authorization: 'Bearer ordinary-session', body: {} },
        ]);
    });
    test.each([null, undefined, 'true', 1, {}, [{ is_super_admin: true }]])('denies malformed non-boolean RPC result %p as dependency error', async data => {
        const rpc = jest.fn().mockResolvedValue({ data, error: null });
        expect(await checkCurrentUserIsSuperAdmin({ rpc }, 'verified-user')).toEqual({ isSuperAdmin: false, error: { message: 'Не удалось проверить права доступа' } });
    });
    test('even true plus error is denied; thrown lookup failure is closed', async () => {
        const rpc = jest.fn().mockResolvedValueOnce({ data: true, error: new Error('DB failure') }).mockRejectedValueOnce(new Error('transport'));
        expect((await checkCurrentUserIsSuperAdmin({ rpc }, 'verified')).isSuperAdmin).toBe(false);
        expect((await checkCurrentUserIsSuperAdmin({ rpc }, 'verified')).error).toBeTruthy();
    });
    test('missing verified user ID never queries roles', async () => {
        const rpc = jest.fn();
        expect(await checkCurrentUserIsSuperAdmin({ rpc }, '')).toEqual({ isSuperAdmin: false, error: null });
        expect(rpc).not.toHaveBeenCalled();
    });
});
