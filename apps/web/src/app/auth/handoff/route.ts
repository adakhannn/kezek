import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runRedeemWebHandoffHttp } from '@/lib/webHandoffHttpService';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    return withRateLimit(request, RateLimitConfigs.normal, () => runRedeemWebHandoffHttp(request), '/auth/handoff');
}
