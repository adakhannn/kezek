import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runQuickHoldHttp } from '@/lib/quickHoldHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.public, async () =>
        withErrorHandler('QuickHold', async () => runQuickHoldHttp(req)),
    );
}
