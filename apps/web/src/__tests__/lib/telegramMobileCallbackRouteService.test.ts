import { runTelegramMobileCallbackRoute } from '@/lib/telegramMobileCallbackRouteService';

const mockGetTelegramMobileAuthAttempt = jest.fn();
const mockMarkTelegramMobileAuthAttemptFailed = jest.fn();
const mockRunTelegramMobileConfirmRoute = jest.fn();
const mockWriteTelegramAuthAuditEvent = jest.fn();

jest.mock('@/lib/telegramMobileAuthAttemptService', () => ({
    getTelegramMobileAuthAttempt: (...args: unknown[]) =>
        mockGetTelegramMobileAuthAttempt(...args),
    markTelegramMobileAuthAttemptFailed: (...args: unknown[]) =>
        mockMarkTelegramMobileAuthAttemptFailed(...args),
}));

jest.mock('@/lib/telegramMobileConfirmRouteService', () => ({
    runTelegramMobileConfirmRoute: (...args: unknown[]) =>
        mockRunTelegramMobileConfirmRoute(...args),
}));

jest.mock('@/lib/telegramAuthAuditLogService', () => ({
    writeTelegramAuthAuditEvent: (...args: unknown[]) =>
        mockWriteTelegramAuthAuditEvent(...args),
}));

describe('telegramMobileCallbackRouteService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('writes audit for invalid payload', async () => {
        const result = await runTelegramMobileCallbackRoute({
            body: {
                nonce: '',
                telegram_id: 0,
                decision: 'approve',
            },
        });

        expect(result.ok).toBe(false);
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_login_failed',
                reason: 'invalid_callback_payload',
                status: 'validation_error',
            }),
        );
    });

    test('writes cancelled audit for cancel decision', async () => {
        mockGetTelegramMobileAuthAttempt.mockReturnValue({
            nonce: 'nonce-1',
            status: 'pending',
            expiresAt: Date.now() + 60_000,
        });

        const result = await runTelegramMobileCallbackRoute({
            body: {
                nonce: 'nonce-1',
                telegram_id: 12345,
                decision: 'cancel',
            },
        });

        expect(result.ok).toBe(true);
        expect(mockMarkTelegramMobileAuthAttemptFailed).toHaveBeenCalledWith({
            nonce: 'nonce-1',
            reason: 'cancelled_by_telegram_user',
        });
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_login_cancelled',
                nonce: 'nonce-1',
                telegramId: 12345,
                decision: 'cancel',
            }),
        );
    });

    test('writes approved audit for approve decision', async () => {
        mockRunTelegramMobileConfirmRoute.mockResolvedValue({
            ok: true,
            payload: {
                status: 'approved',
                nonce: 'nonce-2',
                expiresAt: Date.now() + 60_000,
                linkage: 'existing',
            },
        });

        const result = await runTelegramMobileCallbackRoute({
            body: {
                nonce: 'nonce-2',
                telegram_id: 12345,
                decision: 'approve',
            },
            botSecret: 'secret',
        });

        expect(result.ok).toBe(true);
        expect(mockRunTelegramMobileConfirmRoute).toHaveBeenCalled();
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_login_approved',
                nonce: 'nonce-2',
                telegramId: 12345,
                decision: 'approve',
                linkage: 'existing',
            }),
        );
    });
});
