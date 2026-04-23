import crypto from 'crypto';

import { logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type TelegramMobileMetricType =
    | 'telegram_mobile_login_started'
    | 'telegram_mobile_login_approved'
    | 'telegram_mobile_login_expired'
    | 'telegram_mobile_login_failed';

export type TelegramMobileMetricsAdminLike = {
    from: (table: 'analytics_events') => {
        insert: (payload: Record<string, unknown>) => PromiseLike<{
            error: { message?: string } | null;
        }>;
    };
};

function hashNonce(nonce?: string | null) {
    if (!nonce) {
        return null;
    }

    return crypto.createHash('sha256').update(nonce).digest('hex');
}

export async function trackTelegramMobileMetric(
    eventType: TelegramMobileMetricType,
    params?: {
        nonce?: string | null;
        telegramId?: number | null;
        metadata?: Record<string, unknown> | null;
    },
    options?: {
        admin?: TelegramMobileMetricsAdminLike;
        allowInTests?: boolean;
    },
): Promise<void> {
    if (process.env.NODE_ENV === 'test' && !options?.allowInTests) {
        return;
    }

    const nonceHash = hashNonce(params?.nonce ?? null);
    const metadata: Record<string, unknown> = {
        ...(params?.metadata ?? {}),
        nonce_hash: nonceHash,
        telegram_id: params?.telegramId ?? null,
    };

    try {
        const admin =
            options?.admin ??
            (getServiceClient() as unknown as TelegramMobileMetricsAdminLike);
        const { error } = await admin.from('analytics_events').insert({
            event_type: eventType,
            source: 'mobile_auth_telegram',
            session_id: nonceHash,
            metadata,
        });

        if (error) {
            logWarn('TelegramMobileMetrics', 'Failed to write metric', {
                eventType,
                error: error.message ?? 'unknown_error',
            });
        }
    } catch (error) {
        logWarn('TelegramMobileMetrics', 'Unexpected metric write error', {
            eventType,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}
