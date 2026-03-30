import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffShiftUpdateHoursHttp } from '@/lib/dashboardStaffShiftUpdateHoursHttpService';
import { RateLimitConfigs, withRateLimit } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request, context: unknown) {
    return withRateLimit(req, RateLimitConfigs.normal, () =>
        withErrorHandler('UpdateShiftHours', async () =>
            runDashboardStaffShiftUpdateHoursHttp(req, context),
        ),
    );
}
