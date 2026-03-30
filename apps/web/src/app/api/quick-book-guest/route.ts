import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runQuickBookGuestHttp } from '@/lib/quickBookGuestHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.public, async () =>
        withErrorHandler('QuickBookGuest', async () => runQuickBookGuestHttp(req)),
    );
}
