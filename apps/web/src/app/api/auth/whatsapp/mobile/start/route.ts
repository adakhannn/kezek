export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { isMobileWhatsAppAuthEnabledForRequest } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppMobileStartHttp } from '@/lib/whatsAppMobileStartHttpService';

const whatsAppMobileStartRateLimit = routeRateLimit(
    'api/auth/whatsapp/mobile/start',
    RateLimitConfigs.auth,
    {
        maxRequests: 10,
        windowMs: 15 * 60 * 1000,
    },
);

export async function POST(req: Request) {
    if (!isMobileWhatsAppAuthEnabledForRequest(req)) {
        return createErrorResponse(
            'service_unavailable',
            'WhatsApp mobile auth is disabled by feature flag/rollout',
            undefined,
            503,
        );
    }

    return withRateLimit(req, whatsAppMobileStartRateLimit, () =>
        withErrorHandler('WhatsAppMobileStart', () => runWhatsAppMobileStartHttp(req)),
    );
}

