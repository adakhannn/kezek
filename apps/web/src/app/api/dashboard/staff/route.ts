import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardStaffListHttp } from '@/lib/dashboardStaffReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The staff list of the current business (/dashboard/staff) as JSON, for the mobile app. */
export async function GET() {
    return withErrorHandler('DashboardStaffList', async () => runDashboardStaffListHttp());
}
