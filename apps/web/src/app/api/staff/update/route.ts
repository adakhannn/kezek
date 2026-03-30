export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffUpdateHttp } from '@/lib/staffUpdateHttpService';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(
    req,
    RateLimitConfigs.normal,
    () => withErrorHandler('StaffUpdate', () => runStaffUpdateHttp(req, context)),
  );
}
