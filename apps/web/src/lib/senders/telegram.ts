// apps/web/src/lib/senders/telegram.ts

type SendTelegramOpts = {
    chatId: number | string; // Telegram user ID
    text: string;
};

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Отправка сообщения через Telegram Bot API.
 * Документация: https://core.telegram.org/bots/api#sendmessage
 */
export async function sendTelegram(opts: SendTelegramOpts) {
    const { chatId, text } = opts;

    if (!TELEGRAM_BOT_TOKEN) {
        throw new Error('Telegram ENV not configured (TELEGRAM_BOT_TOKEN)');
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

    const body = {
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
    };

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errText = await resp.text().catch(() => '');
        let extra = '';
        try {
            const json = JSON.parse(errText);
            extra = json.description || errText.slice(0, 500);
        } catch {
            extra = errText.slice(0, 500);
        }
        throw new Error(`Telegram API error: HTTP ${resp.status} — ${extra}`);
    }

    return resp.json().catch(() => ({}));
}


