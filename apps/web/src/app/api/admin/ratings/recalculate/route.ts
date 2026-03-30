import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runRatingsManualRecalculateHttp } from '@/lib/ratingsManualRecalculateHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.critical,
        () => withErrorHandler('RatingsManualRecalculate', async () => runRatingsManualRecalculateHttp(req)),
    );
}
