import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardAnalyticsOverviewHttp } from '@/lib/dashboardAnalyticsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('DashboardAnalyticsOverview', async () => runDashboardAnalyticsOverviewHttp(req));
}
