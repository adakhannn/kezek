import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffShiftCloseHttp } from '@/lib/staffShiftCloseHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.critical, async () =>
        runStaffShiftCloseHttp(req),
    );
}
