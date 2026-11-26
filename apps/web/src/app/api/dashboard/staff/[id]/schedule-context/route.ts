import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffScheduleContextHttp } from '@/lib/dashboardStaffReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The server reads of /dashboard/staff/[id]/schedule (editor choice, branch hours), for the mobile app. */
export async function GET(_req: Request, context: unknown) {
    return withErrorHandler('DashboardStaffScheduleContext', async () => runDashboardStaffScheduleContextHttp(context));
}
