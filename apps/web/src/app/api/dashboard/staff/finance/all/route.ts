import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runFinanceAllDashboardHttp } from '@/lib/financeAllDashboardHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
    return withErrorHandler('FinanceAll', async () => runFinanceAllDashboardHttp(req));
}
