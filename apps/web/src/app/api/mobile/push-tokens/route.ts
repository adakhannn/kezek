export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runRegisterPushTokenHttp, runUnregisterPushTokenHttp } from '@/lib/mobilePushTokensHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobilePushTokenRegister', async () => runRegisterPushTokenHttp(req)),
        "/api/mobile/push-tokens",
    );
}

export async function DELETE(req: Request) {
    return withRateLimit(
        req,
        RateLimitConfigs.normal,
        () => withErrorHandler('MobilePushTokenUnregister', async () => runUnregisterPushTokenHttp(req)),
        "/api/mobile/push-tokens",
    );
}
