export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { createErrorResponse } from '@/lib/apiErrorHandler';
import { isMobileTelegramDeepLinkAuthEnabledForRequest } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramMobileStartHttp } from '@/lib/telegramMobileStartHttpService';

const telegramMobileStartRateLimit = routeRateLimit(
    'api/auth/telegram/mobile/start',
    RateLimitConfigs.auth,
    {
        maxRequests: 8,
        windowMs: 15 * 60 * 1000,
    },
);

export async function POST(request: Request) {
    if (!isMobileTelegramDeepLinkAuthEnabledForRequest(request)) {
        return createErrorResponse(
            'service_unavailable',
            'Telegram mobile deep-link auth is disabled by feature flag/rollout',
            undefined,
            503,
        );
    }

    return withRateLimit(request, telegramMobileStartRateLimit, async () =>
        withErrorHandler('TelegramMobileStart', () =>
            runTelegramMobileStartHttp(request),
        ),
    );
}
