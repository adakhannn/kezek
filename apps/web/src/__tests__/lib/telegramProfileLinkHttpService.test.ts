import { runTelegramProfileLinkHttp } from '@/lib/telegramProfileLinkHttpService';
import { createProfileLink, readProfileLink, transitionProfileLink } from '@/lib/telegramProfileLinkService';
import { createSupabaseServerClient } from '@/lib/supabaseHelpers';
jest.mock('@/lib/supabaseHelpers', () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock('@/lib/telegramProfileLinkService', () => ({
    ...jest.requireActual('@/lib/telegramProfileLinkService'),
    createProfileLink: jest.fn(), readProfileLink: jest.fn(), transitionProfileLink: jest.fn(),
}));
jest.mock('@/lib/rateLimit', () => ({
    routeRateLimit: jest.requireActual('@/lib/rateLimit').routeRateLimit,
    withRateLimit: (_req: Request, _config: object, handler: () => Promise<Response>) => handler(),
}));
const token = 'a'.repeat(32);
const req = (body: object, origin = 'https://example.com') => new Request('https://example.com/api/auth/telegram/profile-link', {
    method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
describe('profile link HTTP trust boundary', () => {
    const saved = { ...process.env };
    beforeEach(() => {
        jest.clearAllMocks(); delete process.env.LOCAL_AUTH_PUBLIC_ORIGIN; delete process.env.YANDEX_OAUTH_PUBLIC_ORIGIN;
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED = 'true';
        process.env.TELEGRAM_WEBHOOK_SECRET = 'test-secret'; process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME = 'test_bot';
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: 'session-owner' } } }) } });
    });
    afterAll(() => { process.env = saved; });
    test('feature remains disabled until the agreed rollout', async () => {
        delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED;
        expect((await runTelegramProfileLinkHttp(req({ action: 'create' }))).status).toBe(503);
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
    });
    test('rejects cross-origin requests before session or mutation', async () => {
        expect((await runTelegramProfileLinkHttp(req({ action: 'create' }, 'https://evil.test'))).status).toBe(403);
        expect(createSupabaseServerClient).not.toHaveBeenCalled();
    });
    test('requires an authenticated session', async () => {
        (createSupabaseServerClient as jest.Mock).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null } }) } });
        expect((await runTelegramProfileLinkHttp(req({ action: 'create' }))).status).toBe(401);
    });
    test('fails closed when webhook secret is not configured', async () => {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
        expect((await runTelegramProfileLinkHttp(req({ action: 'create' }))).status).toBe(503);
        expect(createProfileLink).not.toHaveBeenCalled();
    });
    test('owner comes from the session, never the request', async () => {
        (transitionProfileLink as jest.Mock).mockResolvedValue({ status: 'consumed' });
        expect((await runTelegramProfileLinkHttp(req({ action: 'finish', token, telegramId: 123, ownerId: 'attacker' }))).status).toBe(200);
        expect(transitionProfileLink).toHaveBeenCalledWith({ token, action: 'finish', telegramId: 123, ownerId: 'session-owner' });
    });
    test('checks ownership before returning account details', async () => {
        (readProfileLink as jest.Mock).mockResolvedValue(null);
        expect((await runTelegramProfileLinkHttp(req({ action: 'status', token }))).status).toBe(404);
        expect(readProfileLink).toHaveBeenCalledWith('session-owner', token);
    });
    test('expired cancellation is idempotent so a new attempt can be created', async () => {
        (transitionProfileLink as jest.Mock).mockResolvedValue({ error: 'expired' });
        expect((await runTelegramProfileLinkHttp(req({ action: 'cancel', token }))).status).toBe(200);
    });
    test.each([{ action: 'finish', token, telegramId: -1 }, { action: 'status', token: 'bad' }, { action: 'approve', token }])('rejects invalid action or payload', async (body) => {
        expect((await runTelegramProfileLinkHttp(req(body))).status).toBe(400);
        expect(transitionProfileLink).not.toHaveBeenCalled();
    });
});
