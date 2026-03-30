export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { withErrorHandler } from '@/lib/apiErrorHandler';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffCreateHttp } from '@/lib/staffCreateHttpService';

export async function POST(req: Request) {
  return withRateLimit(
    req,
    RateLimitConfigs.normal,
    () => withErrorHandler('StaffCreate', () => runStaffCreateHttp(req)),
  );
}
