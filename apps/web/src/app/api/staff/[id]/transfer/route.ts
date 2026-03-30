// apps/web/src/app/api/staff/[id]/transfer/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffTransferHttp } from '@/lib/staffTransferHttpService';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(
    req,
    RateLimitConfigs.normal,
    () => withErrorHandler('StaffTransfer', () => runStaffTransferHttp(req, context)),
  );
}
