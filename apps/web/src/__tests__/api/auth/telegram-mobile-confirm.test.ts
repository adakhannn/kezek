import { POST } from '@/app/api/auth/telegram/mobile/confirm/route';
import {
    attachTelegramMobileAuthAttemptTelegramContext,
    consumePendingTelegramMobileAuthAttempt,
    createTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { __resetTelegramMobileBotRequestReplayStoreForTests } from '@/lib/telegramMobileBotRequestAuth';
import { __resetNonceProbeProtectionForTests } from '@/lib/telegramMobileNonceProbeProtection';
import type { TelegramMobileAuthAttempt } from '@/lib/telegramMobileAuthAttemptService';
import {
    createTelegramMobileSignedHeaders,
    createMockRequest,
    expectErrorResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

// The route keeps real signature/replay/validation handling. Persistence is a
// deterministic async fixture: these tests must not call the development DB or
// treat a Promise as the old synchronous in-memory attempt record.
const mockAttempts = new Map<string, TelegramMobileAuthAttempt>();
let mockAttemptCounter = 0;
jest.mock('@/lib/telegramMobileAuthAttemptService', () => ({
    createTelegramMobileAuthAttempt: jest.fn(async ({ ttlMs = 60_000 }: { ttlMs?: number }) => {
        const nonce = `fixture-${++mockAttemptCounter}`;
        const attempt: TelegramMobileAuthAttempt = {
            nonce, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + ttlMs,
        };
        mockAttempts.set(nonce, attempt);
        return { nonce, botDeepLink: `https://t.me/kezek_auth_bot?start=${nonce}`, expiresAt: attempt.expiresAt };
    }),
    getTelegramMobileAuthAttempt: jest.fn(async (nonce: string) => mockAttempts.get(nonce) ?? null),
    attachTelegramMobileAuthAttemptTelegramContext: jest.fn(async ({ nonce, telegramId }: { nonce: string; telegramId: number }) => {
        const attempt = mockAttempts.get(nonce);
        if (attempt) attempt.expectedTelegramId = telegramId;
    }),
    consumePendingTelegramMobileAuthAttempt: jest.fn(async (nonce: string) => {
        const attempt = mockAttempts.get(nonce);
        if (!attempt) return { ok: false, error: 'not_found' };
        if (attempt.expiresAt <= Date.now()) return { ok: false, error: 'expired' };
        if (attempt.status !== 'pending') return { ok: false, error: 'consumed' };
        attempt.status = 'consumed';
        return { ok: true, attempt };
    }),
    markTelegramMobileAuthAttemptApproved: jest.fn(),
    markTelegramMobileAuthAttemptFailed: jest.fn(),
}));

describe('/api/auth/telegram/mobile/confirm', () => {
    const previousSecret = process.env.TELEGRAM_MOBILE_BOT_SECRET;
    const previousFlag = process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH;
    const previousRollout = process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;

    beforeEach(() => {
        jest.clearAllMocks();
        mockAttempts.clear();
        mockAttemptCounter = 0;
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'true';
        delete process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;
    });

    afterEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = previousSecret;
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = previousFlag;
        if (previousRollout === undefined) delete process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;
        else process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT = previousRollout;
        __resetNonceProbeProtectionForTests();
        __resetTelegramMobileBotRequestReplayStoreForTests();
    });

    test('returns 503 when feature flag is disabled', async () => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'false';
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';

        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 503, 'service_unavailable');
    });

    test('returns 503 when TELEGRAM_MOBILE_BOT_SECRET is not configured', async () => {
        delete process.env.TELEGRAM_MOBILE_BOT_SECRET;

        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                body: {
                    ...body,
                },
                headers: createTelegramMobileSignedHeaders({
                    secret: 'any-secret',
                    body,
                }),
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 503, 'service_unavailable');
    });

    test('returns 401 when secret is invalid', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';

        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: {
                    ...createTelegramMobileSignedHeaders({
                        secret: 'wrong-secret',
                        body,
                    }),
                },
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 401, 'auth');
    });

    test('returns 401 when signature is invalid', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
        };
        const headers = createTelegramMobileSignedHeaders({
            secret: 'expected-secret',
            body,
        });
        headers['x-telegram-bot-signature'] = '00'.repeat(32);

        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers,
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 401, 'auth');
    });

    test('returns 404 when nonce is not found', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';

        const body = {
            nonce: 'unknown-nonce',
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 404, 'not_found');
    });

    test('returns 400 for invalid body', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';

        const body = {
            nonce: 'nonce-only',
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, 'validation');
    });

    test('returns 410 for expired pending nonce', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const started = await createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 1,
        });
        await new Promise((resolve) => setTimeout(resolve, 5));

        const body = {
            nonce: started.nonce,
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 410, 'conflict');
    });

    test('returns 409 when nonce is bound to another telegram account', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const started = await createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        await attachTelegramMobileAuthAttemptTelegramContext({
            nonce: started.nonce,
            telegramId: 77777,
            chatId: 77777,
        });

        const body = {
            nonce: started.nonce,
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, 'conflict');
    });

    test('returns 409 when nonce is already consumed', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const started = await createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        const consumed = await consumePendingTelegramMobileAuthAttempt(started.nonce);
        expect(consumed.ok).toBe(true);

        const body = {
            nonce: started.nonce,
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers: createTelegramMobileSignedHeaders({
                    secret: 'expected-secret',
                    body,
                }),
                body,
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 409, 'conflict');
    });

    test('rejects replayed signed request', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const body = {
            nonce: 'unknown-nonce',
            telegram_id: 12345,
        };
        const headers = createTelegramMobileSignedHeaders({
            secret: 'expected-secret',
            body,
            requestId: 'replay-req-1',
        });

        const firstRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers,
                body,
            },
        );
        const firstResponse = await POST(firstRequest);
        await expectErrorResponse(firstResponse, 404, 'not_found');

        const secondRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/confirm',
            {
                method: 'POST',
                headers,
                body,
            },
        );
        const secondResponse = await POST(secondRequest);
        await expectErrorResponse(secondResponse, 409, 'conflict');
    });
});
