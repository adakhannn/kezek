import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runStaffFinanceStatsHttp } from '@/lib/staffFinanceStatsHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('StaffFinanceStats', async () => runStaffFinanceStatsHttp(req, context));
}
