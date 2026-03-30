import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runCreateBranchPromotionHttp, runListBranchPromotionsHttp } from '@/lib/branchPromotionsHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('BranchPromotions', async () => runListBranchPromotionsHttp(req, context));
}

export async function POST(req: Request, context: unknown) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('BranchPromotions', async () => runCreateBranchPromotionHttp(req, context)),
    );
}
