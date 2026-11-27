// apps/web/src/app/api/network-check/dns/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { resolveNetworkCheckHost, withNoStore } from '@/lib/networkCheckDnsService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

/** Public, no parameters: resolves only the fixed Supabase host (R25-31 network check page). */
export async function GET(req: Request) {
    return withNoStore(await withRateLimit(
        req,
        RateLimitConfigs.public,
        () => withErrorHandler('NetworkCheckDns', () => resolveNetworkCheckHost()),
        '/api/network-check/dns',
    ));
}
