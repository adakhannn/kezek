// apps/web/src/app/api/dashboard/staff/[id]/shift/open/route.ts
import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftOpenHttp } from '@/lib/dashboardStaffShiftOpenHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.critical, async () =>
    withErrorHandler('OwnerShiftOpen', () => runDashboardStaffShiftOpenHttp(req, context)),
  );
}
