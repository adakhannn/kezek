import { handleProfileLinkUpdate } from '@/lib/telegramProfileLinkWebhookService';
import { transitionProfileLink } from '@/lib/telegramProfileLinkService';
import { sendTelegramBotMessage } from '@/lib/telegramBotApiService';
jest.mock('@/lib/telegramProfileLinkService', () => ({ transitionProfileLink: jest.fn(), profileLinkErrorMessage: (code: string) => code }));
jest.mock('@/lib/telegramBotApiService', () => ({ sendTelegramBotMessage: jest.fn(), answerTelegramCallbackQuery: jest.fn() }));
const token = 'a'.repeat(32);
const actor = { id: 123, first_name: 'Test', username: 'test' };
describe('Telegram profile-link bot protocol', () => {
    const previous = process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED;
    beforeEach(() => { process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED = 'true'; jest.clearAllMocks(); (transitionProfileLink as jest.Mock).mockResolvedValue({ status: 'pending' }); });
    afterAll(() => { if (previous === undefined) delete process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED; else process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED = previous; });
    test('does not intercept the existing mobile login flow', async () => {
        expect(await handleProfileLinkUpdate({ message: { text: '/start km1_' + token } })).toBe(false);
    });
    test.each(['group','supergroup','channel'])('rejects non-private %s', async (type) => {
        await handleProfileLinkUpdate({ message: { text: '/start kl1_' + token, from: actor, chat: { id: 123, type } } });
        expect(transitionProfileLink).not.toHaveBeenCalled();
    });
    test('start only claims identity and requests explicit consent', async () => {
        await handleProfileLinkUpdate({ message: { text: '/start kl1_' + token, from: actor, chat: { id: 123, type: 'private' } } });
        expect(transitionProfileLink).toHaveBeenCalledWith(expect.objectContaining({ token, action: 'claim', telegramId: 123 }));
        expect(sendTelegramBotMessage).toHaveBeenCalledWith(expect.objectContaining({ replyMarkup: expect.any(Object) }));
    });
    test('approval takes identity from callback sender, not bot message author', async () => {
        await handleProfileLinkUpdate({ callback_query: { id: 'cb', data: 'kl1:ok:' + token, from: actor, message: { from: { id: 999 }, chat: { id: 123, type: 'private' } } } });
        expect(transitionProfileLink).toHaveBeenCalledWith(expect.objectContaining({ action: 'approve', telegramId: 123 }));
    });
    test('rejects sender/chat mismatch', async () => {
        await handleProfileLinkUpdate({ callback_query: { id: 'cb', data: 'kl1:ok:' + token, from: actor, message: { chat: { id: 777, type: 'private' } } } });
        expect(transitionProfileLink).not.toHaveBeenCalled();
    });
});
