import { handleWebLoginUpdate } from '@/lib/telegramWebLoginWebhookService';
import { transitionWebLogin } from '@/lib/telegramWebLoginService';
import { sendTelegramBotMessage } from '@/lib/telegramBotApiService';
jest.mock('@/lib/telegramWebLoginService', () => ({ transitionWebLogin: jest.fn().mockResolvedValue({ status: 'pending' }), webLoginCode: () => 'ABC123' }));
jest.mock('@/lib/telegramBotApiService', () => ({ sendTelegramBotMessage: jest.fn(), answerTelegramCallbackQuery: jest.fn() }));
describe('Telegram web login webhook', () => {
    const env = process.env;
    const token = 'a'.repeat(32);
    beforeEach(() => { jest.clearAllMocks(); process.env = { ...env, NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED: 'true' }; });
    afterEach(() => { process.env = env; });
    const message = { text: `/start kw1_${token}`, from: { id: 123, first_name: 'Test' }, chat: { id: 123, type: 'private' } };
    test('claims without approval, and clearly warns about unsolicited login links', async () => {
        expect(await handleWebLoginUpdate({ message })).toBe(true);
        expect(transitionWebLogin).toHaveBeenCalledWith(token, 'claim', undefined, 123, 'Test');
        expect(sendTelegramBotMessage).toHaveBeenCalledWith(expect.objectContaining({ text: expect.stringContaining('ABC123') }));
    });
    test('approves only the actor in a private callback', async () => {
        await handleWebLoginUpdate({ callback_query: { id: 'cb', data: `kw1:ok:${token}`, from: { id: 123 }, message } });
        expect(transitionWebLogin).toHaveBeenCalledWith(token, 'approve', undefined, 123, '');
    });
    test('rejects group and mismatched actor context', async () => {
        await handleWebLoginUpdate({ message: { ...message, chat: { id: 123, type: 'group' } } });
        await handleWebLoginUpdate({ message: { ...message, from: { id: 456 } } });
        expect(transitionWebLogin).not.toHaveBeenCalled();
    });
    test('does not claim profile linking or mobile login payloads', async () => {
        expect(await handleWebLoginUpdate({ message: { ...message, text: `/start kl1_${token}` } })).toBe(false);
        expect(transitionWebLogin).not.toHaveBeenCalled();
    });
    test('disabled feature does not touch storage', async () => {
        process.env.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED = 'false';
        await handleWebLoginUpdate({ message });
        expect(transitionWebLogin).not.toHaveBeenCalled();
    });
});
