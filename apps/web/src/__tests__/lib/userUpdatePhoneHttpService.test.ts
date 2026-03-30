jest.mock('@/lib/supabaseHelpers', () => ({
    createSupabaseClients: jest.fn(),
}));

jest.mock('@/lib/userUpdatePhoneService', () => ({
    runUserUpdatePhone: jest.fn(),
}));

import { createSupabaseClients } from '@/lib/supabaseHelpers';
import { runUserUpdatePhoneHttp } from '@/lib/userUpdatePhoneHttpService';
import { runUserUpdatePhone } from '@/lib/userUpdatePhoneService';

describe('userUpdatePhoneHttpService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseClients as jest.Mock).mockResolvedValue({
            supabase: { auth: { getUser: jest.fn() } },
            admin: { auth: { admin: { updateUserById: jest.fn() } } },
        });
    });

    test('delegates valid request to phone update service', async () => {
        (runUserUpdatePhone as jest.Mock).mockResolvedValue({ ok: true });

        const response = await runUserUpdatePhoneHttp(
            new Request('http://localhost/api/user/update-phone', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ phone: '+77001234567' }),
            }),
        );
        const body = await response.json();

        expect(runUserUpdatePhone).toHaveBeenCalledWith({
            supabase: expect.any(Object),
            admin: expect.any(Object),
            phone: '+77001234567',
        });
        expect(response.status).toBe(200);
        expect(body.ok).toBe(true);
    });

    test('maps service auth errors', async () => {
        (runUserUpdatePhone as jest.Mock).mockResolvedValue({
            ok: false,
            error: 'auth',
            message: 'not authorized',
            status: 401,
        });

        const response = await runUserUpdatePhoneHttp(
            new Request('http://localhost/api/user/update-phone', {
                method: 'POST',
                body: JSON.stringify({ phone: '+77001234567' }),
            }),
        );
        const body = await response.json();

        expect(response.status).toBe(401);
        expect(body.error).toBe('auth');
    });
});
