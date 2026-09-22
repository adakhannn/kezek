export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';
import { runTelegramLoginHttp } from '@/lib/telegramLoginHttpService';

export async function POST(req: Request) {
    return withRateLimit(req, routeRateLimit('api/auth/telegram/login', RateLimitConfigs.auth), async () =>
        withErrorHandler('TelegramLogin', async () => runTelegramLoginHttp(req)),
    );
}
