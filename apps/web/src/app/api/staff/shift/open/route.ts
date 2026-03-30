import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffShiftOpenHttp } from '@/lib/staffShiftOpenHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.critical, async () =>
        runStaffShiftOpenHttp(req),
    );
}
