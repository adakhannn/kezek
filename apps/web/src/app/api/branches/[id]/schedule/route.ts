export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runGetBranchScheduleHttp, runSaveBranchScheduleHttp } from '@/lib/branchScheduleHttpService';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('BranchSchedule', async () => runSaveBranchScheduleHttp(req, context)),
  );
}

export async function GET(req: Request, context: unknown) {
  return withErrorHandler('BranchSchedule', async () => runGetBranchScheduleHttp(req, context));
}
