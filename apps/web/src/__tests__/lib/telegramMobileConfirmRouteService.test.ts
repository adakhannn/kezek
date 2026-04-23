import {
    __resetTelegramMobileAuthAttemptsForTests,
    __setTelegramMobileAuthAttemptStatusForTests,
    createTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { runTelegramMobileConfirmRoute } from '@/lib/telegramMobileConfirmRouteService';

describe('telegramMobileConfirmRouteService', () => {
    const previousSecret = process.env.TELEGRAM_MOBILE_BOT_SECRET;

    beforeEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = 'expected-secret';
        __resetTelegramMobileAuthAttemptsForTests();
    });

    afterEach(() => {
        process.env.TELEGRAM_MOBILE_BOT_SECRET = previousSecret;
    });

    test('returns same approved result for repeated confirm with same telegram_id', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        __setTelegramMobileAuthAttemptStatusForTests(started.nonce, 'approved', {
            telegramId: 12345,
            userId: 'user-1',
            exchangeCode: 'CODE1',
            linkage: 'existing',
        });

        const result = await runTelegramMobileConfirmRoute({
            botSecret: 'expected-secret',
            body: {
                nonce: started.nonce,
                telegram_id: 12345,
            },
        });

        expect(result).toEqual({
            ok: true,
            payload: {
                status: 'approved',
                nonce: started.nonce,
                expiresAt: expect.any(Number),
                linkage: 'existing',
            },
        });
    });

    test('returns conflict for repeated confirm from different telegram_id', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        __setTelegramMobileAuthAttemptStatusForTests(started.nonce, 'approved', {
            telegramId: 77777,
            userId: 'user-1',
            exchangeCode: 'CODE1',
            linkage: 'existing',
        });

        const result = await runTelegramMobileConfirmRoute({
            botSecret: 'expected-secret',
            body: {
                nonce: started.nonce,
                telegram_id: 12345,
            },
        });

        expect(result.ok).toBe(false);
        if (result.ok) {
            return;
        }
        expect(result.status).toBe(409);
        expect(result.error).toBe('conflict');
    });
});
