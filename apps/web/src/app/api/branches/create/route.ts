export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchCreateHttp } from '@/lib/branchCreateHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request) {
  return withRateLimit(req, RateLimitConfigs.critical, () =>
    withErrorHandler('BranchesCreate', () => runBranchCreateHttp(req)),
  );
}
