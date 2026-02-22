/**
 * GET /api/dashboard/integrations-status
 * Статус интеграций WhatsApp и Telegram для отображения в дашборде.
 * Доступно только менеджерам/владельцам (getBizContextForManagers).
 */

import { withErrorHandler, createSuccessResponse } from '@/lib/apiErrorHandler';
import { getBizContextForManagers } from '@/lib/authBiz';
import { logWarn } from '@/lib/log';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type IntegrationStatus = {
    configured: boolean;
    ok: boolean;
    message?: string;
};

async function checkWhatsApp(): Promise<IntegrationStatus> {
    const hasToken = !!process.env.WHATSAPP_ACCESS_TOKEN;
    const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
    const phoneIdValid =
        process.env.WHATSAPP_PHONE_NUMBER_ID != null &&
        /^\d+$/.test(process.env.WHATSAPP_PHONE_NUMBER_ID);

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
        const url = `https://graph.facebook.com/v18.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}?access_token=${encodeURIComponent(process.env.WHATSAPP_ACCESS_TOKEN!)}&fields=verified_name`;
        const res = await fetch(url, { cache: 'no-store' });
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

async function checkTelegram(): Promise<IntegrationStatus> {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || !token.trim()) {
        return {
            configured: false,
            ok: false,
            message: 'TELEGRAM_BOT_TOKEN не задан',
        };
    }

    try {
        const res = await fetch(`https://api.telegram.org/bot${token}/getMe`, { cache: 'no-store' });
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

export async function GET() {
    return withErrorHandler('IntegrationsStatus', async () => {
        await getBizContextForManagers();

        const [whatsapp, telegram] = await Promise.all([checkWhatsApp(), checkTelegram()]);

        return createSuccessResponse({
            whatsapp,
            telegram,
        });
    });
}
