import {
    __setTelegramMobileAuthAttemptStatusForTests,
    __resetTelegramMobileAuthAttemptsForTests,
    attachTelegramMobileAuthAttemptTelegramContext,
    consumePendingTelegramMobileAuthAttempt,
    createTelegramMobileAuthAttempt,
    getTelegramMobileAuthAttempt,
    getTelegramMobileAuthStatus,
} from '@/lib/telegramMobileAuthAttemptService';

describe('telegramMobileAuthAttemptService', () => {
    beforeEach(() => {
        __resetTelegramMobileAuthAttemptsForTests();
    });

    test('creates pending auth attempt with nonce, bot link and expiresAt', () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        expect(typeof started.nonce).toBe('string');
        expect(started.nonce.length).toBeGreaterThan(20);
        expect(started.botDeepLink).toBe(
            `https://t.me/kezek_auth_bot?start=km1_${started.nonce}`,
        );
        expect(started.expiresAt).toBeGreaterThan(Date.now());

        const attempt = getTelegramMobileAuthAttempt(started.nonce);
        expect(attempt).not.toBeNull();
        expect(attempt?.status).toBe('pending');
    });

    test('generates unique nonce values with telegram-safe format', () => {
        const first = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        const second = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        expect(first.nonce).not.toBe(second.nonce);
        expect(first.nonce).toMatch(/^[A-Za-z0-9_-]{20,128}$/);
        expect(second.nonce).toMatch(/^[A-Za-z0-9_-]{20,128}$/);
    });

    test('returns failed status for unknown nonce', () => {
        const status = getTelegramMobileAuthStatus('unknown');
        expect(status.status).toBe('failed');
        expect(status.expiresAt).toBeNull();
    });

    test('returns expired status when ttl elapsed', async () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 1,
        });

        await new Promise((resolve) => setTimeout(resolve, 5));

        const status = getTelegramMobileAuthStatus(started.nonce);
        expect(status.status).toBe('expired');
        expect(status.expiresAt).not.toBeNull();
    });

    test('returns approved status when attempt approved', () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        __setTelegramMobileAuthAttemptStatusForTests(started.nonce, 'approved');

        const status = getTelegramMobileAuthStatus(started.nonce);
        expect(status.status).toBe('approved');
    });

    test('stores source metadata when start payload includes source info', () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
            source: {
                appName: 'Kezek Android',
                region: 'Bishkek',
                device: 'Pixel 7',
            },
        });

        const attempt = getTelegramMobileAuthAttempt(started.nonce);
        expect(attempt?.source).toEqual({
            appName: 'Kezek Android',
            region: 'Bishkek',
            device: 'Pixel 7',
        });
    });

    test('marks nonce as consumed after first use and blocks second consume', () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        const first = consumePendingTelegramMobileAuthAttempt(started.nonce);
        expect(first.ok).toBe(true);
        if (!first.ok) {
            return;
        }

        expect(first.attempt.status).toBe('consumed');
        expect(typeof first.attempt.consumedAt).toBe('number');

        const second = consumePendingTelegramMobileAuthAttempt(started.nonce);
        expect(second).toEqual({
            ok: false,
            error: 'invalid_status',
        });
    });

    test('binds telegram context to pending attempt', () => {
        const started = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });

        const bound = attachTelegramMobileAuthAttemptTelegramContext({
            nonce: started.nonce,
            telegramId: 12345,
            chatId: 54321,
            username: 'kezek_user',
        });

        expect(bound.ok).toBe(true);
        if (!bound.ok) {
            return;
        }

        expect(bound.attempt.expectedTelegramId).toBe(12345);
        expect(bound.attempt.telegramChatId).toBe(54321);
        expect(bound.attempt.telegramUsername).toBe('kezek_user');
    });
});
