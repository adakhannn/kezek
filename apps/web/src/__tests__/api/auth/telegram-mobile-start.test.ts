import { POST } from '@/app/api/auth/telegram/mobile/start/route';
import {
    createMockRequest,
    expectErrorResponse,
    expectSuccessResponse,
    setupApiTestMocks,
} from '../testHelpers';

setupApiTestMocks();

// Route tests exercise the HTTP envelope/feature gate, not persistent attempts.
// Keep the database/audit boundary explicit after the async-service extraction.
jest.mock('@/lib/telegramMobileStartRouteService', () => ({
    runTelegramMobileStartRoute: jest.fn(async () => ({
        ok: true,
        payload: { nonce: 'test-nonce', botDeepLink: 'https://t.me/kezek_auth_bot?start=test', expiresAt: 123456789 },
    })),
}));

describe('/api/auth/telegram/mobile/start', () => {
    const previousFlag = process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH;
    const previousRolloutPercent =
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;

    afterEach(() => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = previousFlag;
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT =
            previousRolloutPercent;
    });

    test('returns 503 when feature flag is disabled', async () => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'false';

        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            {
                method: 'POST',
                body: { codeChallenge: 'a'.repeat(64) },
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 503, 'service_unavailable');
    });

    test('returns nonce, botDeepLink and expiresAt', async () => {
        delete process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;

        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            {
                method: 'POST',
                body: { codeChallenge: 'a'.repeat(64) },
            },
        );

        const response = await POST(request);
        const data = await expectSuccessResponse(response, 200);

        expect(data).toHaveProperty('data.nonce');
        expect(data).toHaveProperty('data.botDeepLink');
        expect(data).toHaveProperty('data.expiresAt');
        expect(
            typeof (data as { data: { nonce: string } }).data.nonce,
        ).toBe('string');
    });

    test('rejects invalid json before creating an unbound attempt', async () => {
        delete process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT;

        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            {
                method: 'POST',
                body: '{',
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 400, 'validation');
    });

    test('returns 503 when rollout percentage is 0', async () => {
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH = 'true';
        process.env.MOBILE_TELEGRAM_DEEPLINK_AUTH_ROLLOUT_PERCENT = '0';

        const request = createMockRequest(
            'http://localhost/api/auth/telegram/mobile/start',
            {
                method: 'POST',
                body: { codeChallenge: 'a'.repeat(64) },
                headers: {
                    'x-mobile-rollout-key': 'test-user',
                },
            },
        );

        const response = await POST(request);
        await expectErrorResponse(response, 503, 'service_unavailable');
    });
});
