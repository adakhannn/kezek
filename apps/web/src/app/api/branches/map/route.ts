export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchesMapHttp } from '@/lib/branchesMapHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () =>
            withErrorHandler('BranchesMap', async () => runBranchesMapHttp(req)),
    );
}
