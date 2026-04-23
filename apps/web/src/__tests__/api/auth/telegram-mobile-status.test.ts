import { GET } from '@/app/api/auth/telegram/mobile/status/route';
import {
    createMockNextRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';
import {
    __setTelegramMobileAuthAttemptStatusForTests,
    consumePendingTelegramMobileAuthAttempt,
    createTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { __resetNonceProbeProtectionForTests } from '@/lib/telegramMobileNonceProbeProtection';

setupApiTestMocks();

describe('/api/auth/telegram/mobile/status', () => {
    const previousFlag = process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH;

    afterEach(() => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = previousFlag;
        __resetNonceProbeProtectionForTests();
    });

    test('returns 503 when feature flag is disabled', async () => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'false';

        const request = createMockNextRequest(
            'http://localhost/api/auth/telegram/mobile/status?nonce=any',
            { method: 'GET' },
        );

        const response = await GET(request);
        await expectErrorResponse(response, 503, 'service_unavailable');
    });

    test('returns pending for active nonce', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        const request = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(started.nonce)}`,
            { method: 'GET' },
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.status', 'pending');
    });

    test('returns failed for unknown nonce', async () => {
        const request = createMockNextRequest(
            'http://localhost/api/auth/telegram/mobile/status?nonce=unknown',
            { method: 'GET' },
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.status', 'failed');
    });

    test('returns exchangeCode when nonce is approved', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        __setTelegramMobileAuthAttemptStatusForTests(started.nonce, 'approved', {
            exchangeCode: 'ABC123',
        });

        const request = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(started.nonce)}`,
            { method: 'GET' },
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.status', 'approved');
        expect(data).toHaveProperty('data.exchangeCode', 'ABC123');
    });

    test('returns expired for timed out nonce', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 1,
        });
        await new Promise((resolve) => setTimeout(resolve, 5));

        const request = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(started.nonce)}`,
            { method: 'GET' },
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.status', 'expired');
    });

    test('returns pending when nonce is in consumed state', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        const consumed = consumePendingTelegramMobileAuthAttempt(started.nonce);
        expect(consumed.ok).toBe(true);

        const request = createMockNextRequest(
            `http://localhost/api/auth/telegram/mobile/status?nonce=${encodeURIComponent(started.nonce)}`,
            { method: 'GET' },
        );

        const response = await GET(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.status', 'pending');
    });

    test('returns 400 when nonce missing', async () => {
        const request = createMockNextRequest(
            'http://localhost/api/auth/telegram/mobile/status',
            { method: 'GET' },
        );

        const response = await GET(request);
        await expectErrorResponse(response, 400, 'validation');
    });

    test('blocks brute-force probing after many invalid nonces', async () => {
        for (let i = 0; i < 10; i += 1) {
            const request = createMockNextRequest(
                `http://localhost/api/auth/telegram/mobile/status?nonce=unknown-${i}`,
                { method: 'GET' },
            );
            const response = await GET(request);
            await expectSuccessResponse(response, 200);
        }

        const blockedRequest = createMockNextRequest(
            'http://localhost/api/auth/telegram/mobile/status?nonce=unknown-final',
            { method: 'GET' },
        );
        const blockedResponse = await GET(blockedRequest);
        await expectErrorResponse(blockedResponse, 429, 'rate_limit');
    });
});
