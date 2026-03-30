export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchesNearbyHttp } from '@/lib/branchesNearbyHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('BranchesNearby', async () => runBranchesNearbyHttp(req)),
    );
}
