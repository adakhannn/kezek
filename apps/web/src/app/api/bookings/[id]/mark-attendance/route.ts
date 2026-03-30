// apps/web/src/app/api/bookings/[id]/mark-attendance/route.ts
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runMarkAttendanceHttp } from '@/lib/markAttendanceHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export async function POST(req: Request, context: unknown) {
  return withRateLimit(req, RateLimitConfigs.normal, async () =>
    withErrorHandler('BookingsMarkAttendance', () => runMarkAttendanceHttp(req, context)),
  );
}
