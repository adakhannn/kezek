export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runGetBranchScheduleHttp, runSaveBranchScheduleHttp } from '@/lib/branchScheduleHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.normal, () =>
    withErrorHandler('BranchSchedule', async () => runSaveBranchScheduleHttp(req, context)),
      "/api/branches/[id]/schedule",
  );
}

export async function GET(req: Request, context: unknown) {
  return withErrorHandler('BranchSchedule', async () => runGetBranchScheduleHttp(req, context));
}
