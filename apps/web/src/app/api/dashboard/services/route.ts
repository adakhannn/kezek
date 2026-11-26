import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runServicesOverviewHttp } from '@/lib/dashboardCatalogReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withErrorHandler('DashboardServices', async () => runServicesOverviewHttp(req));
}
