export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchUpdateHttp } from '@/lib/branchUpdateHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('BranchesUpdate', async () => runBranchUpdateHttp(req, context)),
  );
}
