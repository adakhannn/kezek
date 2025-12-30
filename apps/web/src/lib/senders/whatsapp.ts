// apps/web/src/lib/senders/whatsapp.ts

type SendWhatsAppOpts = {
    to: string;     // E.164, напр. +996XXXXXXXXX
    text: string;   // текст сообщения
};

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;

/**
 * Отправка сообщения через WhatsApp Cloud API
 * Документация: https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export async function sendWhatsApp({ to, text }: SendWhatsAppOpts) {
    if (!WHATSAPP_ACCESS_TOKEN) {
        throw new Error('WhatsApp ENV not configured (WHATSAPP_ACCESS_TOKEN)');
    }

    if (!WHATSAPP_PHONE_NUMBER_ID) {
        throw new Error('WhatsApp ENV not configured (WHATSAPP_PHONE_NUMBER_ID)');
    }

    // Нормализуем номер телефона (WhatsApp API требует формат без +)
    // Формат должен быть: 996XXXXXXXXX (без +)
    let phoneNumber = to.startsWith('+') ? to.slice(1) : to;
    
    // Убираем все нецифровые символы на случай, если есть пробелы и т.д.
    phoneNumber = phoneNumber.replace(/\D/g, '');

    if (!phoneNumber || phoneNumber.length < 9) {
        throw new Error(`Invalid phone number format: ${to} (normalized: ${phoneNumber})`);
    }

    const url = `https://graph.facebook.com/v21.0/${WHATSAPP_PHONE_NUMBER_ID}/messages`;

    const body = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'text',
        text: {
            preview_url: false,
            body: text,
        },
    };

    console.log('[WhatsApp] Sending message:', { to: phoneNumber, url, hasToken: !!WHATSAPP_ACCESS_TOKEN, hasPhoneId: !!WHATSAPP_PHONE_NUMBER_ID });

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    if (!resp.ok) {
        const errText = await resp.text();
        let errorMessage = `WhatsApp API error: HTTP ${resp.status}`;
        let errorDetails: unknown = null;
        try {
            const errJson = JSON.parse(errText);
            errorMessage += ` — ${errJson.error?.message || errText.slice(0, 500)}`;
            errorDetails = errJson.error;
        } catch {
            errorMessage += ` — ${errText.slice(0, 500)}`;
        }
        console.error('[WhatsApp] API error:', { status: resp.status, error: errorDetails, response: errText });
        throw new Error(errorMessage);
    }

    const result = await resp.json();
    console.log('[WhatsApp] Message sent successfully:', { messageId: result.messages?.[0]?.id, to: phoneNumber });
    return result;
}

