export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';

import { createErrorResponse } from '@/lib/apiErrorHandler';
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { isMobileTelegramDeepLinkAuthEnabled } from '@/lib/featureFlags';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramMobileStatusHttp } from '@/lib/telegramMobileStatusHttpService';

const telegramMobileStatusRateLimit = routeRateLimit(
    'api/auth/telegram/mobile/status',
    RateLimitConfigs.normal,
    {
        maxRequests: 60,
        windowMs: 60 * 1000,
    },
);

export async function GET(request: NextRequest) {
    if (!isMobileTelegramDeepLinkAuthEnabled()) {
        return createErrorResponse(
            'service_unavailable',
            'Telegram mobile deep-link auth is disabled by feature flag',
            undefined,
            503,
        );
    }

    return withRateLimit(request, telegramMobileStatusRateLimit, async () =>
        withErrorHandler('TelegramMobileStatus', () =>
            runTelegramMobileStatusHttp(request),
        ),
    );
}
