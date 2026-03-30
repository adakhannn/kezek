import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDashboardBranchesListHttp } from '@/lib/dashboardBranchesListHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  return withErrorHandler('DashboardBranchesList', async () => runDashboardBranchesListHttp(req));
}

