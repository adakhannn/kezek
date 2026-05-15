export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import { isMobileWhatsAppAuthEnabled } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runWhatsAppMobileVerifyHttp } from '@/lib/whatsAppMobileVerifyHttpService';

const whatsAppMobileVerifyRateLimit = routeRateLimit(
    'api/auth/whatsapp/mobile/verify',
    RateLimitConfigs.auth,
    {
        maxRequests: 20,
        windowMs: 15 * 60 * 1000,
    },
);

export async function POST(req: Request) {
    if (!isMobileWhatsAppAuthEnabled()) {
        return createErrorResponse(
            'service_unavailable',
            'WhatsApp mobile auth is disabled by feature flag',
            undefined,
            503,
        );
    }

    return withRateLimit(req, whatsAppMobileVerifyRateLimit, () =>
        withErrorHandler('WhatsAppMobileVerify', () => runWhatsAppMobileVerifyHttp(req)),
    );
}

