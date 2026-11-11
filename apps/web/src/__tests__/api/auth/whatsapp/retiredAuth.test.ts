import { POST as createSession } from '@/app/api/auth/whatsapp/create-session/route';
import { POST as sendOtp } from '@/app/api/auth/whatsapp/send-otp/route';
import { POST as verifyOtp } from '@/app/api/auth/whatsapp/verify-otp/route';
import { createSupabaseAdminClient } from '@/lib/supabaseHelpers';

jest.mock('@/lib/rateLimit', () => ({
    routeRateLimit: jest.fn((_route, config) => config),
    withRateLimit: jest.fn((_req, _config, handler) => handler()),
    RateLimitConfigs: { auth: {} },
}));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseAdminClient: jest.fn() }));
jest.mock('@/lib/senders/whatsapp', () => ({ sendWhatsAppMessage: jest.fn() }));
jest.mock('@/lib/log', () => ({ logError: jest.fn(), logDebug: jest.fn() }));

const victim = '11111111-1111-4111-8111-111111111111';
const actions = [
    { path: 'create-session', post: createSession },
    { path: 'send-otp', post: sendOtp },
    { path: 'verify-otp', post: verifyOtp },
];

describe('retired WhatsApp authentication protocol', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (createSupabaseAdminClient as jest.Mock).mockReturnValue({
            auth: { admin: {
                getUserById: jest.fn().mockResolvedValue({ data: { user: { id: victim, email: 'victim@example.invalid' } }, error: null }),
                updateUserById: jest.fn().mockResolvedValue({ error: null }),
                listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
            } },
            from: jest.fn(() => { throw new Error('A retired endpoint must not access the database'); }),
        });
    });

    test.each(actions)('$path never opens an account or sends an OTP for an unauthenticated caller', async ({ path, post }) => {
        const request = new Request(`https://example.invalid/api/auth/whatsapp/${path}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(path === 'create-session' ? { userId: victim } : { phone: '+996555000000', code: '123456' }),
        });
        const response = await post(request);
        expect(response.status).toBe(410);
        expect(response.headers.get('Cache-Control')).toBe('no-store');
        expect(await response.json()).toEqual({
            ok: false,
            error: 'auth_protocol_retired',
            message: 'Этот способ входа больше не поддерживается. Откройте актуальную страницу входа.',
        });
        expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    });

    test.each(actions)('$path rejects even malformed input without reading the body or touching Auth', async ({ path, post }) => {
        const request = new Request(`https://example.invalid/api/auth/whatsapp/${path}`, { method: 'POST', body: '{' });
        const readBody = jest.spyOn(request, 'json');
        const response = await post(request);
        expect(response.status).toBe(410);
        expect(readBody).not.toHaveBeenCalled();
        expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    });
});
