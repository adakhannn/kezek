import { NextRequest } from 'next/server';

import {
    __resetTelegramMobileAuthAttemptsForTests,
    createTelegramMobileAuthAttempt,
} from '@/lib/telegramMobileAuthAttemptService';
import { runTelegramWebhookPostHttp } from '@/lib/telegramWebhookHttpService';

const mockSendTelegramBotMessage = jest.fn();
const mockEditTelegramBotMessageText = jest.fn();
const mockAnswerTelegramCallbackQuery = jest.fn();
const mockRunTelegramMobileCallbackRoute = jest.fn();
const mockWriteTelegramAuthAuditEvent = jest.fn();

jest.mock('@/lib/telegramBotApiService', () => ({
    sendTelegramBotMessage: (...args: unknown[]) =>
        mockSendTelegramBotMessage(...args),
    editTelegramBotMessageText: (...args: unknown[]) =>
        mockEditTelegramBotMessageText(...args),
    answerTelegramCallbackQuery: (...args: unknown[]) =>
        mockAnswerTelegramCallbackQuery(...args),
}));

jest.mock('@/lib/telegramMobileCallbackRouteService', () => ({
    runTelegramMobileCallbackRoute: (...args: unknown[]) =>
        mockRunTelegramMobileCallbackRoute(...args),
}));

jest.mock('@/lib/telegramAuthAuditLogService', () => ({
    writeTelegramAuthAuditEvent: (...args: unknown[]) =>
        mockWriteTelegramAuthAuditEvent(...args),
}));

describe('telegramWebhookHttpService', () => {
    afterEach(() => {
        jest.clearAllMocks();
        __resetTelegramMobileAuthAttemptsForTests();
    });

    test('handles /start payload and sends approval message with source details', async () => {
        const attempt = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
            source: {
                appName: 'Kezek Android',
                region: 'Bishkek',
                device: 'Pixel 7',
                platform: 'Android',
            },
        });

        const response = await runTelegramWebhookPostHttp(
            new NextRequest('http://localhost/api/webhooks/telegram', {
                method: 'POST',
                body: JSON.stringify({
                    update_id: 1,
                    message: {
                        message_id: 10,
                        text: `/start km1_${attempt.nonce}`,
                        chat: { id: 9001 },
                        from: {
                            id: 12345,
                            username: 'test_user',
                            first_name: 'Test',
                        },
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mockSendTelegramBotMessage).toHaveBeenCalledTimes(1);
        expect(mockSendTelegramBotMessage.mock.calls[0][0]).toMatchObject({
            chatId: 9001,
        });
        expect(String(mockSendTelegramBotMessage.mock.calls[0][0].text)).toContain(
            'Приложение: Kezek Android',
        );
        expect(mockSendTelegramBotMessage.mock.calls[0][0].replyMarkup).toEqual({
            inline_keyboard: [
                [
                    {
                        text: 'Подтвердить вход',
                        callback_data: `km1c:ok:${attempt.nonce}`,
                    },
                ],
                [
                    {
                        text: 'Отменить',
                        callback_data: `km1c:cancel:${attempt.nonce}`,
                    },
                ],
            ],
        });
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_start_opened',
                nonce: attempt.nonce,
                telegramId: 12345,
            }),
        );
    });

    test('passes cancel callback payload to mobile callback route', async () => {
        const attempt = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        mockRunTelegramMobileCallbackRoute.mockResolvedValue({
            ok: true,
            payload: {
                status: 'failed',
                nonce: attempt.nonce,
                decision: 'cancel',
                expiresAt: Date.now() + 60_000,
            },
        });

        const response = await runTelegramWebhookPostHttp(
            new NextRequest('http://localhost/api/webhooks/telegram', {
                method: 'POST',
                body: JSON.stringify({
                    update_id: 2,
                    callback_query: {
                        id: 'cb-1',
                        data: `km1c:cancel:${attempt.nonce}`,
                        from: {
                            id: 12345,
                            first_name: 'Test',
                        },
                        message: {
                            message_id: 77,
                            chat: { id: 9001 },
                        },
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mockAnswerTelegramCallbackQuery).toHaveBeenCalled();
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_decision_received',
                nonce: attempt.nonce,
                telegramId: 12345,
                decision: 'cancel',
            }),
        );
        expect(mockRunTelegramMobileCallbackRoute).toHaveBeenCalledWith({
            body: {
                nonce: attempt.nonce,
                telegram_id: 12345,
                decision: 'cancel',
                first_name: 'Test',
                last_name: undefined,
                username: undefined,
            },
            botSecret: process.env.TELEGRAM_MOBILE_BOT_SECRET || null,
        });
        expect(mockEditTelegramBotMessageText).toHaveBeenCalledWith({
            chatId: 9001,
            messageId: 77,
            text: 'Вход отменен. Если нужно, начните вход заново в приложении.',
        });
    });

    test('passes approve callback payload to mobile callback route', async () => {
        const attempt = createTelegramMobileAuthAttempt({
            botUsername: 'kezek_auth_bot',
            ttlMs: 60_000,
        });
        mockRunTelegramMobileCallbackRoute.mockResolvedValue({
            ok: true,
            payload: {
                status: 'approved',
                nonce: attempt.nonce,
                decision: 'approve',
                expiresAt: Date.now() + 60_000,
            },
        });

        const response = await runTelegramWebhookPostHttp(
            new NextRequest('http://localhost/api/webhooks/telegram', {
                method: 'POST',
                body: JSON.stringify({
                    update_id: 3,
                    callback_query: {
                        id: 'cb-2',
                        data: `km1c:ok:${attempt.nonce}`,
                        from: {
                            id: 12345,
                            first_name: 'Test',
                            username: 'test_user',
                        },
                        message: {
                            message_id: 78,
                            chat: { id: 9001 },
                        },
                    },
                }),
            }),
        );

        expect(response.status).toBe(200);
        expect(mockWriteTelegramAuthAuditEvent).toHaveBeenCalledWith(
            expect.objectContaining({
                eventType: 'bot_decision_received',
                nonce: attempt.nonce,
                telegramId: 12345,
                decision: 'approve',
            }),
        );
        expect(mockRunTelegramMobileCallbackRoute).toHaveBeenCalledWith({
            body: {
                nonce: attempt.nonce,
                telegram_id: 12345,
                decision: 'approve',
                first_name: 'Test',
                last_name: undefined,
                username: 'test_user',
            },
            botSecret: process.env.TELEGRAM_MOBILE_BOT_SECRET || null,
        });
        expect(mockEditTelegramBotMessageText).toHaveBeenCalledWith({
            chatId: 9001,
            messageId: 78,
            text: 'Вход подтвержден. Вернитесь в приложение Kezek, авторизация завершится автоматически.',
        });
    });
});
