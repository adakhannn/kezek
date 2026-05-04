import crypto from 'crypto';

import { logWarn } from '@/lib/log';
import { getServiceClient } from '@/lib/supabaseService';

export type WhatsAppMobileMetricType =
    | 'mobile_whatsapp_login_started'
    | 'mobile_whatsapp_otp_sent'
    | 'mobile_whatsapp_login_success'
    | 'mobile_whatsapp_login_failed'
    | 'mobile_whatsapp_login_expired';

export type WhatsAppMobileMetricsAdminLike = {
    from: (table: 'analytics_events') => {
        insert: (payload: Record<string, unknown>) => PromiseLike<{
            error: { message?: string } | null;
        }>;
    };
};

function sha256(input?: string | null) {
    if (!input) {
        return null;
    }
    return crypto.createHash('sha256').update(input).digest('hex');
}

export async function trackWhatsAppMobileMetric(
    eventType: WhatsAppMobileMetricType,
    params?: {
        attemptId?: string | null;
        phoneHash?: string | null;
        metadata?: Record<string, unknown> | null;
    },
    options?: {
        admin?: WhatsAppMobileMetricsAdminLike;
        allowInTests?: boolean;
    },
): Promise<void> {
    if (process.env.NODE_ENV === 'test' && !options?.allowInTests) {
        return;
    }

    const attemptHash = sha256(params?.attemptId ?? null);
    const metadata: Record<string, unknown> = {
        ...(params?.metadata ?? {}),
        attempt_hash: attemptHash,
        phone_hash: params?.phoneHash ?? null,
    };

    try {
        const admin =
            options?.admin ??
            (getServiceClient() as unknown as WhatsAppMobileMetricsAdminLike);
        const { error } = await admin.from('analytics_events').insert({
            event_type: eventType,
            source: 'mobile_auth_whatsapp',
            session_id: attemptHash,
            metadata,
        });

        if (error) {
            logWarn('WhatsAppMobileMetrics', 'Failed to write metric', {
                eventType,
                error: error.message ?? 'unknown_error',
            });
        }
    } catch (error) {
        logWarn('WhatsAppMobileMetrics', 'Unexpected metric write error', {
            eventType,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

