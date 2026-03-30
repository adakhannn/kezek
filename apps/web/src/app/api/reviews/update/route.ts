export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runReviewUpdateHttp } from '@/lib/reviewUpdateHttpService';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('ReviewsUpdate', async () => runReviewUpdateHttp(req)),
    );
}
