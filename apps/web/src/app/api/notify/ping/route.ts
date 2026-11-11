export const runtime = 'nodejs';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { runNotifyPingHttp } from '@/lib/notifyPingHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(req, { ...RateLimitConfigs.critical, keyPrefix: 'notify-ping' }, () =>
        withErrorHandler('NotifyPing', async () => runNotifyPingHttp(req)),
        "/api/notify/ping",
    );
}
