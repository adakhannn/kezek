// apps/web/src/app/api/mobile/categories/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runMobileCategoriesHttp } from '@/lib/mobileCategoriesHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function GET(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.public,
        () => withErrorHandler('MobileCategories', async () => runMobileCategoriesHttp()),
        "/api/mobile/categories",
    );
}
