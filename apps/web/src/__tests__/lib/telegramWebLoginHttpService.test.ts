import { NextRequest } from 'next/server';
import { runTelegramWebLoginHttp, WEB_LOGIN_COOKIE } from '@/lib/telegramWebLoginHttpService';
import { createWebLogin, readWebLogin, transitionWebLogin } from '@/lib/telegramWebLoginService';
const mockGetUser = jest.fn();
const mockGenerate = jest.fn();
const mockGetTarget = jest.fn();
const mockVerify = jest.fn();
jest.mock('@/lib/env', () => ({ getSupabaseUrl: () => 'https://example.supabase.co', getSupabaseAnonKey: () => 'anon' }));
jest.mock('@/lib/rateLimit', () => ({ routeRateLimit: (_: string, c: object) => c, withRateLimit: (_: unknown, __: unknown, fn: () => unknown) => fn() }));
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: () => ({ auth: { getUser: mockGetUser } }) }));
jest.mock('@/lib/supabaseService', () => ({ getServiceClient: () => ({ auth: { admin: { getUserById: mockGetTarget, generateLink: mockGenerate } } }) }));
jest.mock('@supabase/ssr', () => ({ createServerClient: () => ({ auth: { verifyOtp: mockVerify } }) }));
jest.mock('@/lib/telegramWebLoginService', () => ({
    WEB_LOGIN_TOKEN: /^[A-Za-z0-9_-]{32}$/, webLoginSecret: () => 's'.repeat(32),
    createWebLogin: jest.fn(), readWebLogin: jest.fn(), transitionWebLogin: jest.fn(),
}));
describe('browser-bound Telegram login API', () => {
    const original = process.env;
    const token = 't'.repeat(32);
    function request(action: string, cookie = true, origin = 'https://test.trycloudflare.com', extra = {}) {
        return new NextRequest('https://localhost:3000/api/auth/telegram/web-login', { method: 'POST', headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie: `${WEB_LOGIN_COOKIE}=${'s'.repeat(32)}` } : {}) }, body: JSON.stringify({ action, token, ...extra }) });
    }
    beforeEach(() => {
        jest.resetAllMocks();
        process.env = { ...original, NODE_ENV: 'test', NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED: 'true', NEXT_PUBLIC_TELEGRAM_BOT_USERNAME: 'test_bot', TELEGRAM_WEBHOOK_SECRET: 'test', LOCAL_AUTH_PUBLIC_ORIGIN: 'https://test.trycloudflare.com' };
        mockGetUser.mockResolvedValue({ data: { user: null } });
        (createWebLogin as jest.Mock).mockResolvedValue({ token, botDeepLink: `https://t.me/test_bot?start=kw1_${token}` });
        (transitionWebLogin as jest.Mock).mockResolvedValue({ user_id: 'user1', status: 'consumed' });
        mockGetTarget.mockResolvedValue({ data: { user: { id: 'user1', email: 'test@example.com' } } });
        mockGenerate.mockResolvedValue({ data: { user: { id: 'user1' }, properties: { hashed_token: 'private-token' } } });
        mockVerify.mockResolvedValue({ data: { user: { id: 'user1' }, session: { access_token: 'private-session' } } });
    });
    afterEach(() => { process.env = original; });
    test('fails closed when disabled', async () => {
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED = 'false';
        expect((await runTelegramWebLoginHttp(request('create'))).status).toBe(503);
        expect(createWebLogin).not.toHaveBeenCalled();
    });
    test('blocks cross-origin creation and status without the browser cookie', async () => {
        expect((await runTelegramWebLoginHttp(request('create', false, 'https://evil.test'))).status).toBe(403);
        expect((await runTelegramWebLoginHttp(request('status', false))).status).toBe(401);
        expect(readWebLogin).not.toHaveBeenCalled();
    });
    test('creation sets a private browser secret, not included in the bot link or JSON', async () => {
        const res = await runTelegramWebLoginHttp(request('create', false));
        expect(res.status).toBe(200);
        const cookie = res.headers.get('set-cookie');
        expect(cookie).toContain('HttpOnly'); expect(cookie).toContain('Secure'); expect(cookie?.toLowerCase()).toContain('samesite=strict');
        expect(await res.text()).not.toContain('s'.repeat(32));
    });
    test('does not silently switch an already signed-in account', async () => {
        mockGetUser.mockResolvedValue({ data: { user: { id: 'existing' } } });
        expect((await runTelegramWebLoginHttp(request('finish', true, undefined, { telegramId: 123 }))).status).toBe(409);
        expect(transitionWebLogin).not.toHaveBeenCalled();
    });
    test('never issues a session for an unlinked, unapproved or replayed request', async () => {
        for (const error of ['not_linked', 'not_approved', 'closed']) {
            (transitionWebLogin as jest.Mock).mockResolvedValue({ error });
            expect((await runTelegramWebLoginHttp(request('finish', true, undefined, { telegramId: 123 }))).status).toBe(409);
        }
        expect(mockGenerate).not.toHaveBeenCalled();
    });
    test('mints server-side session for exactly the consumed profile, no tokens in JSON', async () => {
        const res = await runTelegramWebLoginHttp(request('finish', true, undefined, { telegramId: 123 }));
        expect(res.status).toBe(200);
        expect(mockGenerate).toHaveBeenCalledWith({ type: 'magiclink', email: 'test@example.com' });
        expect(mockVerify).toHaveBeenCalledWith({ type: 'magiclink', token_hash: 'private-token' });
        expect(await res.json()).toEqual({ ok: true, data: { status: 'signed_in' } });
    });
    test('fails if the email resolves to a different user', async () => {
        mockGenerate.mockResolvedValue({ data: { user: { id: 'wrong' }, properties: { hashed_token: 'private-token' } } });
        expect((await runTelegramWebLoginHttp(request('finish', true, undefined, { telegramId: 123 }))).status).toBe(503);
        expect(mockVerify).not.toHaveBeenCalled();
    });
});
