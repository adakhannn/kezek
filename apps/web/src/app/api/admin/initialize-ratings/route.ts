import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runInitializeRatingsHttp } from '@/lib/initializeRatingsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.critical, () =>
        withErrorHandler('InitializeRatings', async () => runInitializeRatingsHttp(req)),
    );
}
