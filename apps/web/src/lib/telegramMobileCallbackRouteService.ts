import { writeTelegramAuthAuditEvent } from '@/lib/telegramAuthAuditLogService';
import { getTelegramMobileAuthAttempt, markTelegramMobileAuthAttemptFailed } from '@/lib/telegramMobileAuthAttemptService';
import { runTelegramMobileConfirmRoute } from '@/lib/telegramMobileConfirmRouteService';

type TelegramMobileCallbackBody = {
    nonce?: string;
    telegram_id?: number;
    decision?: string;
    first_name?: string;
    last_name?: string;
    username?: string;
    photo_url?: string;
};

type Failure = {
    ok: false;
    status: 400 | 401 | 404 | 409 | 410 | 500 | 503;
    error: 'validation' | 'auth' | 'not_found' | 'conflict' | 'internal' | 'service_unavailable';
    message: string;
};

type Success = {
    ok: true;
    payload: {
        status: 'approved' | 'failed';
        nonce: string;
        decision: 'approve' | 'cancel';
        expiresAt: number | null;
        linkage?: 'existing' | 'created';
    };
};

export type TelegramMobileCallbackRouteResult = Failure | Success;

function normalizeDecision(raw?: string): 'approve' | 'cancel' | null {
    const normalized = (raw || '').trim().toLowerCase();
    if (!normalized) {
        return null;
    }

    if (normalized === 'approve' || normalized === 'approved' || normalized === 'confirm' || normalized === 'ok') {
        return 'approve';
    }

    if (normalized === 'cancel' || normalized === 'deny' || normalized === 'reject' || normalized === 'failed') {
        return 'cancel';
    }

    return null;
}

export async function runTelegramMobileCallbackRoute({
    body,
    botSecret,
}: {
    body: TelegramMobileCallbackBody;
    botSecret?: string | null;
}): Promise<TelegramMobileCallbackRouteResult> {
    const nonce = body.nonce?.trim();
    const telegramId = body.telegram_id;
    const decision = normalizeDecision(body.decision);

    if (!nonce || !telegramId || !Number.isInteger(telegramId) || telegramId <= 0 || !decision) {
        await writeTelegramAuthAuditEvent({
            eventType: 'bot_login_failed',
            nonce: nonce ?? null,
            telegramId: Number.isInteger(telegramId) ? telegramId : null,
            decision: decision ?? null,
            status: 'validation_error',
            reason: 'invalid_callback_payload',
        });
        return {
            ok: false,
            status: 400,
            error: 'validation',
            message: 'Необходимо указать корректные telegram_id, nonce и decision',
        };
    }

    if (decision === 'cancel') {
        const attempt = getTelegramMobileAuthAttempt(nonce);
        if (!attempt) {
            await writeTelegramAuthAuditEvent({
                eventType: 'bot_login_failed',
                nonce,
                telegramId,
                decision,
                status: 'failed',
                reason: 'cancel_attempt_not_found',
            });
            return {
                ok: false,
                status: 404,
                error: 'not_found',
                message: 'Попытка входа не найдена',
            };
        }

        if (attempt.status === 'expired') {
            await writeTelegramAuthAuditEvent({
                eventType: 'bot_login_failed',
                nonce,
                telegramId,
                decision,
                status: 'expired',
                reason: 'cancel_attempt_expired',
            });
            return {
                ok: false,
                status: 410,
                error: 'conflict',
                message: 'Попытка входа истекла',
            };
        }

        if (attempt.expectedTelegramId && attempt.expectedTelegramId !== telegramId) {
            await writeTelegramAuthAuditEvent({
                eventType: 'bot_login_failed',
                nonce,
                telegramId,
                decision,
                status: 'conflict',
                reason: 'cancel_telegram_identity_mismatch',
                metadata: {
                    expectedTelegramId: attempt.expectedTelegramId,
                },
            });
            return {
                ok: false,
                status: 409,
                error: 'conflict',
                message: 'Попытка входа принадлежит другому Telegram аккаунту',
            };
        }

        markTelegramMobileAuthAttemptFailed({
            nonce,
            reason: 'cancelled_by_telegram_user',
        });

        await writeTelegramAuthAuditEvent({
            eventType: 'bot_login_cancelled',
            nonce,
            telegramId,
            decision,
            status: 'failed',
            reason: 'cancelled_by_telegram_user',
        });

        return {
            ok: true,
            payload: {
                status: 'failed',
                nonce,
                decision,
                expiresAt: attempt.expiresAt ?? null,
            },
        };
    }

    const result = await runTelegramMobileConfirmRoute({
        body,
        botSecret,
    });

    if (!result.ok) {
        await writeTelegramAuthAuditEvent({
            eventType: 'bot_login_failed',
            nonce,
            telegramId,
            decision,
            status: 'failed',
            reason: `approve_failed_${result.status}`,
            metadata: {
                error: result.error,
                message: result.message,
            },
        });
        return result;
    }

    await writeTelegramAuthAuditEvent({
        eventType: 'bot_login_approved',
        nonce,
        telegramId,
        decision,
        status: 'approved',
        linkage: result.payload.linkage,
    });

    return {
        ok: true,
        payload: {
            status: 'approved',
            nonce,
            decision,
            expiresAt: result.payload.expiresAt,
            linkage: result.payload.linkage,
        },
    };
}
