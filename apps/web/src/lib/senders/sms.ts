// apps/web/src/lib/senders/sms.ts

type SendSMSOpts = {
    to: string;     // E.164, напр. +996XXXXXXXXX
    text: string;   // текст сообщения
};

// ENV-переключатель: 'twilio' | 'webhook'
const SMS_PROVIDER = (process.env.SMS_PROVIDER ?? 'twilio').toLowerCase();

//
// TWILIO (без SDK — через REST API)
// Требуются ENV:
//   TWILIO_ACCOUNT_SID
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM (отправитель, например +15005550006)
//
async function sendViaTwilio({to, text}: SendSMSOpts) {
    const sid = process.env.TWILIO_ACCOUNT_SID!;
    const tok = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_FROM!;

    if (!sid || !tok || !from) {
        throw new Error('Twilio ENV not configured (TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM)');
    }

    // Twilio требует application/x-www-form-urlencoded
    const body = new URLSearchParams({
        To: to,
        From: from,
        Body: text,
    });

    const resp = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: 'POST',
        headers: {
            'Authorization': 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64'),
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body,
    });

    if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`Twilio error: HTTP ${resp.status} — ${errText.slice(0, 500)}`);
    }
    return true;
}

//
// WEBHOOK (любой свой шлюз)
// Требуются ENV:
//   SMS_WEBHOOK_URL      — твой эндпойнт (POST)
//   SMS_WEBHOOK_TOKEN?   — опционально; будет передан в Authorization: Bearer
//
// Формат тела — JSON: { to, text }
//
async function sendViaWebhook({to, text}: SendSMSOpts) {
    const url = process.env.SMS_WEBHOOK_URL!;
    const token = process.env.SMS_WEBHOOK_TOKEN;

    if (!url) throw new Error('Webhook ENV not configured (SMS_WEBHOOK_URL)');

    const resp = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? {'Authorization': `Bearer ${token}`} : {}),
        },
        body: JSON.stringify({to, text}),
    });

    if (!resp.ok) {
        const err = await resp.text();
        throw new Error(`Webhook SMS error: HTTP ${resp.status} — ${err.slice(0, 500)}`);
    }
    return true;
}

// Нормализация телефонов (простая): убираем пробелы/скобки/дефисы, добавляем '+' если начинается с 996
export function normalizePhoneToE164(input?: string | null): string | null {
    if (!input) return null;
    const raw = input.replace(/[^\d+]/g, '');
    if (raw.startsWith('+')) return raw;
    // пример для Кыргызстана (KZ/UZ адаптируй при необходимости)
    if (raw.startsWith('996')) return '+' + raw;
    // если локальные форматы — тут можно добавить свои правила
    return raw.startsWith('+') ? raw : '+' + raw; // fallback
}

export async function sendSMS(opts: SendSMSOpts) {
    switch (SMS_PROVIDER) {
        case 'twilio':
            return sendViaTwilio(opts);
        case 'webhook':
            return sendViaWebhook(opts);
        default:
            throw new Error(`Unknown SMS_PROVIDER: ${SMS_PROVIDER}`);
    }
}
