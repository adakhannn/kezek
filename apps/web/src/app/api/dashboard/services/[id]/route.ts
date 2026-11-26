import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runServiceForEditHttp } from '@/lib/dashboardCatalogReadHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(_req: Request, context: unknown) {
    return withErrorHandler('DashboardService', async () => runServiceForEditHttp(context));
}
