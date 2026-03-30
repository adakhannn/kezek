import { logWarn } from '@/lib/log';

type IntegrationStatus = {
    configured: boolean;
    ok: boolean;
    message?: string;
};

type FetchResponseLike = {
    ok: boolean;
    status: number;
    text: () => Promise<string>;
    json: () => Promise<unknown>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<FetchResponseLike>;

type EnvLike = Partial<{
    WHATSAPP_ACCESS_TOKEN?: string;
    WHATSAPP_PHONE_NUMBER_ID?: string;
    TELEGRAM_BOT_TOKEN?: string;
}>;

export type IntegrationsStatusResult = {
    whatsapp: IntegrationStatus;
    telegram: IntegrationStatus;
};

export async function checkWhatsAppIntegration({
    env,
    fetcher,
}: {
    env: EnvLike;
    fetcher: FetchLike;
}): Promise<IntegrationStatus> {
    const hasToken = !!env.WHATSAPP_ACCESS_TOKEN;
    const hasPhoneId = !!env.WHATSAPP_PHONE_NUMBER_ID;
    const phoneIdValid =
        env.WHATSAPP_PHONE_NUMBER_ID != null &&
        /^\d+$/.test(env.WHATSAPP_PHONE_NUMBER_ID);

    if (!hasToken || !hasPhoneId) {
        return {
            configured: false,
            ok: false,
            message: 'WHATSAPP_ACCESS_TOKEN или WHATSAPP_PHONE_NUMBER_ID не заданы',
        };
    }

    if (!phoneIdValid) {
        return {
            configured: true,
            ok: false,
            message: 'WHATSAPP_PHONE_NUMBER_ID должен быть числом (см. Meta Developers)',
        };
    }

    try {
        const url = `https://graph.facebook.com/v18.0/${env.WHATSAPP_PHONE_NUMBER_ID}?access_token=${encodeURIComponent(
            env.WHATSAPP_ACCESS_TOKEN ?? '',
        )}&fields=verified_name`;
        const res = await fetcher(url, { cache: 'no-store' });

        if (!res.ok) {
            const body = await res.text();
            if (res.status === 401) {
                return { configured: true, ok: false, message: 'Неверный или истёкший токен WhatsApp' };
            }
            if (res.status === 404) {
                return { configured: true, ok: false, message: 'Номер WhatsApp не найден в Meta Business' };
            }
            logWarn('IntegrationsStatus', 'WhatsApp API error', { status: res.status, body: body.slice(0, 200) });
            return { configured: true, ok: false, message: `Ошибка API WhatsApp (${res.status})` };
        }

        return { configured: true, ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logWarn('IntegrationsStatus', 'WhatsApp check failed', { error: msg });
        return { configured: true, ok: false, message: msg || 'Сеть или сервер недоступен' };
    }
}

export async function checkTelegramIntegration({
    env,
    fetcher,
}: {
    env: EnvLike;
    fetcher: FetchLike;
}): Promise<IntegrationStatus> {
    const token = env.TELEGRAM_BOT_TOKEN;
    if (!token || !token.trim()) {
        return {
            configured: false,
            ok: false,
            message: 'TELEGRAM_BOT_TOKEN не задан',
        };
    }

    try {
        const res = await fetcher(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' });
        const data = (await res.json()) as { ok?: boolean; description?: string };
        if (data?.ok === true) {
            return { configured: true, ok: true };
        }

        const desc = data?.description ?? (res.ok ? '' : `HTTP ${res.status}`);
        return {
            configured: true,
            ok: false,
            message: desc || 'Бот Telegram не отвечает',
        };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logWarn('IntegrationsStatus', 'Telegram check failed', { error: msg });
        return { configured: true, ok: false, message: msg || 'Сеть или сервер недоступен' };
    }
}

export async function getIntegrationsStatus({
    env = process.env as EnvLike,
    fetcher = fetch,
}: {
    env?: EnvLike;
    fetcher?: FetchLike;
} = {}): Promise<IntegrationsStatusResult> {
    const [whatsapp, telegram] = await Promise.all([
        checkWhatsAppIntegration({ env, fetcher }),
        checkTelegramIntegration({ env, fetcher }),
    ]);

    return {
        whatsapp,
        telegram,
    };
}
