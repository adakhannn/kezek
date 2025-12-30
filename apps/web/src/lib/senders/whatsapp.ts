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

    console.log('[WhatsApp] Sending message:', { 
        to: phoneNumber, 
        url, 
        hasToken: !!WHATSAPP_ACCESS_TOKEN, 
        hasPhoneId: !!WHATSAPP_PHONE_NUMBER_ID,
        phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
        tokenPreview: WHATSAPP_ACCESS_TOKEN ? `${WHATSAPP_ACCESS_TOKEN.slice(0, 10)}...${WHATSAPP_ACCESS_TOKEN.slice(-5)}` : 'missing'
    });

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
            
            // Дополнительная информация об ошибке
            if (errJson.error?.type === 'OAuthException') {
                errorMessage += '\n\nВозможные причины:\n';
                errorMessage += '1. Неверный WHATSAPP_ACCESS_TOKEN\n';
                errorMessage += '2. Токен истек или был отозван\n';
                errorMessage += '3. Токен не имеет необходимых разрешений';
            } else if (errJson.error?.code === 100) {
                errorMessage += '\n\nВозможные причины:\n';
                errorMessage += '1. Неверный WHATSAPP_PHONE_NUMBER_ID\n';
                errorMessage += '2. Phone Number ID не связан с вашим WhatsApp Business Account\n';
                errorMessage += '3. Phone Number ID не имеет разрешений на отправку сообщений';
            }
        } catch {
            errorMessage += ` — ${errText.slice(0, 500)}`;
        }
        console.error('[WhatsApp] API error:', { 
            status: resp.status, 
            error: errorDetails, 
            response: errText,
            phoneNumberId: WHATSAPP_PHONE_NUMBER_ID,
            url
        });
        throw new Error(errorMessage);
    }

    const result = await resp.json();
    console.log('[WhatsApp] Message sent successfully:', { messageId: result.messages?.[0]?.id, to: phoneNumber });
    return result;
}

