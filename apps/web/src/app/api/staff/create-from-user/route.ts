export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffCreateFromUserHttp } from '@/lib/staffCreateFromUserHttpService';

export async function POST(req: Request) {
  return withRateLimit(
    req,
    RateLimitConfigs.normal,
    () => withErrorHandler('StaffCreateFromUser', () => runStaffCreateFromUserHttp(req)),
  );
}
