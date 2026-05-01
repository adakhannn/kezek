export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
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
    return withRateLimit(req, whatsAppMobileStartRateLimit, () =>
        withErrorHandler('WhatsAppMobileStart', () => runWhatsAppMobileStartHttp(req)),
    );
}

