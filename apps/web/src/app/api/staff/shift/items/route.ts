import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';
import { runStaffShiftItemsHttp } from '@/lib/staffShiftItemsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
    return withRateLimit(req, RateLimitConfigs.authenticatedIngress, async () =>
        runStaffShiftItemsHttp(req),
        "/api/staff/shift/items",
    );
}
