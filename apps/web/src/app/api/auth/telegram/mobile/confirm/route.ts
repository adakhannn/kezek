export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { createErrorResponse } from '@/lib/apiErrorHandler';
import { isMobileTelegramDeepLinkAuthEnabled } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramMobileConfirmHttp } from '@/lib/telegramMobileConfirmHttpService';

const telegramMobileConfirmRateLimit = routeRateLimit(
    'api/auth/telegram/mobile/confirm',
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

    return withRateLimit(request, telegramMobileConfirmRateLimit, async () =>
        withErrorHandler('TelegramMobileConfirm', () =>
            runTelegramMobileConfirmHttp(request),
        ),
    );
}
