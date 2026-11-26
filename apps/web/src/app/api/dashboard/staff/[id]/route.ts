import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffDetailHttp } from '@/lib/dashboardStaffReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** One staff card of the current business (/dashboard/staff/[id]) as JSON, for the mobile app. */
export async function GET(_req: Request, context: unknown) {
    return withErrorHandler('DashboardStaffDetail', async () => runDashboardStaffDetailHttp(context));
}
