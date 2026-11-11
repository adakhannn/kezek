import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runRatingsDebugEntitiesHttp } from '@/lib/ratingsDebugEntitiesHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('RatingsDebugEntities', async () =>
            runRatingsDebugEntitiesHttp(req),
        ),
        "/api/admin/ratings/debug-entities",
    );
}
