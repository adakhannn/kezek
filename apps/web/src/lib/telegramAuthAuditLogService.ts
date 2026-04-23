import { logError, logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type TelegramAuthAuditEventType =
    | 'mobile_start_created'
    | 'bot_start_opened'
    | 'bot_decision_received'
    | 'bot_login_approved'
    | 'bot_login_cancelled'
    | 'bot_login_failed';

export type TelegramAuthAuditEvent = {
    eventType: TelegramAuthAuditEventType;
    nonce?: string | null;
    telegramId?: number | null;
    decision?: 'approve' | 'cancel' | null;
    status?: 'pending' | 'approved' | 'failed' | 'expired' | 'conflict' | 'validation_error' | null;
    userId?: string | null;
    linkage?: 'existing' | 'created' | null;
    reason?: string | null;
    metadata?: Record<string, unknown> | null;
};

type TelegramAuthAuditAdminLike = {
    from: (table: 'telegram_auth_audit_log') => {
        insert: (payload: Record<string, unknown>) => PromiseLike<{
            error: { message?: string } | null;
        }>;
    };
};

function buildPayload(event: TelegramAuthAuditEvent) {
    return {
        event_type: event.eventType,
        nonce: event.nonce ?? null,
        telegram_id: event.telegramId ?? null,
        decision: event.decision ?? null,
        status: event.status ?? null,
        user_id: event.userId ?? null,
        linkage: event.linkage ?? null,
        reason: event.reason ?? null,
        metadata: event.metadata ?? {},
    };
}

export async function writeTelegramAuthAuditEventWithAdmin(
    admin: TelegramAuthAuditAdminLike,
    event: TelegramAuthAuditEvent,
): Promise<void> {
    const { error } = await admin.from('telegram_auth_audit_log').insert(buildPayload(event));
    if (error) {
        logWarn('TelegramAuthAudit', 'Failed to persist auth audit event', {
            eventType: event.eventType,
            error: error.message,
        });
    }
}

export async function writeTelegramAuthAuditEvent(
    event: TelegramAuthAuditEvent,
): Promise<void> {
    if (process.env.NODE_ENV === 'test') {
        return;
    }

    try {
        const admin = getServiceClient() as unknown as TelegramAuthAuditAdminLike;
        await writeTelegramAuthAuditEventWithAdmin(admin, event);
    } catch (error) {
        logError('TelegramAuthAudit', 'Unexpected error while writing auth audit event', error);
    }
}
