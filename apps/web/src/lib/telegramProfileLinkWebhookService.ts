import { answerTelegramCallbackQuery, sendTelegramBotMessage } from '@/lib/telegramBotApiService';
import { profileLinkErrorMessage, transitionProfileLink } from '@/lib/telegramProfileLinkService';

type Actor = { id: number; username?: string; first_name?: string; last_name?: string };
type Message = { text?: string; from?: Actor; chat?: { id: number; type?: string } };
export type ProfileLinkUpdate = { message?: Message;
    callback_query?: { id: string; data?: string; from?: Actor; message?: Message };
};

/** Invoked only after authentication of the shared Telegram webhook. */
export async function handleProfileLinkUpdate(update: ProfileLinkUpdate): Promise<boolean> {
    const start = update.message?.text?.trim().match(/^\/start(?:@[A-Za-z0-9_]+)?\s+kl1_([A-Za-z0-9_-]{32})$/);
    const callback = update.callback_query;
    const decision = callback?.data?.match(/^kl1:(ok|no):([A-Za-z0-9_-]{32})$/);
    if (!start && !decision) return false;
    if (process.env.NEXT_PUBLIC_TELEGRAM_BOT_LINK_ENABLED !== 'true') return true;
    const message = start ? update.message : callback?.message;
    const actor = start ? message?.from : callback?.from;
    if (!actor || !Number.isSafeInteger(actor.id) || actor.id <= 0
        || message?.chat?.type !== 'private' || message.chat.id !== actor.id) return true;
    const token = start ? start[1] : decision![2];
    const result = await transitionProfileLink({ token, telegramId: actor.id,
        action: start ? 'claim' : decision![1] === 'ok' ? 'approve' : 'cancel_bot',
        username: actor.username, name: [actor.first_name, actor.last_name].filter(Boolean).join(' '),
    });
    if (callback && decision) await answerTelegramCallbackQuery({ callbackQueryId: callback.id });
    if (result.error) {
        await sendTelegramBotMessage({ chatId: actor.id, text: profileLinkErrorMessage(result.error) });
        return true;
    }
    if (start) {
        await sendTelegramBotMessage({ chatId: actor.id,
            text: 'Подключить этот Telegram к вашему профилю Kezek?\n\nПродолжайте только если вы сами создали ссылку в своём личном кабинете. Не подтверждайте чужие ссылки.\n\nПосле подтверждения вернитесь в Kezek: там нужно проверить аккаунт и завершить подключение.',
            replyMarkup: { inline_keyboard: [
                [{ text: 'Да, это мой запрос', callback_data: `kl1:ok:${token}` }],
                [{ text: 'Отменить', callback_data: `kl1:no:${token}` }],
            ] },
        });
    } else {
        await sendTelegramBotMessage({ chatId: actor.id, text: result.status === 'approved'
            ? 'Telegram подтверждён. Вернитесь в свой профиль Kezek, проверьте имя аккаунта и нажмите «Подключить этот аккаунт».'
            : 'Подключение отменено. Ваш профиль не изменён.' });
    }
    return true;
}
