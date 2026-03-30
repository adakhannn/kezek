import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runRatingsJobsHttp } from '@/lib/ratingsAdminHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('RatingsJobs', async () => runRatingsJobsHttp()),
    );
}
