import { Platform } from 'react-native';

import { apiRequest } from './api';
import { logDebug } from './log';

/**
 * The only event types /admin/api/analytics/track accepts (apps/web/src/lib/analyticsTrackHttpService.ts,
 * trackEventSchema). Anything else answers 400 and spends the telemetry rate limit; sign-in metrics
 * are written by the auth routes on the server. A contract test keeps this list equal to the server's.
 */
export const SUPPORTED_MOBILE_ANALYTICS_EVENTS = [
    'home_view',
    'business_page_view',
    'booking_flow_start',
    'booking_flow_step',
] as const;

export type MobileAnalyticsEventType = (typeof SUPPORTED_MOBILE_ANALYTICS_EVENTS)[number];

type MobileAnalyticsEventParams = {
    eventType: MobileAnalyticsEventType;
    bizId?: string;
    branchId?: string;
    bookingId?: string;
    metadata?: Record<string, unknown>;
};

let cachedSessionId: string | null = null;

function getSessionId(): string {
    if (cachedSessionId) return cachedSessionId;
    const random =
        typeof Math.random === 'function'
            ? Math.random().toString(36).slice(2)
            : String(Date.now());
    cachedSessionId = `m_${Date.now()}_${random}`;
    return cachedSessionId;
}

export async function trackMobileEvent(params: MobileAnalyticsEventParams): Promise<void> {
    if (!(SUPPORTED_MOBILE_ANALYTICS_EVENTS as readonly string[]).includes(params.eventType)) {
        logDebug('analytics', 'Event type not accepted by the server; not sent', { eventType: params.eventType });
        return;
    }
    try {
        await apiRequest('/admin/api/analytics/track', {
            method: 'POST',
            body: JSON.stringify({
                event_type: params.eventType,
                biz_id: params.bizId ?? null,
                branch_id: params.branchId ?? null,
                booking_id: params.bookingId ?? null,
                source: 'mobile',
                session_id: getSessionId(),
                metadata: {
                    platform: Platform.OS,
                    ...params.metadata,
                },
            }),
            headers: {
                'Content-Type': 'application/json',
            },
        });
    } catch {
        // Аналитика не должна ломать UX мобильного приложения
    }
}

