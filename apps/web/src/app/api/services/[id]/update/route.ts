export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runServiceUpdateHttp } from '@/lib/serviceUpdateHttpService';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () =>
            withErrorHandler('ServicesUpdate', async () => {
                return runServiceUpdateHttp(req, context);
            })
    );
}
