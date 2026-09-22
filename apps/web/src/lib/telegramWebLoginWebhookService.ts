import { answerTelegramCallbackQuery, sendTelegramBotMessage } from '@/lib/telegramBotApiService';
import type { ProfileLinkUpdate } from '@/lib/telegramProfileLinkWebhookService';
import { transitionWebLogin, webLoginCode } from '@/lib/telegramWebLoginService';

/** Called only by the secret-authenticated Telegram webhook. */
export async function handleWebLoginUpdate(update: ProfileLinkUpdate) {
    const start = update.message?.text?.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?\s+kw1_([A-Za-z0-9_-]{32})$/);
    const callback = update.callback_query;
    const decision = callback?.data?.match(/^kw1:(ok|no):([A-Za-z0-9_-]{32})$/);
    if (!start && !decision) return false;
    if (process.env.NEXT_PUBLIC_TELEGRAM_BOT_LOGIN_ENABLED !== 'true') return true;
    const message = start ? update.message : callback?.message;
    const actor = start ? message?.from : callback?.from;
    if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0 || message?.chat?.type !== 'private' || message.chat.id !== actor.id) return true;
    const token = start ? start[1] : decision![2];
    const result = await transitionWebLogin(token, start ? 'claim' : decision![1] === 'ok' ? 'approve' : 'cancel_bot', undefined, actor.id,
        [actor.first_name, actor.last_name].filter(Boolean).join(' '));
    if (decision && callback) await answerTelegramCallbackQuery({ callbackQueryId: callback.id });
    if (result.error) {
        await sendTelegramBotMessage({ chatId: actor.id, text: 'Запрос недоступен или открыт другим аккаунтом. Создайте новую ссылку на странице входа Kezek.' });
    } else if (start) {
        await sendTelegramBotMessage({ chatId: actor.id,
            text: `Вход в Kezek. Код запроса: ${webLoginCode(token)}\n\nПодтверждайте только вход, который вы сами начали на сайте. Сверьте код с кодом в своём браузере. Не открывайте ссылки для входа, присланные другими людьми. Это вход в ваш аккаунт, не привязка к чужому профилю.`,
            replyMarkup: { inline_keyboard: [[{ text: 'Подтвердить мой вход', callback_data: `kw1:ok:${token}` }], [{ text: 'Отменить', callback_data: `kw1:no:${token}` }]] },
        });
    } else await sendTelegramBotMessage({ chatId: actor.id, text: result.status === 'approved'
        ? 'Подтверждено. Вернитесь в свой браузер, проверьте аккаунт и завершите вход.' : 'Вход отменён.' });
    return true;
}
