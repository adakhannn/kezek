import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runBranchesOverviewHttp } from '@/lib/dashboardCatalogReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
    return withErrorHandler('DashboardBranches', async () => runBranchesOverviewHttp());
}
