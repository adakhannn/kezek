import { POST } from '@/app/api/auth/telegram/mobile/callback/route';
import {
    attachTelegramMobileAuthAttemptTelegramContext,
    createTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { __resetTelegramMobileBotRequestReplayStoreForTests } from '@/lib/telegramMobileBotRequestAuth';
import { __resetNonceProbeProtectionForTests } from '@/lib/telegramMobileNonceProbeProtection';
import {
    createTelegramMobileSignedHeaders,
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

describe('/api/auth/telegram/mobile/callback', () => {
    const previousSecret = process.env.TELEGRAM_MOBILE_BOT_SECRET;
    const previousFlag = process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH;

    afterEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = previousSecret;
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = previousFlag;
        __resetNonceProbeProtectionForTests();
        __resetTelegramMobileBotRequestReplayStoreForTests();
    });

    test('returns 503 when feature flag is disabled', async () => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'false';
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';

        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
            decision: 'cancel',
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
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

    test('returns validation error when decision is missing', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
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

    test('handles cancel decision', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        const body = {
            nonce: started.nonce,
            telegram_id: 12345,
            decision: 'cancel',
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
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
        const data = await expectSuccessResponse(response, 200);
        expect(data).toHaveProperty('data.status', 'failed');
        expect(data).toHaveProperty('data.decision', 'cancel');
    });

    test('returns conflict when cancel requested by different telegram account', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        attachTelegramMobileAuthAttemptTelegramContext({
            nonce: started.nonce,
            telegramId: 77777,
            chatId: 77777,
        });

        const body = {
            nonce: started.nonce,
            telegram_id: 12345,
            decision: 'cancel',
        };
        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
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

    test('rejects replayed callback request', async () => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        const body = {
            nonce: 'nonce',
            telegram_id: 12345,
            decision: 'cancel',
        };
        const headers = createTelegramMobileSignedHeaders({
            secret: 'expected-secret',
            body,
            requestId: 'callback-replay-1',
        });

        const firstRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
            {
                method: 'POST',
                headers,
                body,
            },
        );
        const firstResponse = await POST(firstRequest);
        await expectErrorResponse(firstResponse, 404, 'not_found');

        const secondRequest = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/callback',
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
