import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runCreateWebHandoffHttp } from '@/lib/webHandoffHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    return withRateLimit(request, RateLimitConfigs.normal, () =>
        withErrorHandler('WebHandoff', () => runCreateWebHandoffHttp(request)),
    '/api/auth/web-handoff');
}
