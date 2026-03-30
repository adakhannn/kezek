export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runTelegramLoginHttp } from '@/lib/telegramLoginHttpService';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.auth, async () =>
        withErrorHandler('TelegramLogin', async () => runTelegramLoginHttp(req)),
    );
}
