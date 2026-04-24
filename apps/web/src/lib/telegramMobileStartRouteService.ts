import { writeTelegramAuthAuditEvent } from '@/lib/telegramAuthAuditLogService';
import { createTelegramMobileAuthAttempt } from '@/lib/telegramMobileAuthAttemptService';
import type { TelegramMobileAuthSourceMeta } from '@/lib/telegramMobileAuthAttemptService';

type Success = {
    ok: true;
    payload: {
        nonce: string;
        botDeepLink: string;
        expiresAt: number;
    };
};

export type TelegramMobileStartRouteResult = Success;

function resolveTelegramBotUsername() {
    const raw = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'kezek_auth_bot';
    const trimmed = raw.trim().replace(/^@+/, '');
    return trimmed || 'kezek_auth_bot';
}

export async function runTelegramMobileStartRoute({
    source,
}: {
    source?: TelegramMobileAuthSourceMeta;
} = {}): Promise<TelegramMobileStartRouteResult> {
    const botUsername = resolveTelegramBotUsername();
    const payload = await createTelegramMobileAuthAttempt({ botUsername, source });
    await writeTelegramAuthAuditEvent({
        eventType: 'mobile_start_created',
        nonce: payload.nonce,
        status: 'pending',
        metadata: {
            source: source ?? null,
        },
    });

    return {
        ok: true,
        payload,
    };
}
