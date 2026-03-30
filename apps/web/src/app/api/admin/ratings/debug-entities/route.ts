import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runRatingsDebugEntitiesHttp } from '@/lib/ratingsDebugEntitiesHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('RatingsDebugEntities', async () =>
            runRatingsDebugEntitiesHttp(req),
        ),
    );
}
