import { logWarn } from '@/lib/log';
import { resolveWhatsAppGraphApiVersion } from '@/lib/whatsAppGraphApi';

export type IntegrationStatus = {
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
    WHATSAPP_GRAPH_API_VERSION?: string;
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
        const graphApiVersion = resolveWhatsAppGraphApiVersion(env.WHATSAPP_GRAPH_API_VERSION);
        const url = `https://graph.facebook.com/${graphApiVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}?fields=id,verified_name,display_phone_number`;
        const res = await fetcher(url, {
            cache: 'no-store',
            headers: {
                Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
            },
        });

        if (!res.ok) {
            const body = await res.text();
            const message = classifyWhatsAppProviderError(res.status, body);
            logWarn('IntegrationsStatus', 'WhatsApp API error', {
                status: res.status,
                category: message,
            });
            return { configured: true, ok: false, message };
        }

        return { configured: true, ok: true };
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logWarn('IntegrationsStatus', 'WhatsApp check failed', { error: msg });
        return { configured: true, ok: false, message: msg || 'Сеть или сервер недоступен' };
    }
}

function classifyWhatsAppProviderError(status: number, body: string): string {
    let providerMessage = '';
    try {
        const parsed = JSON.parse(body) as { error?: { message?: string; code?: number } };
        providerMessage = parsed.error?.message ?? '';
    } catch {
        // A non-JSON provider response is classified by HTTP status below.
    }

    const normalized = providerMessage.toLowerCase();
    if (status === 401 || normalized.includes('access token') || normalized.includes('oauth')) {
        return 'Токен WhatsApp недействителен или истёк';
    }
    if (
        status === 403 ||
        normalized.includes('missing permissions') ||
        normalized.includes('does not have permission')
    ) {
        return 'У токена нет доступа к настроенному номеру WhatsApp';
    }
    if (
        status === 404 ||
        normalized.includes('unsupported get request') ||
        normalized.includes('does not exist')
    ) {
        return 'Настроенный Phone Number ID недоступен этому Meta Business';
    }

    return `Meta WhatsApp API недоступен (HTTP ${status})`;
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
