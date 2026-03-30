import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardAnalyticsLoadHttp } from '@/lib/dashboardAnalyticsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('DashboardAnalyticsLoad', async () => runDashboardAnalyticsLoadHttp(req));
}
