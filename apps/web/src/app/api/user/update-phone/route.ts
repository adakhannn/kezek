import {
    withErrorHandler,
} from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runUserUpdatePhoneHttp } from '@/lib/userUpdatePhoneHttpService';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.auth, () =>
        withErrorHandler('UserUpdatePhone', async () => runUserUpdatePhoneHttp(req)),
    );
}
