/**
 * POST /api/dashboard/staff/[id]/shift/close
 * Manager-side shift close endpoint.
 */

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftCloseHttp } from '@/lib/dashboardStaffShiftCloseHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.critical, async () =>
    withErrorHandler('DashboardStaffShiftClose', () => runDashboardStaffShiftCloseHttp(req, context)),
  );
}
