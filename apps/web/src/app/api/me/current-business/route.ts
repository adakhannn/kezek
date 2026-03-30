import { createErrorResponse, withErrorHandler } from '@/lib/apiErrorHandler';
import {
    runGetCurrentBusinessHttp,
    runSetCurrentBusinessHttp,
} from '@/lib/currentBusinessHttpService';
import { RateLimitConfigs, routeRateLimit, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    return withErrorHandler('GetCurrentBusiness', async () =>
        runGetCurrentBusinessHttp(),
    );
}

export async function POST(req: Request) {
    return withRateLimit(
        req,
        routeRateLimit('api/me/current-business', RateLimitConfigs.normal),
        () =>
            withErrorHandler('SetCurrentBusiness', async () => {
                try {
                    return await runSetCurrentBusinessHttp(req);
                } catch {
                    return createErrorResponse('validation', 'Invalid JSON body', undefined, 400);
                }
            }),
    );
}
