import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runSellVisitPackageHttp } from '@/lib/visitPackagesHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: { params: Promise<{ clientId: string }> }) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('SellVisitPackage', async () => runSellVisitPackageHttp(req, context)),
  );
}
