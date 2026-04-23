import { logError } from '@/lib/log';

type TelegramInlineKeyboardButton = {
    text: string;
    callback_data: string;
};

type TelegramReplyMarkup = {
    inline_keyboard: TelegramInlineKeyboardButton[][];
};

type TelegramSendMessageParams = {
    chatId: number;
    text: string;
    replyMarkup?: TelegramReplyMarkup;
};

type TelegramEditMessageTextParams = {
    chatId: number;
    messageId: number;
    text: string;
    replyMarkup?: TelegramReplyMarkup;
};

type TelegramAnswerCallbackQueryParams = {
    callbackQueryId: string;
    text?: string;
    showAlert?: boolean;
};

function getBotToken() {
    return process.env.TELEGRAM_BOT_TOKEN?.trim() || '';
}

async function callTelegramApi<TResponse>(
    method: string,
    payload: Record<string, unknown>,
): Promise<TResponse> {
    const token = getBotToken();
    if (!token) {
        throw new Error('Telegram bot is not configured');
    }

    const url = `https://api.telegram.org/bot${token}/${method}`;
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    const text = await response.text().catch(() => '');
    let parsed: {
        ok?: boolean;
        description?: string;
        result?: TResponse;
    } = {};
    if (text) {
        try {
            parsed = JSON.parse(text);
        } catch {
            parsed = {};
        }
    }

    if (!response.ok || !parsed.ok) {
        const description = parsed.description || `HTTP ${response.status}`;
        throw new Error(`Telegram API ${method} failed: ${description}`);
    }

    if (!('result' in parsed)) {
        throw new Error(`Telegram API ${method} returned empty result`);
    }

    return parsed.result as TResponse;
}

export async function sendTelegramBotMessage(params: TelegramSendMessageParams): Promise<{
    message_id: number;
}> {
    return callTelegramApi('sendMessage', {
        chat_id: params.chatId,
        text: params.text,
        disable_web_page_preview: true,
        reply_markup: params.replyMarkup,
    });
}

export async function editTelegramBotMessageText(
    params: TelegramEditMessageTextParams,
): Promise<void> {
    await callTelegramApi('editMessageText', {
        chat_id: params.chatId,
        message_id: params.messageId,
        text: params.text,
        disable_web_page_preview: true,
        reply_markup: params.replyMarkup,
    });
}

export async function answerTelegramCallbackQuery(
    params: TelegramAnswerCallbackQueryParams,
): Promise<void> {
    try {
        await callTelegramApi('answerCallbackQuery', {
            callback_query_id: params.callbackQueryId,
            text: params.text,
            show_alert: params.showAlert ?? false,
        });
    } catch (error) {
        logError('TelegramWebhook', 'Failed to answer callback query', error);
    }
}

export type { TelegramReplyMarkup };
