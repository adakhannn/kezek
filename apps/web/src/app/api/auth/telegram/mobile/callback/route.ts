export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { createErrorResponse } from '@/lib/apiErrorHandler';
import { isMobileTelegramDeepLinkAuthEnabled } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramMobileCallbackHttp } from '@/lib/telegramMobileCallbackHttpService';

const telegramMobileCallbackRateLimit = routeRateLimit(
    'api/auth/telegram/mobile/callback',
    RateLimitConfigs.auth,
    {
        maxRequests: 20,
        windowMs: 15 * 60 * 1000,
    },
);

export async function POST(request: Request) {
    if (!isMobileTelegramDeepLinkAuthEnabled()) {
        return createErrorResponse(
            'service_unavailable',
            'Telegram mobile deep-link auth is disabled by feature flag',
            undefined,
            503,
        );
    }

    return withRateLimit(request, telegramMobileCallbackRateLimit, async () =>
        withErrorHandler('TelegramMobileCallback', () =>
            runTelegramMobileCallbackHttp(request),
        ),
    );
}
