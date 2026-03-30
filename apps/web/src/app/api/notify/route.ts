export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runNotifyHttp } from '@/lib/notifyHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('Notify', async () => runNotifyHttp(req)),
    );
}
