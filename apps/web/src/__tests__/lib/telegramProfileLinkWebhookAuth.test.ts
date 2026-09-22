import { NextRequest } from 'next/server';
import { runTelegramWebhookPostHttp } from '@/lib/telegramWebhookHttpService';
import { handleProfileLinkUpdate } from '@/lib/telegramProfileLinkWebhookService';
jest.mock('@/lib/telegramProfileLinkWebhookService', () => ({ handleProfileLinkUpdate: jest.fn(async () => true) }));
describe('Telegram webhook authentication', () => {
    const previous = process.env.TELEGRAM_WEBHOOK_SECRET;
    beforeEach(() => { jest.clearAllMocks(); process.env.TELEGRAM_WEBHOOK_SECRET = 'correct-secret'; });
    afterAll(() => { if (previous === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET; else process.env.TELEGRAM_WEBHOOK_SECRET = previous; });
    function req(secret?: string) { return new NextRequest('https://example.com/api/webhooks/telegram', {
        method: 'POST', headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {}, body: '{}',
    }); }
    test.each([undefined, 'wrong', 'wrong-secret!!'])('rejects missing or invalid secret %s', async (secret) => {
        expect((await runTelegramWebhookPostHttp(req(secret))).status).toBe(403);
        expect(handleProfileLinkUpdate).not.toHaveBeenCalled();
    });
    test('fails closed if server secret is missing', async () => {
        delete process.env.TELEGRAM_WEBHOOK_SECRET;
        expect((await runTelegramWebhookPostHttp(req())).status).toBe(503);
        expect(handleProfileLinkUpdate).not.toHaveBeenCalled();
    });
    test('dispatches after authentication', async () => {
        expect((await runTelegramWebhookPostHttp(req('correct-secret'))).status).toBe(200);
        expect(handleProfileLinkUpdate).toHaveBeenCalledTimes(1);
    });
});
