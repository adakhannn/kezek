import { withErrorHandler } from '@/lib/apiErrorHandler';
import { runDeprecatedStaffFinanceHttp } from '@/lib/deprecatedStaffFinanceHttpService';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request, context: unknown) {
    return withErrorHandler('StaffFinance', async () => runDeprecatedStaffFinanceHttp(req, context));
}
