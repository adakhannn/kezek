import { Platform } from 'react-native';

import { apiRequest } from './api';

type MobileAnalyticsEventParams = {
    eventType: string;
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
    try {
        await apiRequest('/admin/analytics/track', {
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

